'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Activity, Play, Clock, Zap, CheckCircle2, XCircle } from 'lucide-react';
import { StatusBadge } from '@/components/shared/status-badge';
import { ToolBadge } from '@/components/shared/tool-badge';
import { formatDate, formatDuration, formatTokens, truncate } from '@/lib/utils';
import type { Session, Step } from '@/lib/types';

export default function LivePage() {
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [totalTokens, setTotalTokens] = useState(0);
  const prevSessionId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (cancelled) return;

      try {
        const res = await fetch('/api/sessions?status=running&limit=1');
        const sessions: Session[] = await res.json();
        const session = sessions[0] ?? null;

        if (!cancelled) {
          setLastChecked(new Date());
          setActiveSession(session);

          if (session) {
            // Reset steps when a new session becomes active
            if (prevSessionId.current !== session.id) {
              prevSessionId.current = session.id;
              setSteps([]);
              setTotalTokens(0);
            }

            const [stepsRes, intRes] = await Promise.all([
              fetch(`/api/sessions/${session.id}/steps`).then((r) => r.json()),
              fetch(`/api/sessions/${session.id}/interactions`).then((r) => r.json()),
            ]);

            if (!cancelled) {
              setSteps(stepsRes);
              const tokens = (intRes as { totalTokens: number }[]).reduce(
                (s, i) => s + i.totalTokens,
                0,
              );
              setTotalTokens(tokens);
            }
          } else {
            prevSessionId.current = null;
          }
        }
      } catch {
        // ignore network errors
      }

      if (!cancelled) {
        setTimeout(poll, 2000);
      }
    }

    poll();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100 flex items-center gap-2.5">
            <Activity size={20} className="text-violet-400" />
            Live Monitor
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {lastChecked
              ? `Last checked: ${lastChecked.toLocaleTimeString()}`
              : 'Polling for active sessions…'}
          </p>
        </div>
        <Link
          href="/run"
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Play size={13} />
          New Run
        </Link>
      </div>

      {!activeSession ? (
        <NoActiveSession />
      ) : (
        <ActiveSessionView
          session={activeSession}
          steps={steps}
          totalTokens={totalTokens}
        />
      )}
    </div>
  );
}

function NoActiveSession() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
      <div className="w-14 h-14 rounded-xl bg-zinc-800/60 flex items-center justify-center">
        <Activity size={24} className="text-zinc-600" />
      </div>
      <div>
        <p className="text-base font-medium text-zinc-400">No active sessions</p>
        <p className="text-sm text-zinc-600 mt-1">
          Start a run to see live automation progress here
        </p>
      </div>
      <Link
        href="/run"
        className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
      >
        <Play size={13} />
        Start a New Run
      </Link>
    </div>
  );
}

function ActiveSessionView({
  session,
  steps,
  totalTokens,
}: {
  session: Session;
  steps: Step[];
  totalTokens: number;
}) {
  const latestStep = steps[steps.length - 1];
  const successCount = steps.filter((s) => s.success).length;
  const elapsed = Date.now() - session.createdAt;

  return (
    <div className="space-y-5">
      {/* Session Card */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <StatusBadge status={session.status} size="md" />
          <span className="font-mono text-xs text-zinc-500">{session.id}</span>
        </div>
        <p className="text-base font-medium text-zinc-100 mb-4">
          {session.goal}
        </p>
        <div className="flex flex-wrap gap-5 text-xs text-zinc-500">
          {session.model && (
            <span className="flex items-center gap-1.5">
              <Zap size={11} className="text-violet-400" />
              {session.model}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Clock size={11} />
            {formatDuration(elapsed)} elapsed
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={11} className="text-emerald-400" />
            {successCount}/{steps.length} steps done
          </span>
          {totalTokens > 0 && (
            <span className="flex items-center gap-1.5">
              {formatTokens(totalTokens)} tokens
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-zinc-400">Execution Progress</p>
          <span className="text-xs text-zinc-600">{steps.length} steps</span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-600 to-violet-400 rounded-full transition-all duration-500"
            style={{ width: `${Math.min((steps.length / 50) * 100, 100)}%` }}
          />
        </div>

        {latestStep && (
          <div className="mt-4 flex items-center gap-3 p-3 bg-zinc-950/40 rounded-lg border border-zinc-800/50">
            <span className="flex-shrink-0">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse inline-block" />
            </span>
            <ToolBadge tool={latestStep.toolName} />
            <p className="text-xs text-zinc-400 truncate flex-1">
              {truncate(latestStep.resultSummary, 80)}
            </p>
          </div>
        )}
      </div>

      {/* Step Feed */}
      {steps.length > 0 && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <p className="px-5 py-3 text-xs font-medium text-zinc-400 border-b border-zinc-800">
            Step history
          </p>
          <div className="divide-y divide-zinc-800/30 max-h-80 overflow-y-auto">
            {[...steps].reverse().map((step) => (
              <div key={step.stepNumber} className="flex items-start gap-3 px-5 py-3">
                <span className="flex-shrink-0 text-xs font-mono text-zinc-700 w-5 text-center mt-0.5">
                  {step.stepNumber}
                </span>
                {step.success ? (
                  <CheckCircle2 size={13} className="flex-shrink-0 text-emerald-500 mt-0.5" />
                ) : (
                  <XCircle size={13} className="flex-shrink-0 text-red-500 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <ToolBadge tool={step.toolName} />
                    {step.duration != null && (
                      <span className="text-xs text-zinc-700">
                        {formatDuration(step.duration)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 truncate">
                    {step.resultSummary}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
