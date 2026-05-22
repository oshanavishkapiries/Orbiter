'use client';

import { useEffect, useState } from 'react';
import { GitBranch, FileCode2, FileJson, ChevronDown, ChevronRight } from 'lucide-react';
import { formatDate, formatBytes, truncate } from '@/lib/utils';
import type { FlowFile } from '@/lib/types';

export default function FlowsPage() {
  const [flows, setFlows] = useState<FlowFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/flows')
      .then((r) => r.json())
      .then(setFlows)
      .finally(() => setLoading(false));
  }, []);

  const refined = flows.filter((f) => f.type === 'refined');
  const raw = flows.filter((f) => f.type === 'raw');

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-100 flex items-center gap-2.5">
          <GitBranch size={20} className="text-violet-400" />
          Flows
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Recorded automation flows — replay them without LLM cost
        </p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-zinc-600 text-sm">Loading…</div>
      ) : flows.length === 0 ? (
        <EmptyFlows />
      ) : (
        <div className="space-y-6">
          {refined.length > 0 && (
            <FlowGroup
              title="Refined flows"
              badge={`${refined.length} ready to replay`}
              badgeColor="emerald"
              flows={refined}
            />
          )}
          {raw.length > 0 && (
            <FlowGroup
              title="Raw recordings"
              badge={`${raw.length} need refinement`}
              badgeColor="yellow"
              flows={raw}
            />
          )}
        </div>
      )}
    </div>
  );
}

function FlowGroup({
  title,
  badge,
  badgeColor,
  flows,
}: {
  title: string;
  badge: string;
  badgeColor: 'emerald' | 'yellow';
  flows: FlowFile[];
}) {
  const badgeStyle =
    badgeColor === 'emerald'
      ? 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40'
      : 'text-yellow-400 bg-yellow-950/40 border-yellow-800/40';

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-sm font-medium text-zinc-300">{title}</h2>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${badgeStyle}`}>
          {badge}
        </span>
      </div>
      <div className="space-y-2">
        {flows.map((f) => (
          <FlowCard key={f.name} flow={f} />
        ))}
      </div>
    </div>
  );
}

function FlowCard({ flow }: { flow: FlowFile }) {
  const [expanded, setExpanded] = useState(false);

  const isRefined = flow.type === 'refined';
  const baseName = flow.name
    .replace('.flow.json', '')
    .replace('.raw.json', '')
    .replace(/-\d+$/, '');

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-800/20 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {isRefined ? (
            <FileCode2 size={15} className="flex-shrink-0 text-emerald-400" />
          ) : (
            <FileJson size={15} className="flex-shrink-0 text-yellow-400" />
          )}
          <div className="min-w-0">
            <p className="text-sm text-zinc-200 font-medium truncate">
              {truncate(baseName, 60)}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`text-[10px] font-medium ${
                  isRefined ? 'text-emerald-500' : 'text-yellow-500'
                }`}
              >
                {isRefined ? 'refined' : 'raw'}
              </span>
              <span className="text-[10px] text-zinc-700">·</span>
              <span className="text-[10px] text-zinc-600">
                {formatBytes(flow.sizeBytes)}
              </span>
              {flow.stepCount != null && (
                <>
                  <span className="text-[10px] text-zinc-700">·</span>
                  <span className="text-[10px] text-zinc-600">
                    {flow.stepCount} steps
                  </span>
                </>
              )}
              <span className="text-[10px] text-zinc-700">·</span>
              <span className="text-[10px] text-zinc-600">
                {formatDate(flow.modifiedAt)}
              </span>
            </div>
          </div>
        </div>
        {expanded ? (
          <ChevronDown size={14} className="flex-shrink-0 text-zinc-500" />
        ) : (
          <ChevronRight size={14} className="flex-shrink-0 text-zinc-500" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-zinc-800 px-5 py-4">
          <p className="text-xs text-zinc-600 mb-3">
            To replay this flow, run in the CLI:
          </p>
          <code className="block text-xs font-mono text-zinc-300 bg-zinc-950/60 px-3 py-2.5 rounded-lg border border-zinc-800">
            {isRefined
              ? `orbiter replay data/flows/${flow.name}`
              : `orbiter refine data/flows/${flow.name}`}
          </code>
          {!isRefined && (
            <p className="text-xs text-zinc-600 mt-2">
              Refine first, then replay the resulting <code className="text-zinc-400">.flow.json</code>.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyFlows() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
      <GitBranch size={28} className="text-zinc-700" />
      <p className="text-sm font-medium text-zinc-500">No flow files found</p>
      <p className="text-xs text-zinc-600 max-w-xs">
        Run <code className="text-zinc-400 bg-zinc-800 px-1 rounded">orbiter run</code> to record
        your first automation flow
      </p>
    </div>
  );
}
