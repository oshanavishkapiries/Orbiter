'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Play, CheckCircle2, XCircle, Zap, GitBranch, ArrowRight } from 'lucide-react';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatDate, formatTokens, truncate } from '@/lib/utils';
import type { Stats, Session } from '@/lib/types';

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/stats').then((r) => r.json()),
      fetch('/api/sessions?limit=10').then((r) => r.json()),
    ])
      .then(([s, sess]) => {
        setStats(s);
        setSessions(sess);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Overview of all automation sessions and activity
          </p>
        </div>
        <Link
          href="/run"
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Play size={14} />
          New Run
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Sessions"
          value={loading ? '—' : String(stats?.totalSessions ?? 0)}
          sub="all time"
          icon={<Zap size={16} className="text-violet-400" />}
          accent="violet"
        />
        <StatCard
          label="Success Rate"
          value={loading ? '—' : `${stats?.successRate ?? 0}%`}
          sub={`${stats?.completedSessions ?? 0} completed`}
          icon={<CheckCircle2 size={16} className="text-emerald-400" />}
          accent="emerald"
        />
        <StatCard
          label="Total Tokens"
          value={loading ? '—' : formatTokens(stats?.totalTokens ?? 0)}
          sub="across all sessions"
          icon={<Zap size={16} className="text-blue-400" />}
          accent="blue"
        />
        <StatCard
          label="Flows Saved"
          value={loading ? '—' : String(stats?.flowsCount ?? 0)}
          sub="recorded flows"
          icon={<GitBranch size={16} className="text-yellow-400" />}
          accent="yellow"
        />
      </div>

      {/* Recent Sessions */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-300">Recent Sessions</h2>
          <Link
            href="/sessions"
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-violet-400 transition-colors"
          >
            View all <ArrowRight size={11} />
          </Link>
        </div>

        {loading ? (
          <div className="px-5 py-12 text-center text-zinc-600 text-sm">Loading…</div>
        ) : sessions.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800/50">
                  {['Session ID', 'Goal', 'Status', 'Model', 'Date'].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-xs text-zinc-500 font-medium tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/30">
                {sessions.map((s) => (
                  <tr
                    key={s.id}
                    className="hover:bg-zinc-800/30 transition-colors cursor-pointer"
                    onClick={() => (window.location.href = `/sessions/${s.id}`)}
                  >
                    <td className="px-5 py-3 font-mono text-xs text-zinc-400">
                      {s.id}
                    </td>
                    <td className="px-5 py-3 text-zinc-200 max-w-xs">
                      {truncate(s.goal, 60)}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-5 py-3 text-xs text-zinc-500 font-mono">
                      {s.model ? truncate(s.model.replace('anthropic/', ''), 24) : '—'}
                    </td>
                    <td className="px-5 py-3 text-xs text-zinc-500">
                      {formatDate(s.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Active sessions alert */}
      {(stats?.activeSessions ?? 0) > 0 && (
        <Link
          href="/live"
          className="mt-4 flex items-center gap-3 p-4 bg-blue-950/40 border border-blue-800/40 rounded-xl hover:bg-blue-950/60 transition-colors"
        >
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-sm text-blue-300">
            {stats!.activeSessions} active session{stats!.activeSessions > 1 ? 's' : ''} running
          </span>
          <ArrowRight size={14} className="ml-auto text-blue-400" />
        </Link>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  accent: string;
}) {
  const borderMap: Record<string, string> = {
    violet: 'border-violet-800/30',
    emerald: 'border-emerald-800/30',
    blue: 'border-blue-800/30',
    yellow: 'border-yellow-800/30',
  };

  return (
    <div
      className={`bg-zinc-900/50 border rounded-xl p-5 ${borderMap[accent] ?? 'border-zinc-800'}`}
    >
      <div className="flex items-center gap-2 mb-3">{icon}<span className="text-xs text-zinc-500">{label}</span></div>
      <p className="text-3xl font-bold text-zinc-100 tabular-nums">{value}</p>
      <p className="text-xs text-zinc-600 mt-1">{sub}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <XCircle size={28} className="text-zinc-700" />
      <p className="text-sm text-zinc-500">No sessions yet</p>
      <Link
        href="/run"
        className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
      >
        Start your first run →
      </Link>
    </div>
  );
}
