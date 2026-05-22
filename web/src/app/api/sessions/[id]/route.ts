import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { Session } from '@/lib/types';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

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
     FROM sessions WHERE id = $1`,
    [id],
  );

  if (!rows[0]) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const r = rows[0];
  const session: Session = {
    id: r.id,
    goal: r.goal,
    model: r.model,
    provider: r.provider,
    status: r.status as Session['status'],
    createdAt: Number(r.created_at),
    completedAt: r.completed_at ? Number(r.completed_at) : undefined,
  };

  return NextResponse.json(session);
}
