import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export async function POST(request: Request) {
  const body = await request.json();
  const {
    prompt,
    model,
    profile = 'default',
    headless = true,
    maxSteps = 50,
    enhance = false,
  } = body as {
    prompt: string;
    model?: string;
    profile?: string;
    headless?: boolean;
    maxSteps?: number;
    enhance?: boolean;
  };

  const orbiterRoot = process.env.ORBITER_ROOT;
  if (!orbiterRoot) {
    return new Response(
      `data: ${JSON.stringify({ type: 'error', message: 'ORBITER_ROOT not set' })}\n\n`,
      { headers: sseHeaders() },
    );
  }

  const args: string[] = [prompt];
  if (model) args.push('--model', model);
  if (profile) args.push('--profile', profile);
  if (headless) args.push('--headless');
  if (maxSteps !== 50) args.push('--max-steps', String(maxSteps));
  if (enhance) args.push('--enhance');

  // Prefer built dist, fall back to tsx
  const distEntry = path.join(orbiterRoot, 'dist', 'index.js');
  const srcEntry = path.join(orbiterRoot, 'src', 'index.ts');

  let spawnArgs: string[];
  if (fs.existsSync(distEntry)) {
    spawnArgs = ['node', distEntry, 'run', ...args];
  } else {
    spawnArgs = ['npx', 'tsx', srcEntry, 'run', ...args];
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      function send(data: object) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
        );
      }

      const child = spawn(spawnArgs[0], spawnArgs.slice(1), {
        cwd: orbiterRoot,
        env: { ...process.env },
        shell: process.platform === 'win32',
      });

      send({ type: 'start', command: spawnArgs.join(' ') });

      child.stdout?.on('data', (chunk: Buffer) => {
        send({ type: 'stdout', text: chunk.toString() });
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        send({ type: 'stderr', text: chunk.toString() });
      });

      child.on('close', (code: number | null) => {
        send({ type: 'done', exitCode: code });
        controller.close();
      });

      child.on('error', (err: Error) => {
        send({ type: 'error', message: err.message });
        controller.close();
      });
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}

function sseHeaders() {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  };
}
