import path from 'path';

/**
 * Root data directory for all Orbiter runtime files.
 * All subdirectories (errors, flows, logs, outputs, reports, browser-profile)
 * live under this single folder.
 */
export const DATA_DIR = path.join(process.cwd(), 'data');

export const PATHS = {
  data: DATA_DIR,
  errors: path.join(DATA_DIR, 'errors'),
  flows: path.join(DATA_DIR, 'flows'),
  logs: path.join(DATA_DIR, 'logs'),
  outputs: path.join(DATA_DIR, 'outputs'),
  reports: path.join(DATA_DIR, 'reports'),
  browserProfile: path.join(DATA_DIR, 'browser-profile'),
} as const;
