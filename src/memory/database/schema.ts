export const SCHEMA_VERSION = 7;


export const CREATE_TABLES_SQL = `
-- ═══════════════════════════════════════════════════════
-- MEMORY TABLES
-- ═══════════════════════════════════════════════════════

-- Main memories table (base for all memory types)
CREATE TABLE IF NOT EXISTS orbiter_memories (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  domain TEXT NOT NULL,
  url_pattern TEXT,
  key TEXT NOT NULL,
  confidence REAL DEFAULT 0.5,
  usage_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  learned_from TEXT DEFAULT 'execution',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  last_used_at BIGINT,
  last_success_at BIGINT,
  expires_at BIGINT,
  is_active INTEGER DEFAULT 1
);

-- Indexes for memories
CREATE INDEX IF NOT EXISTS idx_orbiter_memories_type ON orbiter_memories(type);
CREATE INDEX IF NOT EXISTS idx_orbiter_memories_domain ON orbiter_memories(domain);
CREATE INDEX IF NOT EXISTS idx_orbiter_memories_key ON orbiter_memories(key);
CREATE INDEX IF NOT EXISTS idx_orbiter_memories_confidence ON orbiter_memories(confidence);
CREATE INDEX IF NOT EXISTS idx_orbiter_memories_domain_type ON orbiter_memories(domain, type);

-- ═══════════════════════════════════════════════════════
-- SELECTORS TABLE
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS orbiter_selectors (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  element_name TEXT NOT NULL,
  element_type TEXT NOT NULL,
  primary_selector TEXT NOT NULL,
  page_url_pattern TEXT,
  description TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  FOREIGN KEY (memory_id) REFERENCES orbiter_memories(id) ON DELETE CASCADE
);

-- Selector fallbacks (multiple per selector)
CREATE TABLE IF NOT EXISTS orbiter_selector_fallbacks (
  id BIGSERIAL PRIMARY KEY,
  selector_id TEXT NOT NULL,
  fallback_selector TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  FOREIGN KEY (selector_id) REFERENCES orbiter_selectors(id) ON DELETE CASCADE
);

-- Indexes for selectors
CREATE INDEX IF NOT EXISTS idx_orbiter_selectors_domain ON orbiter_selectors(domain);
CREATE INDEX IF NOT EXISTS idx_orbiter_selectors_element_name ON orbiter_selectors(element_name);
CREATE INDEX IF NOT EXISTS idx_orbiter_selectors_domain_element ON orbiter_selectors(domain, element_name);

-- ═══════════════════════════════════════════════════════
-- ERROR PATTERNS TABLE
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS orbiter_error_patterns (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  error_type TEXT NOT NULL,
  failed_selector TEXT,
  failed_tool TEXT,
  working_selector TEXT,
  recovery_strategy TEXT NOT NULL,
  context TEXT,
  page_url_pattern TEXT,
  created_at BIGINT NOT NULL,
  FOREIGN KEY (memory_id) REFERENCES orbiter_memories(id) ON DELETE CASCADE
);

-- Indexes for error patterns
CREATE INDEX IF NOT EXISTS idx_orbiter_error_patterns_domain ON orbiter_error_patterns(domain);
CREATE INDEX IF NOT EXISTS idx_orbiter_error_patterns_error_type ON orbiter_error_patterns(error_type);
CREATE INDEX IF NOT EXISTS idx_orbiter_error_patterns_failed_selector ON orbiter_error_patterns(failed_selector);

-- ═══════════════════════════════════════════════════════
-- SCHEMA VERSION TABLE
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS orbiter_schema_version (
  version INTEGER PRIMARY KEY,
  applied_at BIGINT NOT NULL
);

-- Insert initial schema version
INSERT INTO orbiter_schema_version (version, applied_at)
VALUES (1, EXTRACT(EPOCH FROM NOW())::bigint * 1000)
ON CONFLICT DO NOTHING;
`;

