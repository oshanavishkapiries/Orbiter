'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Clock,
  Zap,
  Database,
} from 'lucide-react';
import { StatusBadge } from '@/components/shared/status-badge';
import { ToolBadge } from '@/components/shared/tool-badge';
import { formatDate, formatDuration, formatTokens, truncate } from '@/lib/utils';
import type { Session, Step, LLMInteraction, CollectedData } from '@/lib/types';

type Tab = 'steps' | 'chat' | 'data';

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [interactions, setInteractions] = useState<LLMInteraction[]>([]);
  const [collected, setCollected] = useState<CollectedData[]>([]);
  const [tab, setTab] = useState<Tab>('steps');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/sessions/${id}`).then((r) => r.json()),
      fetch(`/api/sessions/${id}/steps`).then((r) => r.json()),
      fetch(`/api/sessions/${id}/interactions`).then((r) => r.json()),
      fetch(`/api/sessions/${id}/data`).then((r) => r.json()),
    ])
      .then(([sess, stps, ints, data]) => {
        setSession(sess.error ? null : sess);
        setSteps(stps);
        setInteractions(ints);
        setCollected(data);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const totalTokens = interactions.reduce((s, i) => s + i.totalTokens, 0);
  const duration =
    session?.completedAt && session?.createdAt
      ? session.completedAt - session.createdAt
      : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-600">
        Loading session…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-8">
        <Link href="/sessions" className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300 mb-6">
          <ChevronLeft size={14} /> Sessions
        </Link>
        <p className="text-zinc-500">Session not found.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl">
      {/* Breadcrumb */}
      <Link
        href="/sessions"
        className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-5"
      >
        <ChevronLeft size={12} /> Sessions
      </Link>

      {/* Session Header */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-6">
        <div className="flex flex-wrap items-start gap-3 mb-3">
          <StatusBadge status={session.status} size="md" />
          <span className="font-mono text-xs text-zinc-500 bg-zinc-800/60 px-2 py-1 rounded">
            {session.id}
          </span>
        </div>
        <h1 className="text-lg font-medium text-zinc-100 mb-4 leading-snug">
          {session.goal}
        </h1>
        <div className="flex flex-wrap gap-5 text-xs text-zinc-500">
          {session.model && (
            <span className="flex items-center gap-1.5">
              <Zap size={11} className="text-violet-400" />
              {session.model}
            </span>
          )}
          {duration !== null && (
            <span className="flex items-center gap-1.5">
              <Clock size={11} />
              {formatDuration(duration)}
            </span>
          )}
          {steps.length > 0 && (
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={11} />
              {steps.length} steps
            </span>
          )}
          {totalTokens > 0 && (
            <span className="flex items-center gap-1.5">
              <MessageSquare size={11} />
              {formatTokens(totalTokens)} tokens
            </span>
          )}
          <span>{formatDate(session.createdAt)}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-zinc-900/50 border border-zinc-800 rounded-lg p-1 w-fit">
        {(
          [
            { key: 'steps', label: `Steps${steps.length ? ` (${steps.length})` : ''}` },
            { key: 'chat', label: `LLM Chat${interactions.length ? ` (${interactions.length})` : ''}` },
            { key: 'data', label: `Data${collected.length ? ` (${collected.length})` : ''}` },
          ] as { key: Tab; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm rounded-md transition-colors ${
              tab === key
                ? 'bg-zinc-700 text-zinc-100 font-medium'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'steps' && <StepsTab steps={steps} />}
      {tab === 'chat' && <ChatTab interactions={interactions} />}
      {tab === 'data' && <DataTab collected={collected} />}
    </div>
  );
}

function StepsTab({ steps }: { steps: Step[] }) {
  if (steps.length === 0) {
    return <EmptyTabState message="No step data available for this session." />;
  }

  return (
    <div className="space-y-2">
      {steps.map((step) => (
        <div
          key={step.stepNumber}
          className={`flex gap-4 p-4 rounded-lg border ${
            step.success
              ? 'bg-zinc-900/40 border-zinc-800/60'
              : 'bg-red-950/20 border-red-900/40'
          }`}
        >
          <div className="flex-shrink-0 flex flex-col items-center gap-1 pt-0.5">
            <span className="text-xs font-mono text-zinc-600 w-5 text-center">
              {step.stepNumber}
            </span>
            {step.success ? (
              <CheckCircle2 size={14} className="text-emerald-500" />
            ) : (
              <XCircle size={14} className="text-red-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <ToolBadge tool={step.toolName} />
              {step.duration != null && (
                <span className="text-xs text-zinc-600">
                  {formatDuration(step.duration)}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {step.resultSummary}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ChatTab({ interactions }: { interactions: LLMInteraction[] }) {
  if (interactions.length === 0) {
    return <EmptyTabState message="No LLM interaction data available." />;
  }

  return (
    <div className="space-y-4">
      {interactions.map((interaction) => (
        <InteractionCard key={interaction.callIndex} interaction={interaction} />
      ))}
    </div>
  );
}

function InteractionCard({ interaction }: { interaction: LLMInteraction }) {
  const [expanded, setExpanded] = useState(false);
  const [showSystem, setShowSystem] = useState(false);

  const lastUserMsg = [...interaction.fullMessages]
    .reverse()
    .find((m) => m.role === 'user');

  const systemMsg = interaction.fullMessages.find((m) => m.role === 'system');

  const userContent =
    typeof lastUserMsg?.content === 'string'
      ? lastUserMsg.content
      : Array.isArray(lastUserMsg?.content)
      ? lastUserMsg.content
          .filter((p) => p.type === 'text')
          .map((p) => p.text)
          .join('\n')
      : '';

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Turn header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-zinc-500">
            Turn {interaction.callIndex}
          </span>
          <span className="text-xs text-zinc-600">·</span>
          <span className="text-xs text-zinc-500">
            ↑ {formatTokens(interaction.promptTokens)} ↓{' '}
            {formatTokens(interaction.completionTokens)} tokens
          </span>
          <span className="text-xs text-zinc-600">·</span>
          <span className="text-xs text-zinc-500">
            {formatDuration(interaction.durationMs)}
          </span>
          {interaction.toolCalls && interaction.toolCalls.length > 0 && (
            <>
              <span className="text-xs text-zinc-600">·</span>
              <span className="text-xs text-violet-400">
                {interaction.toolCalls.length} tool call
                {interaction.toolCalls.length > 1 ? 's' : ''}
              </span>
            </>
          )}
        </div>
        {expanded ? (
          <ChevronDown size={14} className="text-zinc-500" />
        ) : (
          <ChevronRight size={14} className="text-zinc-500" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-zinc-800 divide-y divide-zinc-800/50">
          {/* System prompt */}
          {systemMsg && (
            <div className="px-5 py-3">
              <button
                onClick={() => setShowSystem((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors mb-2"
              >
                {showSystem ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                System prompt ({typeof systemMsg.content === 'string' ? systemMsg.content.length : '?'} chars)
              </button>
              {showSystem && (
                <pre className="text-xs text-zinc-500 whitespace-pre-wrap font-mono bg-zinc-950/50 p-3 rounded-lg overflow-auto max-h-48">
                  {typeof systemMsg.content === 'string' ? systemMsg.content : JSON.stringify(systemMsg.content, null, 2)}
                </pre>
              )}
            </div>
          )}

          {/* User context */}
          {userContent && (
            <div className="px-5 py-3">
              <p className="text-xs text-zinc-600 mb-2">User context</p>
              <pre className="text-xs text-zinc-400 whitespace-pre-wrap font-mono bg-zinc-950/50 p-3 rounded-lg overflow-auto max-h-40">
                {truncate(userContent, 800)}
              </pre>
            </div>
          )}

          {/* Assistant response */}
          {interaction.responseContent && (
            <div className="px-5 py-3">
              <p className="text-xs text-zinc-600 mb-2">Assistant</p>
              <p className="text-sm text-zinc-300 leading-relaxed">
                {interaction.responseContent}
              </p>
            </div>
          )}

          {/* Tool calls */}
          {interaction.toolCalls && interaction.toolCalls.length > 0 && (
            <div className="px-5 py-3">
              <p className="text-xs text-zinc-600 mb-2">Tool calls</p>
              <div className="space-y-2">
                {interaction.toolCalls.map((tc, i) => {
                  let args: Record<string, unknown> = {};
                  try {
                    args = JSON.parse(tc.function.arguments);
                  } catch {}
                  return (
                    <div
                      key={i}
                      className="flex gap-3 items-start p-3 bg-zinc-950/50 rounded-lg"
                    >
                      <ToolBadge tool={tc.function.name} />
                      <pre className="text-xs text-zinc-400 font-mono flex-1 whitespace-pre-wrap">
                        {JSON.stringify(args, null, 2)}
                      </pre>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DataTab({ collected }: { collected: CollectedData[] }) {
  if (collected.length === 0) {
    return <EmptyTabState message="No extracted data for this session." />;
  }

  return (
    <div className="space-y-4">
      {collected.map((item, i) => (
        <DataCard key={i} item={item} />
      ))}
    </div>
  );
}

function DataCard({ item }: { item: CollectedData }) {
  const [expanded, setExpanded] = useState(true);
  const isArray = Array.isArray(item.data);
  const count = isArray ? (item.data as unknown[]).length : 1;

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Database size={14} className="text-violet-400" />
          <ToolBadge tool={item.toolName} />
          <span className="text-xs text-zinc-500">
            {isArray ? `${count} item${count !== 1 ? 's' : ''}` : '1 result'} · Step {item.stepNumber}
          </span>
        </div>
        {expanded ? (
          <ChevronDown size={14} className="text-zinc-500" />
        ) : (
          <ChevronRight size={14} className="text-zinc-500" />
        )}
      </button>
      {expanded && (
        <div className="border-t border-zinc-800 px-5 py-4">
          <pre className="text-xs text-zinc-300 font-mono overflow-auto max-h-80 whitespace-pre-wrap">
            {JSON.stringify(item.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function EmptyTabState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-zinc-600 text-sm">
      {message}
    </div>
  );
}
