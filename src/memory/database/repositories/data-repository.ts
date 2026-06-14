import { BaseRepository } from './base-repository.js';

export interface FlowRecord {
  id: string;
  sessionId: string | null;
  name: string;
  type: string;
  stepCount: number;
  createdAt: number;
}

export interface OutputRecord {
  id: number;
  sessionId: string | null;
  flowId: string | null;
  name: string;
  format: string;
  recordCount: number;
  createdAt: number;
}

export interface SettingRecord {
  key: string;
  value: string;
  valueType: string;
  category: string | null;
  description: string | null;
  updatedAt: number;
}

export class DataRepository extends BaseRepository<FlowRecord> {
  // ─── Flows ────────────────────────────────────────────────

  async saveFlow(flow: any, sessionId?: string | null): Promise<string> {
    const stepCount = Array.isArray(flow.steps) ? flow.steps.length : 0;
    await this.pool.query(
      `INSERT INTO orbiter_flows (id, session_id, name, type, step_count, flow_data, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET flow_data = EXCLUDED.flow_data, step_count = EXCLUDED.step_count`,
      [
        flow.id,
        sessionId ?? null,
        flow.name,
        flow.type ?? 'raw',
        stepCount,
        JSON.stringify(flow),
        this.now(),
      ],
    );
    return flow.id;
  }

  async loadFlow(id: string): Promise<any | null> {
    const result = await this.pool.query(
      `SELECT flow_data FROM orbiter_flows WHERE id = $1`,
      [id],
    );
    return result.rows[0]?.flow_data ?? null;
  }

  async listFlows(limit = 50): Promise<FlowRecord[]> {
    const result = await this.pool.query(
      `SELECT id, session_id, name, type, step_count, created_at
       FROM orbiter_flows ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return result.rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      name: row.name,
      type: row.type,
      stepCount: row.step_count,
      createdAt: Number(row.created_at),
    }));
  }

  // ─── Outputs ──────────────────────────────────────────────

  async saveOutput(
    name: string,
    format: 'json' | 'csv',
    data: any,
    csvContent: string | null,
    count: number,
    sessionId?: string | null,
    flowId?: string | null,
  ): Promise<number> {
    const result = await this.pool.query(
      `INSERT INTO orbiter_outputs (session_id, flow_id, name, format, record_count, data, csv_content, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        sessionId ?? null,
        flowId ?? null,
        name,
        format,
        count,
        data !== null ? JSON.stringify(data) : null,
        csvContent,
        this.now(),
      ],
    );
    return Number(result.rows[0].id);
  }

  async listOutputs(sessionId?: string, limit = 50): Promise<OutputRecord[]> {
    const values: any[] = [];
    let query = `SELECT id, session_id, flow_id, name, format, record_count, created_at FROM orbiter_outputs`;
    if (sessionId) {
      query += ` WHERE session_id = $1`;
      values.push(sessionId);
    }
    query += ` ORDER BY created_at DESC LIMIT $${values.length + 1}`;
    values.push(limit);
    const result = await this.pool.query(query, values);
    return result.rows.map((row) => ({
      id: Number(row.id),
      sessionId: row.session_id,
      flowId: row.flow_id,
      name: row.name,
      format: row.format,
      recordCount: row.record_count,
      createdAt: Number(row.created_at),
    }));
  }

  // ─── App Logs ─────────────────────────────────────────────

  logEntry(
    level: string,
    message: string,
    meta?: any,
    sessionId?: string | null,
  ): void {
    this.pool
      .query(
        `INSERT INTO orbiter_app_logs (level, message, meta, session_id, created_at) VALUES ($1, $2, $3, $4, $5)`,
        [
          level,
          String(message),
          meta ? JSON.stringify(meta) : null,
          sessionId ?? null,
          Date.now(),
        ],
      )
      .catch(() => {});
  }

  // ─── Error Captures ───────────────────────────────────────

