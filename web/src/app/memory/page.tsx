'use client';

import { useEffect, useState } from 'react';
import { Database, Search, TrendingUp } from 'lucide-react';
import type { MemorySelector } from '@/lib/types';

interface MemoryStats {
  total: number;
  byType: Record<string, number>;
  domains: { domain: string; count: number }[];
  averageConfidence: number;
}

export default function MemoryPage() {
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [selectors, setSelectors] = useState<MemorySelector[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadingSelectors, setLoadingSelectors] = useState(false);

  useEffect(() => {
    fetch('/api/memory?stats=true')
      .then((r) => r.json())
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedDomain) return;
    setLoadingSelectors(true);
    fetch(`/api/memory?domain=${encodeURIComponent(selectedDomain)}`)
      .then((r) => r.json())
      .then(setSelectors)
      .finally(() => setLoadingSelectors(false));
  }, [selectedDomain]);

  const confidencePercent = stats
    ? Math.round(stats.averageConfidence * 100)
    : 0;

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-100 flex items-center gap-2.5">
          <Database size={20} className="text-violet-400" />
          Memory
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Learned CSS selectors and patterns that speed up future runs
        </p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-zinc-600 text-sm">Loading…</div>
      ) : !stats || stats.total === 0 ? (
        <EmptyMemory />
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <MemStatCard label="Total Memories" value={String(stats.total)} />
            <MemStatCard
              label="CSS Selectors"
              value={String(stats.byType['selector'] ?? 0)}
            />
            <MemStatCard
              label="Domains Learned"
              value={String(stats.domains.length)}
            />
            <MemStatCard
              label="Avg Confidence"
              value={`${confidencePercent}%`}
              accent={
                confidencePercent >= 70
                  ? 'emerald'
                  : confidencePercent >= 40
                  ? 'yellow'
                  : 'red'
              }
            />
          </div>

          {/* Domain Selector */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden mb-6">
            <div className="px-5 py-4 border-b border-zinc-800">
              <h2 className="text-sm font-medium text-zinc-300 mb-3">
                Explore by domain
              </h2>
              <div className="flex flex-wrap gap-2">
                {stats.domains.map(({ domain, count }) => (
                  <button
                    key={domain}
                    onClick={() => setSelectedDomain(domain)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                      selectedDomain === domain
                        ? 'bg-violet-600/20 border-violet-600/40 text-violet-300'
                        : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                    }`}
                  >
                    {domain}
                    <span className="text-[10px] opacity-60">{count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Selectors Table */}
            {selectedDomain && (
              <div>
                {loadingSelectors ? (
                  <div className="px-5 py-6 text-center text-zinc-600 text-xs">
                    Loading selectors…
                  </div>
                ) : selectors.length === 0 ? (
                  <div className="px-5 py-6 text-center text-zinc-600 text-xs">
                    No selectors found for {selectedDomain}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-zinc-800/50">
                          {['Element', 'Type', 'Primary Selector', 'Confidence', 'Used'].map(
                            (h) => (
                              <th
                                key={h}
                                className="px-5 py-3 text-left text-zinc-500 font-medium"
                              >
                                {h}
                              </th>
                            ),
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/30">
                        {selectors.map((s) => (
                          <tr
                            key={s.id}
                            className="hover:bg-zinc-800/20 transition-colors"
                          >
                            <td className="px-5 py-3 text-zinc-200 font-medium">
                              {s.elementName}
                            </td>
                            <td className="px-5 py-3 text-zinc-500">{s.elementType}</td>
                            <td className="px-5 py-3 font-mono text-zinc-400 max-w-xs truncate">
                              {s.primarySelector}
                            </td>
                            <td className="px-5 py-3">
                              <ConfidencePill confidence={s.confidence} />
                            </td>
                            <td className="px-5 py-3 text-zinc-500 tabular-nums">
                              {s.usageCount}×
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MemStatCard({
  label,
  value,
  accent = 'default',
}: {
  label: string;
  value: string;
  accent?: 'emerald' | 'yellow' | 'red' | 'default';
}) {
  const valueColor =
    accent === 'emerald'
      ? 'text-emerald-400'
      : accent === 'yellow'
      ? 'text-yellow-400'
      : accent === 'red'
      ? 'text-red-400'
      : 'text-zinc-100';

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
      <p className="text-xs text-zinc-500 mb-2">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${valueColor}`}>{value}</p>
    </div>
  );
}

function ConfidencePill({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 70 ? 'text-emerald-400' : pct >= 40 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="flex items-center gap-2">
      <div className="w-14 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${
            pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs tabular-nums ${color}`}>{pct}%</span>
    </div>
  );
}

function EmptyMemory() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
      <Database size={28} className="text-zinc-700" />
      <p className="text-sm font-medium text-zinc-500">No memories yet</p>
      <p className="text-xs text-zinc-600 max-w-xs">
        As Orbiter runs tasks, it learns CSS selectors and site patterns that will
        appear here
      </p>
    </div>
  );
}
