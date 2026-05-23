export const SCHEMA_VERSION = 4;

export const CREATE_TABLES_SQL = `
-- ═══════════════════════════════════════════════════════
-- MEMORY TABLES
-- ═══════════════════════════════════════════════════════

-- Main memories table (base for all memory types)
CREATE TABLE IF NOT EXISTS memories (
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
CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
CREATE INDEX IF NOT EXISTS idx_memories_domain ON memories(domain);
CREATE INDEX IF NOT EXISTS idx_memories_key ON memories(key);
CREATE INDEX IF NOT EXISTS idx_memories_confidence ON memories(confidence);
CREATE INDEX IF NOT EXISTS idx_memories_domain_type ON memories(domain, type);

-- ═══════════════════════════════════════════════════════
-- SELECTORS TABLE
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS selectors (
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
  FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);

-- Selector fallbacks (multiple per selector)
CREATE TABLE IF NOT EXISTS selector_fallbacks (
  id BIGSERIAL PRIMARY KEY,
  selector_id TEXT NOT NULL,
  fallback_selector TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  FOREIGN KEY (selector_id) REFERENCES selectors(id) ON DELETE CASCADE
);

-- Indexes for selectors
CREATE INDEX IF NOT EXISTS idx_selectors_domain ON selectors(domain);
CREATE INDEX IF NOT EXISTS idx_selectors_element_name ON selectors(element_name);
CREATE INDEX IF NOT EXISTS idx_selectors_domain_element ON selectors(domain, element_name);

-- ═══════════════════════════════════════════════════════
-- ERROR PATTERNS TABLE
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS error_patterns (
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
  FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);

-- Indexes for error patterns
CREATE INDEX IF NOT EXISTS idx_error_patterns_domain ON error_patterns(domain);
CREATE INDEX IF NOT EXISTS idx_error_patterns_error_type ON error_patterns(error_type);
CREATE INDEX IF NOT EXISTS idx_error_patterns_failed_selector ON error_patterns(failed_selector);

-- ═══════════════════════════════════════════════════════
-- SITE BEHAVIORS TABLE
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS site_behaviors (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  behavior TEXT NOT NULL,
  workaround TEXT,
  severity TEXT DEFAULT 'info',
  auto_handle INTEGER DEFAULT 0,
  details_json TEXT,
  created_at BIGINT NOT NULL,
  FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);

-- Indexes for site behaviors
CREATE INDEX IF NOT EXISTS idx_site_behaviors_domain ON site_behaviors(domain);
CREATE INDEX IF NOT EXISTS idx_site_behaviors_behavior ON site_behaviors(behavior);

-- ═══════════════════════════════════════════════════════
-- PAGE STRUCTURES TABLE
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS page_structures (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  url_pattern TEXT NOT NULL,
  page_type TEXT,
  title_pattern TEXT,
  structure_json TEXT NOT NULL,
  key_elements_json TEXT,
  forms_json TEXT,
  lists_json TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);

-- Indexes for page structures
CREATE INDEX IF NOT EXISTS idx_page_structures_domain ON page_structures(domain);
CREATE INDEX IF NOT EXISTS idx_page_structures_url_pattern ON page_structures(url_pattern);

-- ═══════════════════════════════════════════════════════
-- SUCCESSFUL FLOWS TABLE
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS successful_flows (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  flow_name TEXT NOT NULL,
  goal_pattern TEXT,
  steps_json TEXT NOT NULL,
  success_rate REAL DEFAULT 1.0,
  average_duration INTEGER,
  execution_count INTEGER DEFAULT 1,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);

-- Indexes for successful flows
CREATE INDEX IF NOT EXISTS idx_successful_flows_domain ON successful_flows(domain);
CREATE INDEX IF NOT EXISTS idx_successful_flows_goal ON successful_flows(goal_pattern);

-- ═══════════════════════════════════════════════════════
-- USAGE LOGS TABLE (for analytics)
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS usage_logs (
  id BIGSERIAL PRIMARY KEY,
  memory_id TEXT NOT NULL,
  action TEXT NOT NULL,
  result TEXT NOT NULL,
  context_json TEXT,
  created_at BIGINT NOT NULL,
  FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);

-- Index for usage logs
CREATE INDEX IF NOT EXISTS idx_usage_logs_memory_id ON usage_logs(memory_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);

-- ═══════════════════════════════════════════════════════
-- SCHEMA VERSION TABLE
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at BIGINT NOT NULL
);

-- Insert initial schema version
INSERT INTO schema_version (version, applied_at)
VALUES (1, EXTRACT(EPOCH FROM NOW())::bigint * 1000)
ON CONFLICT DO NOTHING;
`;