  async saveErrorCapture(
    id: string,
    sessionId: string | null,
    errorType: string | null,
    errorMessage: string | null,
    url: string | null,
    screenshotBase64: string | null,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO orbiter_error_captures (id, session_id, error_type, error_message, url, screenshot_base64, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        sessionId,
        errorType,
        errorMessage,
        url,
        screenshotBase64,
        this.now(),
      ],
    );
  }

  // ─── Reports ──────────────────────────────────────────────

  async saveReport(
    sessionId: string | null,
    taskName: string,
    format: string,
    content: string,
    data: any,
  ): Promise<number> {
    const result = await this.pool.query(
      `INSERT INTO orbiter_reports (session_id, task_name, format, content, report_data, created_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        sessionId,
        taskName,
        format,
        content,
        data ? JSON.stringify(data) : null,
        this.now(),
      ],
    );
    return Number(result.rows[0].id);
  }

  // ─── Settings ─────────────────────────────────────────────

  async getSetting(key: string): Promise<string | null> {
    const result = await this.pool.query(
      `SELECT value FROM orbiter_settings WHERE key = $1`,
      [key],
    );
    return result.rows[0]?.value ?? null;
  }

  async setSetting(
    key: string,
    value: string,
    valueType = 'string',
    category?: string,
    description?: string,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO orbiter_settings (key, value, value_type, category, description, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, value_type = EXCLUDED.value_type, updated_at = EXCLUDED.updated_at`,
      [
        key,
        value,
        valueType,
        category ?? null,
        description ?? null,
        this.now(),
      ],
    );
  }

  async getAllSettings(): Promise<SettingRecord[]> {
    const result = await this.pool.query(
      `SELECT key, value, value_type, category, description, updated_at
       FROM orbiter_settings ORDER BY category, key`,
    );
    return result.rows.map((row) => ({
      key: row.key,
      value: row.value,
      valueType: row.value_type,
      category: row.category,
      description: row.description,
      updatedAt: Number(row.updated_at),
    }));
  }

  async seedSettings(cfg: any): Promise<void> {
    const entries: Array<{
      key: string;
      value: string;
      type: string;
      cat: string;
      desc: string;
    }> = [
      {
        key: 'llm.provider',
        value: String(cfg.llm?.provider ?? 'openrouter'),
        type: 'string',
        cat: 'llm',
        desc: 'LLM provider (openrouter, opencode-go, openai, anthropic)',
      },
      {
        key: 'llm.model',
        value: String(cfg.llm?.model ?? 'anthropic/claude-sonnet-4'),
        type: 'string',
        cat: 'llm',
        desc: 'Default LLM model',
      },
      {
        key: 'llm.maxTokens',
        value: String(cfg.llm?.maxTokens ?? 4096),
        type: 'number',
        cat: 'llm',
        desc: 'Max tokens per LLM response',
      },
      {
        key: 'llm.temperature',
        value: String(cfg.llm?.temperature ?? 0.7),
        type: 'number',
        cat: 'llm',
        desc: 'LLM temperature (0-2)',
      },
      {
        key: 'llm.vision',
        value: String(cfg.llm?.vision ?? 'auto'),
        type: 'string',
        cat: 'llm',
        desc: 'Vision mode: auto, enabled, disabled',
      },
      {
        key: 'llm.openrouterApiKey',
        value: String(cfg.llm?.openrouterApiKey ?? ''),
        type: 'string',
        cat: 'llm',
        desc: 'OpenRouter API Key',
      },
      {
        key: 'llm.opencodeApiKey',
        value: String(cfg.llm?.opencodeApiKey ?? ''),
        type: 'string',
        cat: 'llm',
        desc: 'OpenCode Go API Key',
      },
      {
        key: 'browser.headless',
        value: String(cfg.browser?.headless ?? false),
        type: 'boolean',
        cat: 'browser',
        desc: 'Run browser in headless mode',
      },
      {
        key: 'browser.defaultTimeout',
        value: String(cfg.browser?.defaultTimeout ?? 30000),
        type: 'number',
        cat: 'browser',
        desc: 'Default browser action timeout (ms)',
      },
      {
        key: 'browser.viewport.width',
        value: String(cfg.browser?.viewport?.width ?? 1280),
        type: 'number',
        cat: 'browser',
        desc: 'Browser viewport width (px)',
      },
      {
        key: 'browser.viewport.height',
        value: String(cfg.browser?.viewport?.height ?? 720),
        type: 'number',
        cat: 'browser',
        desc: 'Browser viewport height (px)',
      },
      {
        key: 'execution.maxSteps',
        value: String(cfg.execution?.maxSteps ?? 100),
        type: 'number',
        cat: 'execution',
        desc: 'Default max steps per execution run',
      },
      {
        key: 'execution.maxRetries',
        value: String(cfg.execution?.maxRetries ?? 3),
        type: 'number',
        cat: 'execution',
        desc: 'Max tool retry attempts on failure',
      },
      {
        key: 'execution.retryDelay',
        value: String(cfg.execution?.retryDelay ?? 1000),
        type: 'number',
        cat: 'execution',
        desc: 'Delay between retries (ms)',
      },
      {
        key: 'execution.screenshotOnError',
        value: String(cfg.execution?.screenshotOnError ?? true),
        type: 'boolean',
        cat: 'execution',
        desc: 'Capture screenshot on tool error',
      },
      {
        key: 'execution.screenshotOnStep',
        value: String(cfg.execution?.screenshotOnStep ?? false),
        type: 'boolean',
        cat: 'execution',
        desc: 'Capture screenshot after each step',
      },
      {
        key: 'promptEnhancer.enabled',
        value: String(cfg.promptEnhancer?.enabled ?? false),
        type: 'boolean',
        cat: 'promptEnhancer',
        desc: 'Enable AI prompt enhancement before execution',
      },
      {
        key: 'loop.defaultDelay.min',
        value: String(cfg.loop?.defaultDelay?.min ?? 800),
        type: 'number',
        cat: 'loop',
        desc: 'Min delay between loop iterations (ms)',
      },
      {
        key: 'loop.defaultDelay.max',
        value: String(cfg.loop?.defaultDelay?.max ?? 1500),
        type: 'number',
        cat: 'loop',
        desc: 'Max delay between loop iterations (ms)',
      },
      {
        key: 'loop.maxItems',
        value: String(cfg.loop?.maxItems ?? 100),
        type: 'number',
        cat: 'loop',
        desc: 'Max items to extract per loop run',
      },
      {
        key: 'loop.scrollPauseTime',
        value: String(cfg.loop?.scrollPauseTime ?? 1000),
        type: 'number',
        cat: 'loop',
        desc: 'Pause after scroll (ms)',
      },
      {
        key: 'recording.enabled',
        value: String(cfg.recording?.enabled ?? true),
        type: 'boolean',
        cat: 'recording',
        desc: 'Enable flow recording',
      },
      {
        key: 'recording.includeScreenshots',
        value: String(cfg.recording?.includeScreenshots ?? false),
        type: 'boolean',
        cat: 'recording',
        desc: 'Include screenshots in flow recording',
      },
      {
        key: 'logging.level',
        value: String(cfg.logging?.level ?? 'info'),
        type: 'string',
        cat: 'logging',
        desc: 'Log level: error, warn, info, debug, trace',
      },
      {
        key: 'logging.console.enabled',
        value: String(cfg.logging?.console?.enabled ?? true),
        type: 'boolean',
        cat: 'logging',
        desc: 'Enable console logging',
      },
      {
        key: 'logging.console.colorize',
        value: String(cfg.logging?.console?.colorize ?? true),
        type: 'boolean',
        cat: 'logging',
        desc: 'Colorize console output',
      },
    ];

    for (const e of entries) {
      await this.pool.query(
        `INSERT INTO orbiter_settings (key, value, value_type, category, description, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (key) DO NOTHING`,
        [e.key, e.value, e.type, e.cat, e.desc, this.now()],
      );
    }
  }

  async seedUserSettings(userId: string, cfg: any): Promise<void> {
    const entries: Array<{
      key: string;
      value: string;
      type: string;
      cat: string;
      desc: string;
    }> = [
      {
        key: 'llm.provider',
        value: String(cfg.llm?.provider ?? 'openrouter'),
        type: 'string',
        cat: 'llm',
        desc: 'LLM provider (openrouter, opencode-go, openai, anthropic)',
      },
      {
        key: 'llm.model',
        value: String(cfg.llm?.model ?? 'anthropic/claude-sonnet-4'),
        type: 'string',
        cat: 'llm',
        desc: 'Default LLM model',
      },
      {
        key: 'llm.maxTokens',
        value: String(cfg.llm?.maxTokens ?? 4096),
        type: 'number',
        cat: 'llm',
        desc: 'Max tokens per LLM response',
      },
      {
        key: 'llm.temperature',
        value: String(cfg.llm?.temperature ?? 0.7),
        type: 'number',
        cat: 'llm',
        desc: 'LLM temperature (0-2)',
      },
      {
        key: 'llm.vision',
        value: String(cfg.llm?.vision ?? 'auto'),
        type: 'string',
        cat: 'llm',
        desc: 'Vision mode: auto, enabled, disabled',
      },
      {
        key: 'llm.openrouterApiKey',
        value: String(cfg.llm?.openrouterApiKey ?? ''),
        type: 'string',
        cat: 'llm',
        desc: 'OpenRouter API Key',
      },
      {
        key: 'llm.opencodeApiKey',
        value: String(cfg.llm?.opencodeApiKey ?? ''),
        type: 'string',
        cat: 'llm',
        desc: 'OpenCode Go API Key',
      },
      {
        key: 'browser.headless',
        value: String(cfg.browser?.headless ?? false),
        type: 'boolean',
        cat: 'browser',
        desc: 'Run browser in headless mode',
      },
      {
        key: 'browser.defaultTimeout',
        value: String(cfg.browser?.defaultTimeout ?? 30000),
        type: 'number',
        cat: 'browser',
        desc: 'Default browser action timeout (ms)',
      },
      {
        key: 'browser.viewport.width',
        value: String(cfg.browser?.viewport?.width ?? 1280),
        type: 'number',
        cat: 'browser',
        desc: 'Browser viewport width (px)',
      },
      {
        key: 'browser.viewport.height',
        value: String(cfg.browser?.viewport?.height ?? 720),
        type: 'number',
        cat: 'browser',
        desc: 'Browser viewport height (px)',
      },
      {
        key: 'execution.maxSteps',
        value: String(cfg.execution?.maxSteps ?? 100),
        type: 'number',
        cat: 'execution',
        desc: 'Default max steps per execution run',
      },
      {
        key: 'execution.maxRetries',
        value: String(cfg.execution?.maxRetries ?? 3),
        type: 'number',
        cat: 'execution',
        desc: 'Max tool retry attempts on failure',
      },
      {
        key: 'execution.retryDelay',
        value: String(cfg.execution?.retryDelay ?? 1000),
        type: 'number',
        cat: 'execution',
        desc: 'Delay between retries (ms)',
      },
      {
        key: 'execution.screenshotOnError',
        value: String(cfg.execution?.screenshotOnError ?? true),
        type: 'boolean',
        cat: 'execution',
        desc: 'Capture screenshot on tool error',
      },
      {
        key: 'execution.screenshotOnStep',
        value: String(cfg.execution?.screenshotOnStep ?? false),
        type: 'boolean',
        cat: 'execution',
        desc: 'Capture screenshot after each step',
      },
      {
        key: 'promptEnhancer.enabled',
        value: String(cfg.promptEnhancer?.enabled ?? false),
        type: 'boolean',
        cat: 'promptEnhancer',
        desc: 'Enable AI prompt enhancement before execution',
      },
      {
        key: 'loop.defaultDelay.min',
        value: String(cfg.loop?.defaultDelay?.min ?? 800),
        type: 'number',
        cat: 'loop',
        desc: 'Min delay between loop iterations (ms)',
      },
      {
        key: 'loop.defaultDelay.max',
        value: String(cfg.loop?.defaultDelay?.max ?? 1500),
        type: 'number',
        cat: 'loop',
        desc: 'Max delay between loop iterations (ms)',
      },
      {
        key: 'loop.maxItems',
        value: String(cfg.loop?.maxItems ?? 100),
        type: 'number',
        cat: 'loop',
        desc: 'Max items to extract per loop run',
      },
      {
        key: 'loop.scrollPauseTime',
        value: String(cfg.loop?.scrollPauseTime ?? 1000),
        type: 'number',
        cat: 'loop',
        desc: 'Pause after scroll (ms)',
      },
      {
        key: 'recording.enabled',
        value: String(cfg.recording?.enabled ?? true),
        type: 'boolean',
        cat: 'recording',
        desc: 'Enable flow recording',
      },
      {
        key: 'recording.includeScreenshots',
        value: String(cfg.recording?.includeScreenshots ?? false),
        type: 'boolean',
        cat: 'recording',
        desc: 'Include screenshots in flow recording',
      },
      {
        key: 'logging.level',
        value: String(cfg.logging?.level ?? 'info'),
        type: 'string',
        cat: 'logging',
        desc: 'Log level: error, warn, info, debug, trace',
      },
      {
        key: 'logging.console.enabled',
        value: String(cfg.logging?.console?.enabled ?? true),
        type: 'boolean',
        cat: 'logging',
        desc: 'Enable console logging',
      },
      {
        key: 'logging.console.colorize',
        value: String(cfg.logging?.console?.colorize ?? true),
        type: 'boolean',
        cat: 'logging',
        desc: 'Colorize console output',
      },
    ];

    for (const e of entries) {
      await this.pool.query(
        `INSERT INTO orbiter_user_settings (user_id, key, value, value_type, category, description, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id, key) DO NOTHING`,
        [userId, e.key, e.value, e.type, e.cat, e.desc, this.now()],
      );
    }
  }

  async getUserSettings(userId: string): Promise<SettingRecord[]> {
    const res = await this.pool.query(
      `SELECT key, value, value_type as "valueType", category, description, updated_at as "updatedAt" 
       FROM orbiter_user_settings WHERE user_id = $1`,
      [userId]
    );
    return res.rows;
  }

  async updateUserSettings(userId: string, settings: { key: string; value: string }[]): Promise<void> {
    const timestamp = Date.now();
    for (const s of settings) {
      await this.pool.query(
        `INSERT INTO orbiter_user_settings (user_id, key, value, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
        [userId, s.key, s.value, timestamp]
      );
    }
  }
}
