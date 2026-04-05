import { mkdir, readFile, writeFile, access } from 'fs/promises';
import { dirname } from 'path';

export async function ensureDir(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
}

export async function readJson<T>(path: string): Promise<T> {
  const data = await readFile(path, 'utf-8');
  return JSON.parse(data) as T;
}

export async function writeJson(path: string, data: unknown): Promise<void> {
  await ensureDir(path);
  await writeFile(path, JSON.stringify(data, null, 2));
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
