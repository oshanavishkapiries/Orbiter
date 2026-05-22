import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { CollectedData } from '@/lib/types';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const rows = await query<{
    step_number: number;
    tool_name: string;
    data: unknown;
    created_at: string;
  }>(
    `SELECT step_number, tool_name, data, created_at
     FROM session_collected_data
     WHERE session_id = $1
     ORDER BY step_number ASC`,
    [id],
  );

  const collected: CollectedData[] = rows.map((r) => ({
    stepNumber: r.step_number,
    toolName: r.tool_name,
    data: r.data,
    createdAt: Number(r.created_at),
  }));

  return NextResponse.json(collected);
}
