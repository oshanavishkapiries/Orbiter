import { NextResponse } from 'next/server';
import { readdir, stat, readFile } from 'fs/promises';
import path from 'path';
import { FlowFile } from '@/lib/types';

export async function GET() {
  const dataDir = process.env.ORBITER_DATA_DIR;
  if (!dataDir) return NextResponse.json([]);

  const flowsDir = path.join(dataDir, 'flows');

  try {
    const files = await readdir(flowsDir);
    const flowFiles = files.filter(
      (f) => f.endsWith('.flow.json') || f.endsWith('.raw.json'),
    );

    const results: FlowFile[] = await Promise.all(
      flowFiles.map(async (f) => {
        const fullPath = path.join(flowsDir, f);
        const s = await stat(fullPath);
        const type: FlowFile['type'] = f.endsWith('.flow.json')
          ? 'refined'
          : 'raw';

        let stepCount: number | undefined;
        try {
          const content = await readFile(fullPath, 'utf-8');
          const json = JSON.parse(content);
          stepCount = Array.isArray(json.steps) ? json.steps.length : undefined;
        } catch {
          // ignore
        }

        return {
          name: f,
          path: fullPath,
          type,
          sizeBytes: s.size,
          modifiedAt: s.mtimeMs,
          stepCount,
        };
      }),
    );

    return NextResponse.json(
      results.sort((a, b) => b.modifiedAt - a.modifiedAt),
    );
  } catch {
    return NextResponse.json([]);
  }
}
