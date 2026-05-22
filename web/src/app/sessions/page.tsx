'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Filter } from 'lucide-react';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatDate, truncate } from '@/lib/utils';
import type { Session } from '@/lib/types';

type Filter = 'all' | 'running' | 'completed' | 'failed';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    setLoading(true);
    const q = filter !== 'all' ? `?status=${filter}&limit=200` : '?limit=200';
    fetch(`/api/sessions${q}`)
      .then((r) => r.json())
      .then(setSessions)
      .finally(() => setLoading(false));
  }, [filter]);

  const filtered = sessions.filter((s) =>
    s.goal.toLowerCase().includes(search.toLowerCase()) ||
    s.id.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Sessions</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {loading ? '…' : `${filtered.length} sessions`}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search sessions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-600 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
          {(['all', 'running', 'completed', 'failed'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors capitalize ${
                filter === f
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-zinc-600 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-zinc-600 text-sm">
            {search ? 'No sessions match your search.' : 'No sessions found.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  {['Session ID', 'Goal', 'Status', 'Model', 'Duration', 'Date'].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-left text-xs text-zinc-500 font-medium tracking-wider"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/30">
                {filtered.map((s) => {
                  const duration =
                    s.completedAt && s.createdAt
                      ? ((s.completedAt - s.createdAt) / 1000).toFixed(1) + 's'
                      : '—';
                  return (
                    <tr
                      key={s.id}
                      onClick={() => (window.location.href = `/sessions/${s.id}`)}
                      className="hover:bg-zinc-800/30 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3 font-mono text-xs text-zinc-400">
                        {s.id}
                      </td>
                      <td className="px-5 py-3 text-zinc-200 max-w-xs">
                        {truncate(s.goal, 65)}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="px-5 py-3 text-xs text-zinc-500 font-mono max-w-[140px] truncate">
                        {s.model ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-xs text-zinc-500 tabular-nums">
                        {duration}
                      </td>
                      <td className="px-5 py-3 text-xs text-zinc-500">
                        {formatDate(s.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
