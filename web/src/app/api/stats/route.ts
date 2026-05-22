import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { readdir } from 'fs/promises';
import path from 'path';
import { Stats } from '@/lib/types';

export async function GET() {
  const [totalRows, tokenRows] = await Promise.all([
    query<{ status: string; cnt: string }>(
      `SELECT status, COUNT(*) as cnt FROM sessions GROUP BY status`,
    ),
    query<{ total: string }>(
      `SELECT COALESCE(SUM(total_tokens), 0) as total FROM llm_interactions`,
    ),
  ]);

  let totalSessions = 0;
  let completedSessions = 0;
  let failedSessions = 0;
  let activeSessions = 0;

  for (const row of totalRows) {
    const n = parseInt(row.cnt, 10);
    totalSessions += n;
    if (row.status === 'completed') completedSessions = n;
    else if (row.status === 'failed') failedSessions = n;
    else if (row.status === 'running') activeSessions = n;
  }

  const totalTokens = parseInt(tokenRows[0]?.total ?? '0', 10);
  const successRate =
    totalSessions > 0
      ? Math.round((completedSessions / totalSessions) * 1000) / 10
      : 0;

  // Count flow files
  let flowsCount = 0;
  const dataDir = process.env.ORBITER_DATA_DIR;
  if (dataDir) {
    try {
      const files = await readdir(path.join(dataDir, 'flows'));
      flowsCount = files.filter(
        (f) => f.endsWith('.flow.json') || f.endsWith('.raw.json'),
      ).length;
    } catch {
      // no flows dir
    }
  }

  const stats: Stats = {
    totalSessions,
    completedSessions,
    failedSessions,
    activeSessions,
    successRate,
    totalTokens,
    flowsCount,
  };

  return NextResponse.json(stats);
}
