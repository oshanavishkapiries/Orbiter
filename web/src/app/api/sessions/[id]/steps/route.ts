import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { Step } from '@/lib/types';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const rows = await query<{
    step_number: number;
    tool_name: string;
    params: unknown;
    result_summary: string;
    success: boolean;
    duration: number | null;
    created_at: string;
  }>(
    `SELECT step_number, tool_name, params, result_summary, success, duration, created_at
     FROM session_steps
     WHERE session_id = $1
     ORDER BY step_number ASC`,
    [id],
  );

  const steps: Step[] = rows.map((r) => ({
    stepNumber: r.step_number,
    toolName: r.tool_name,
    params: (r.params as Record<string, unknown>) ?? {},
    resultSummary: r.result_summary,
    success: r.success,
    duration: r.duration ?? undefined,
    createdAt: Number(r.created_at),
  }));

  return NextResponse.json(steps);
}
