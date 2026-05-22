import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { readdir, stat } from 'fs/promises';
import path from 'path';
import { Session } from '@/lib/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);
  const status = searchParams.get('status');

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (status) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  values.push(limit);

  const rows = await query<{
    id: string;
    goal: string;
    model: string;
    provider: string;
    status: string;
    created_at: string;
    completed_at: string | null;
  }>(
    `SELECT id, goal, model, provider, status, created_at, completed_at
     FROM sessions ${where}
     ORDER BY created_at DESC
     LIMIT $${values.length}`,
    values,
  );

  if (rows.length > 0) {
    const sessions: Session[] = rows.map((r) => ({
      id: r.id,
      goal: r.goal,
      model: r.model,
      provider: r.provider,
      status: r.status as Session['status'],
      createdAt: Number(r.created_at),
      completedAt: r.completed_at ? Number(r.completed_at) : undefined,
    }));
    return NextResponse.json(sessions);
  }

  // Fallback: JSONL files
  return NextResponse.json(await getSessionsFromFiles());
}

async function getSessionsFromFiles(): Promise<Session[]> {
  const dataDir = process.env.ORBITER_DATA_DIR;
  if (!dataDir) return [];

  const logDir = path.join(dataDir, 'logs');
  try {
    const files = await readdir(logDir);
    const jsonlFiles = files.filter(
      (f) => f.startsWith('llm-chat-') && f.endsWith('.jsonl'),
    );

    const sessions: Session[] = await Promise.all(
      jsonlFiles.map(async (f) => {
        const s = await stat(path.join(logDir, f));
        const sessionId = f.replace('llm-chat-', '').replace('.jsonl', '');
        return {
          id: sessionId,
          goal: sessionId,
          status: 'completed' as const,
          createdAt: s.mtimeMs,
        };
      }),
    );

    return sessions.sort((a, b) => b.createdAt - a.createdAt).slice(0, 50);
  } catch {
    return [];
  }
}
