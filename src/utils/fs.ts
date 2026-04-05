import fs from 'fs';
import path from 'path';

export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function writeJson(filePath: string, data: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function readJson<T>(filePath: string): T {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}
