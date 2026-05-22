import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { readFile } from 'fs/promises';
import path from 'path';
import { LLMInteraction } from '@/lib/types';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const rows = await query<{
    id: number;
    session_id: string;
    call_index: number;
    full_messages: unknown;
    response_content: string | null;
    tool_calls: unknown | null;
    finish_reason: string | null;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    duration_ms: number;
    timestamp: string;
  }>(
    `SELECT id, session_id, call_index, full_messages, response_content,
            tool_calls, finish_reason, prompt_tokens, completion_tokens,
            total_tokens, duration_ms, timestamp
     FROM llm_interactions
     WHERE session_id = $1
     ORDER BY call_index ASC`,
    [id],
  );

  if (rows.length > 0) {
    const interactions: LLMInteraction[] = rows.map((r) => ({
      id: Number(r.id),
      sessionId: r.session_id,
      callIndex: r.call_index,
      fullMessages: (r.full_messages as LLMInteraction['fullMessages']) ?? [],
      responseContent: r.response_content,
      toolCalls: (r.tool_calls as LLMInteraction['toolCalls']) ?? null,
      finishReason: r.finish_reason,
      promptTokens: r.prompt_tokens ?? 0,
      completionTokens: r.completion_tokens ?? 0,
      totalTokens: r.total_tokens ?? 0,
      durationMs: r.duration_ms ?? 0,
      timestamp: Number(r.timestamp),
    }));
    return NextResponse.json(interactions);
  }

  // Fallback: JSONL file
  const dataDir = process.env.ORBITER_DATA_DIR;
  if (!dataDir) return NextResponse.json([]);

  const filePath = path.join(dataDir, 'logs', `llm-chat-${id}.jsonl`);
  try {
    const text = await readFile(filePath, 'utf-8');
    const lines = text.trim().split('\n').filter(Boolean);
    const interactions: LLMInteraction[] = lines
      .map((line) => {
        try {
          const e = JSON.parse(line);
          return {
            id: e.callIndex,
            sessionId: e.sessionId,
            callIndex: e.callIndex,
            fullMessages: e.messages ?? [],
            responseContent: e.response?.content ?? null,
            toolCalls: e.response?.toolCalls ?? null,
            finishReason: e.response?.finishReason ?? null,
            promptTokens: e.response?.usage?.promptTokens ?? 0,
            completionTokens: e.response?.usage?.completionTokens ?? 0,
            totalTokens: e.response?.usage?.totalTokens ?? 0,
            durationMs: e.durationMs ?? 0,
            timestamp: e.timestamp ?? 0,
          } as LLMInteraction;
        } catch {
          return null;
        }
      })
      .filter((x): x is LLMInteraction => x !== null);

    return NextResponse.json(interactions);
  } catch {
    return NextResponse.json([]);
  }
}
