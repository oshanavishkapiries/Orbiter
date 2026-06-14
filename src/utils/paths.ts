import path from 'path';

export const DATA_DIR = path.join(process.cwd(), 'data');

export const PATHS = {
  data: DATA_DIR,
  browserProfile: path.join(DATA_DIR, 'browser-profile'),
} as const;
