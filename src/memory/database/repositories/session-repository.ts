import { BaseRepository } from './base-repository.js';

export interface SessionRecord {
  id: string;
  goal: string;
  title?: string;
  model?: string;
  provider?: string;
  status: 'running' | 'completed' | 'failed';
  createdAt: number;
  completedAt?: number;
}

export interface StepRecord {
  stepNumber: number;
  toolName: string;
  params: any;
  resultSummary: string;
  fullResult?: any;
  success: boolean;
  duration?: number;
  createdAt: number;
}

export interface DomSnapshot {
  stepNumber: number;
  url: string;
  title?: string;
  interactiveElements?: any[];
  fullAnalysis?: any;
  createdAt: number;
}

export interface CollectedDataRecord {
  stepNumber: number;
  toolName: string;
  data: any;
  createdAt: number;
}

export interface LLMInteractionRecord {
  id: number;
  sessionId: string;
  callIndex: number;
  fullMessages: any[];
  responseContent: string | null;
  toolCalls: any[] | null;
  finishReason: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs: number;
  timestamp: number;
}

export interface AppLogRecord {
  level: string;
  message: string;
  meta: any;
  createdAt: number;
}

export class SessionRepository extends BaseRepository<SessionRecord> {
  async getSessionLogs(sessionId: string): Promise<AppLogRecord[]> {
    const result = await this.pool.query(
      `SELECT level, message, meta, created_at as "createdAt"
       FROM orbiter_app_logs
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [sessionId],
    );
    return result.rows.map((row) => ({
      level: row.level,
      message: row.message,
      meta: row.meta,
      createdAt: Number(row.createdAt),
    }));
  }

  async createSession(
    goal: string,
    model?: string,
    provider?: string,
    userId?: string,
    title?: string,
  ): Promise<string> {
    const id = this.generateId('sess');
    const finalTitle = title || 'New Session';
    await this.pool.query(
      `INSERT INTO orbiter_sessions (id, goal, model, provider, status, created_at, user_id, title)
       VALUES ($1, $2, $3, $4, 'running', $5, $6, $7)`,
      [
        id,
        goal,
        model ?? null,
        provider ?? null,
        this.now(),
        userId ?? null,
        finalTitle,
      ],
    );
    return id;
  }

  async updateSessionTitle(sessionId: string, title: string): Promise<void> {
    await this.pool.query(
      `UPDATE orbiter_sessions SET title = $1 WHERE id = $2`,
      [title, sessionId],
    );
  }

  async completeSession(
    sessionId: string,
    status: 'completed' | 'failed' = 'completed',
  ): Promise<void> {
    await this.pool.query(
      `UPDATE orbiter_sessions SET status = $1, completed_at = $2 WHERE id = $3`,
      [status, this.now(), sessionId],
    );
  }

  async storeStep(
    sessionId: string,
    stepNumber: number,
    toolName: string,
    params: any,
    resultSummary: string,
    fullResult: any,
    success: boolean,
    duration?: number,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO orbiter_session_steps
         (session_id, step_number, tool_name, params, result_summary, full_result, success, duration, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        sessionId,
        stepNumber,
        toolName,
        JSON.stringify(params),
        resultSummary,
        fullResult !== undefined ? JSON.stringify(fullResult) : null,
        success,
        duration ?? null,
        this.now(),
      ],
    );
  }

  async storeDomSnapshot(
    sessionId: string,
    stepNumber: number,
    url: string,
    title: string | undefined,
    interactiveElements: any[] | undefined,
    fullAnalysis: any,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO orbiter_session_dom_snapshots
         (session_id, step_number, url, title, interactive_elements, full_analysis, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        sessionId,
        stepNumber,
        url,
        title ?? null,
        interactiveElements ? JSON.stringify(interactiveElements) : null,
        fullAnalysis ? JSON.stringify(fullAnalysis) : null,
        this.now(),
      ],
    );
  }

  async storeCollectedData(
    sessionId: string,
    stepNumber: number,
    toolName: string,
    data: any,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO orbiter_session_collected_data (session_id, step_number, tool_name, data, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [sessionId, stepNumber, toolName, JSON.stringify(data), this.now()],
    );
  }

  async getStepHistory(
    sessionId: string,
    fromStep?: number,
    toStep?: number,
  ): Promise<StepRecord[]> {
    let query = `
      SELECT step_number, tool_name, params, result_summary, success, duration, created_at
      FROM orbiter_session_steps
      WHERE session_id = $1
    `;
    const values: any[] = [sessionId];

    if (fromStep !== undefined) {
      values.push(fromStep);
      query += ` AND step_number >= $${values.length}`;
    }
    if (toStep !== undefined) {
      values.push(toStep);
      query += ` AND step_number <= $${values.length}`;
    }

    query += ' ORDER BY step_number ASC';

    const result = await this.pool.query(query, values);
    return result.rows.map((row) => ({
      stepNumber: row.step_number,
      toolName: row.tool_name,
      params: row.params,
      resultSummary: row.result_summary,
      success: row.success,
      duration: row.duration,
      createdAt: Number(row.created_at),
    }));
  }

  async getFullStepResult(
    sessionId: string,
    stepNumber: number,
  ): Promise<any | null> {
    const result = await this.pool.query(
      `SELECT full_result FROM orbiter_session_steps WHERE session_id = $1 AND step_number = $2`,
      [sessionId, stepNumber],
    );
    return result.rows[0]?.full_result ?? null;
  }

  async getDomSnapshot(
    sessionId: string,
    stepNumber?: number,
  ): Promise<DomSnapshot | null> {
    let query = `
      SELECT step_number, url, title, interactive_elements, full_analysis, created_at
      FROM orbiter_session_dom_snapshots
      WHERE session_id = $1
    `;
    const values: any[] = [sessionId];

    if (stepNumber !== undefined) {
      values.push(stepNumber);
      query += ` AND step_number = $${values.length}`;
    }

    query += ' ORDER BY id DESC LIMIT 1';

    const result = await this.pool.query(query, values);
    if (!result.rows[0]) return null;

    const row = result.rows[0];
    return {
      stepNumber: row.step_number,
      url: row.url,
      title: row.title,
      interactiveElements: row.interactive_elements,
      fullAnalysis: row.full_analysis,
      createdAt: Number(row.created_at),
    };
  }

  async getAllCollectedData(sessionId: string): Promise<CollectedDataRecord[]> {
    const result = await this.pool.query(
      `SELECT step_number, tool_name, data, created_at
       FROM orbiter_session_collected_data
       WHERE session_id = $1
       ORDER BY step_number ASC`,
      [sessionId],
    );
    return result.rows.map((row) => ({
      stepNumber: row.step_number,
      toolName: row.tool_name,
      data: row.data,
      createdAt: Number(row.created_at),
    }));
  }

  // ─── LLM Interaction Log ────────────────────────────────

  async storeLLMInteraction(
    sessionId: string,
    callIndex: number,
    fullMessages: any[],
    responseContent: string | null,
    toolCalls: any[] | null,
    finishReason: string | null,
    promptTokens: number,
    completionTokens: number,
    totalTokens: number,
    durationMs: number,
    timestamp: number,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO orbiter_llm_interactions
         (session_id, call_index, full_messages, response_content, tool_calls,
          finish_reason, prompt_tokens, completion_tokens, total_tokens, duration_ms, timestamp)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        sessionId,
        callIndex,
        JSON.stringify(fullMessages),
        responseContent,
        toolCalls ? JSON.stringify(toolCalls) : null,
        finishReason,
        promptTokens,
        completionTokens,
        totalTokens,
        durationMs,
        timestamp,
      ],
    );
  }

  async getLLMInteractions(sessionId: string): Promise<LLMInteractionRecord[]> {
    const result = await this.pool.query(
      `SELECT id, session_id, call_index, full_messages, response_content,
              tool_calls, finish_reason, prompt_tokens, completion_tokens,
              total_tokens, duration_ms, timestamp
       FROM orbiter_llm_interactions
       WHERE session_id = $1
       ORDER BY call_index ASC`,
      [sessionId],
    );
    return result.rows.map((row) => ({
      id: Number(row.id),
      sessionId: row.session_id,
      callIndex: row.call_index,
      fullMessages: row.full_messages ?? [],
      responseContent: row.response_content,
      toolCalls: row.tool_calls ?? null,
      finishReason: row.finish_reason,
      promptTokens: row.prompt_tokens ?? 0,
      completionTokens: row.completion_tokens ?? 0,
      totalTokens: row.total_tokens ?? 0,
      durationMs: row.duration_ms ?? 0,
      timestamp: Number(row.timestamp),
    }));
  }

  async listSessions(limit = 50): Promise<SessionRecord[]> {
    const result = await this.pool.query(
      `SELECT id, goal, title, model, provider, status, created_at, completed_at
       FROM orbiter_sessions
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit],
    );
    return result.rows.map((row) => ({
      id: row.id,
      goal: row.goal,
      title: row.title,
      model: row.model,
      provider: row.provider,
      status: row.status,
      createdAt: Number(row.created_at),
      completedAt: row.completed_at ? Number(row.completed_at) : undefined,
    }));
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const res = await this.pool.query(
      `DELETE FROM orbiter_sessions WHERE id = $1`,
      [sessionId]
    );
    return (res.rowCount ?? 0) > 0;
  }
}