export const MIGRATIONS: Record<number, string> = {
  2: `
    -- ═══════════════════════════════════════════════════════
    -- SESSION MEMORY TABLES (v2)
    -- ═══════════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      goal TEXT NOT NULL,
      model TEXT,
      provider TEXT,
      status TEXT DEFAULT 'running',
      created_at BIGINT NOT NULL,
      completed_at BIGINT
    );

    CREATE TABLE IF NOT EXISTS session_steps (
      id BIGSERIAL PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      step_number INTEGER NOT NULL,
      tool_name TEXT NOT NULL,
      params JSONB NOT NULL DEFAULT '{}',
      result_summary TEXT NOT NULL,
      full_result JSONB,
      success BOOLEAN NOT NULL,
      duration INTEGER,
      created_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_session_steps_session ON session_steps(session_id);
    CREATE INDEX IF NOT EXISTS idx_session_steps_step ON session_steps(session_id, step_number);

    CREATE TABLE IF NOT EXISTS session_dom_snapshots (
      id BIGSERIAL PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      step_number INTEGER NOT NULL,
      url TEXT NOT NULL,
      title TEXT,
      interactive_elements JSONB,
      full_analysis JSONB,
      created_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_dom_snapshots_session ON session_dom_snapshots(session_id);
    CREATE INDEX IF NOT EXISTS idx_dom_snapshots_step ON session_dom_snapshots(session_id, step_number);

    CREATE TABLE IF NOT EXISTS session_collected_data (
      id BIGSERIAL PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      step_number INTEGER NOT NULL,
      tool_name TEXT NOT NULL,
      data JSONB NOT NULL,
      created_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_collected_data_session ON session_collected_data(session_id);
  `,

  3: `
    -- ═══════════════════════════════════════════════════════
    -- LLM CHAT LOG TABLE (v3)
    -- ═══════════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS llm_interactions (
      id BIGSERIAL PRIMARY KEY,
      session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
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
    CREATE INDEX IF NOT EXISTS idx_llm_interactions_session ON llm_interactions(session_id);
    CREATE INDEX IF NOT EXISTS idx_llm_interactions_call ON llm_interactions(session_id, call_index);
  `,

  4: `
    -- ═══════════════════════════════════════════════════════
    -- DATA STORAGE TABLES (v4)
    -- Replaces file-based storage for flows, outputs, logs,
    -- error captures, reports, and dynamic settings.
    -- ═══════════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS flows (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'raw',
      step_count INTEGER DEFAULT 0,
      flow_data JSONB NOT NULL,
      created_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_flows_session ON flows(session_id);
    CREATE INDEX IF NOT EXISTS idx_flows_created ON flows(created_at DESC);

    CREATE TABLE IF NOT EXISTS outputs (
      id BIGSERIAL PRIMARY KEY,
      session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
      flow_id TEXT REFERENCES flows(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      format TEXT NOT NULL,
      record_count INTEGER DEFAULT 0,
      data JSONB,
      csv_content TEXT,
      created_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_outputs_session ON outputs(session_id);
    CREATE INDEX IF NOT EXISTS idx_outputs_created ON outputs(created_at DESC);

    CREATE TABLE IF NOT EXISTS app_logs (
      id BIGSERIAL PRIMARY KEY,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      meta JSONB,
      session_id TEXT,
      created_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_app_logs_level ON app_logs(level);
    CREATE INDEX IF NOT EXISTS idx_app_logs_session ON app_logs(session_id);
    CREATE INDEX IF NOT EXISTS idx_app_logs_created ON app_logs(created_at DESC);

    CREATE TABLE IF NOT EXISTS error_captures (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
      error_type TEXT,
      error_message TEXT,
      url TEXT,
      screenshot_base64 TEXT,
      created_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_error_captures_session ON error_captures(session_id);
    CREATE INDEX IF NOT EXISTS idx_error_captures_created ON error_captures(created_at DESC);

    CREATE TABLE IF NOT EXISTS reports (
      id BIGSERIAL PRIMARY KEY,
      session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
      task_name TEXT NOT NULL,
      format TEXT NOT NULL,
      content TEXT NOT NULL,
      report_data JSONB,
      created_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_reports_session ON reports(session_id);
    CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at DESC);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      value_type TEXT NOT NULL DEFAULT 'string',
      category TEXT,
      description TEXT,
      updated_at BIGINT NOT NULL
    );
  `,
};
