export const SCHEMA_VERSION = 1;

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
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_used_at INTEGER,
  last_success_at INTEGER,
  expires_at INTEGER,
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
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);

-- Selector fallbacks (multiple per selector)
CREATE TABLE IF NOT EXISTS selector_fallbacks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  created_at INTEGER NOT NULL,
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
  created_at INTEGER NOT NULL,
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
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
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
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);

-- Indexes for successful flows
CREATE INDEX IF NOT EXISTS idx_successful_flows_domain ON successful_flows(domain);
CREATE INDEX IF NOT EXISTS idx_successful_flows_goal ON successful_flows(goal_pattern);

-- ═══════════════════════════════════════════════════════
-- USAGE LOGS TABLE (for analytics)
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  memory_id TEXT NOT NULL,
  action TEXT NOT NULL,
  result TEXT NOT NULL,
  context_json TEXT,
  created_at INTEGER NOT NULL,
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
  applied_at INTEGER NOT NULL
);

-- Insert initial schema version
INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (1, strftime('%s', 'now') * 1000);
`;

// Migration scripts for future schema updates
export const MIGRATIONS: Record<number, string> = {
  // Version 2 migration would go here
  // 2: `ALTER TABLE memories ADD COLUMN new_field TEXT;`
};
