import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
let currentDir = path.dirname(__filename);

// Traverse up to find the project root containing configuration.yml or package.json
let projectRoot = currentDir;
while (currentDir !== path.dirname(currentDir)) {
  if (
    fs.existsSync(path.join(currentDir, 'configuration.yml')) ||
    fs.existsSync(path.join(currentDir, 'package.json'))
  ) {
    projectRoot = currentDir;
    break;
  }
  currentDir = path.dirname(currentDir);
}

export const DATA_DIR = path.join(projectRoot, 'data');

export const PATHS = {
  data: DATA_DIR,
  browserProfile: path.join(DATA_DIR, 'browser-profile'),
} as const;