export const MIGRATIONS: Record<number, string> = {
  2: `
    -- ═══════════════════════════════════════════════════════
    -- SESSION MEMORY TABLES (v2)
    -- ═══════════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS orbiter_sessions (
      id TEXT PRIMARY KEY,
      goal TEXT NOT NULL,
      model TEXT,
      provider TEXT,
      status TEXT DEFAULT 'running',
      created_at BIGINT NOT NULL,
      completed_at BIGINT
    );

    CREATE TABLE IF NOT EXISTS orbiter_session_steps (
      id BIGSERIAL PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES orbiter_sessions(id) ON DELETE CASCADE,
      step_number INTEGER NOT NULL,
      tool_name TEXT NOT NULL,
      params JSONB NOT NULL DEFAULT '{}',
      result_summary TEXT NOT NULL,
      full_result JSONB,
      success BOOLEAN NOT NULL,
      duration INTEGER,
      created_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_orbiter_session_steps_session ON orbiter_session_steps(session_id);
    CREATE INDEX IF NOT EXISTS idx_orbiter_session_steps_step ON orbiter_session_steps(session_id, step_number);

    CREATE TABLE IF NOT EXISTS orbiter_session_dom_snapshots (
      id BIGSERIAL PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES orbiter_sessions(id) ON DELETE CASCADE,
      step_number INTEGER NOT NULL,
      url TEXT NOT NULL,
      title TEXT,
      interactive_elements JSONB,
      full_analysis JSONB,
      created_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_orbiter_dom_snapshots_session ON orbiter_session_dom_snapshots(session_id);
    CREATE INDEX IF NOT EXISTS idx_orbiter_dom_snapshots_step ON orbiter_session_dom_snapshots(session_id, step_number);

    CREATE TABLE IF NOT EXISTS orbiter_session_collected_data (
      id BIGSERIAL PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES orbiter_sessions(id) ON DELETE CASCADE,
      step_number INTEGER NOT NULL,
      tool_name TEXT NOT NULL,
      data JSONB NOT NULL,
      created_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_orbiter_collected_data_session ON orbiter_session_collected_data(session_id);
  `,

  3: `
    -- ═══════════════════════════════════════════════════════
    -- LLM CHAT LOG TABLE (v3)
    -- ═══════════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS orbiter_llm_interactions (
      id BIGSERIAL PRIMARY KEY,
      session_id TEXT REFERENCES orbiter_sessions(id) ON DELETE CASCADE,
      call_index INTEGER NOT NULL,
      full_messages JSONB NOT NULL,
      response_content TEXT,
      tool_calls JSONB,
      finish_reason TEXT,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      total_tokens INTEGER,
      duration_ms INTEGER,
      timestamp BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_orbiter_llm_interactions_session ON orbiter_llm_interactions(session_id);
    CREATE INDEX IF NOT EXISTS idx_orbiter_llm_interactions_call ON orbiter_llm_interactions(session_id, call_index);
  `,

  4: `
    -- ═══════════════════════════════════════════════════════
    -- DATA STORAGE TABLES (v4)
    -- Replaces file-based storage for flows, outputs, logs,
    -- error captures, reports, and dynamic settings.
    -- ═══════════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS orbiter_flows (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES orbiter_sessions(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'raw',
      step_count INTEGER DEFAULT 0,
      flow_data JSONB NOT NULL,
      created_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_orbiter_flows_session ON orbiter_flows(session_id);
    CREATE INDEX IF NOT EXISTS idx_orbiter_flows_created ON orbiter_flows(created_at DESC);

    CREATE TABLE IF NOT EXISTS orbiter_outputs (
      id BIGSERIAL PRIMARY KEY,
      session_id TEXT REFERENCES orbiter_sessions(id) ON DELETE SET NULL,
      flow_id TEXT REFERENCES orbiter_flows(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      format TEXT NOT NULL,
      record_count INTEGER DEFAULT 0,
      data JSONB,
      csv_content TEXT,
      created_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_orbiter_outputs_session ON orbiter_outputs(session_id);
    CREATE INDEX IF NOT EXISTS idx_orbiter_outputs_created ON orbiter_outputs(created_at DESC);

    CREATE TABLE IF NOT EXISTS orbiter_app_logs (
      id BIGSERIAL PRIMARY KEY,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      meta JSONB,
      session_id TEXT,
      created_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_orbiter_app_logs_level ON orbiter_app_logs(level);
    CREATE INDEX IF NOT EXISTS idx_orbiter_app_logs_session ON orbiter_app_logs(session_id);
    CREATE INDEX IF NOT EXISTS idx_orbiter_app_logs_created ON orbiter_app_logs(created_at DESC);

    CREATE TABLE IF NOT EXISTS orbiter_error_captures (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES orbiter_sessions(id) ON DELETE SET NULL,
      error_type TEXT,
      error_message TEXT,
      url TEXT,
      screenshot_base64 TEXT,
      created_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_orbiter_error_captures_session ON orbiter_error_captures(session_id);
    CREATE INDEX IF NOT EXISTS idx_orbiter_error_captures_created ON orbiter_error_captures(created_at DESC);

    CREATE TABLE IF NOT EXISTS orbiter_reports (
      id BIGSERIAL PRIMARY KEY,
      session_id TEXT REFERENCES orbiter_sessions(id) ON DELETE SET NULL,
      task_name TEXT NOT NULL,
      format TEXT NOT NULL,
      content TEXT NOT NULL,
      report_data JSONB,
      created_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_orbiter_reports_session ON orbiter_reports(session_id);
    CREATE INDEX IF NOT EXISTS idx_orbiter_reports_created ON orbiter_reports(created_at DESC);

    CREATE TABLE IF NOT EXISTS orbiter_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      value_type TEXT NOT NULL DEFAULT 'string',
      category TEXT,
      description TEXT,
      updated_at BIGINT NOT NULL
    );
  `,

  5: `
    -- ═══════════════════════════════════════════════════════
    -- VECTOR MEMORY TABLES (v5)
    -- ═══════════════════════════════════════════════════════

    CREATE EXTENSION IF NOT EXISTS vector;

    CREATE TABLE IF NOT EXISTS orbiter_vector_memories (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES orbiter_sessions(id) ON DELETE SET NULL,
      domain TEXT NOT NULL,
      task_summary TEXT NOT NULL,
      context_json JSONB NOT NULL,
      embedding vector(384),
      created_at BIGINT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_orbiter_vector_memories_domain ON orbiter_vector_memories(domain);
  `,

  6: `
    -- ═══════════════════════════════════════════════════════
    -- USER AUTH TABLES (v6)
    -- ═══════════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS orbiter_users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at BIGINT NOT NULL
    );
  `,

  7: `
    -- ═══════════════════════════════════════════════════════
    -- USER SETTINGS & USER ASSOCIATION (v7)
    -- ═══════════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS orbiter_user_settings (
      user_id TEXT NOT NULL REFERENCES orbiter_users(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      value_type TEXT NOT NULL DEFAULT 'string',
      category TEXT,
      description TEXT,
      updated_at BIGINT NOT NULL,
      PRIMARY KEY (user_id, key)
    );

    ALTER TABLE orbiter_sessions ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES orbiter_users(id) ON DELETE SET NULL;
    ALTER TABLE orbiter_flows ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES orbiter_users(id) ON DELETE SET NULL;
  `,
};

