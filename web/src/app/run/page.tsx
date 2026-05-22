'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, ChevronDown, ChevronRight, Terminal, ExternalLink } from 'lucide-react';

interface RunOptions {
  model: string;
  profile: string;
  headless: boolean;
  maxSteps: number;
  enhance: boolean;
}

type OutputLine = { type: 'stdout' | 'stderr' | 'start' | 'done' | 'error'; text: string };

const MODELS = [
  'anthropic/claude-sonnet-4',
  'anthropic/claude-opus-4',
  'anthropic/claude-haiku-4-5',
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'google/gemini-pro-1.5',
];

export default function RunPage() {
  const [prompt, setPrompt] = useState('');
  const [options, setOptions] = useState<RunOptions>({
    model: MODELS[0],
    profile: 'default',
    headless: true,
    maxSteps: 50,
    enhance: false,
  });
  const [showOptions, setShowOptions] = useState(false);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [done, setDone] = useState(false);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || running) return;

    setRunning(true);
    setDone(false);
    setExitCode(null);
    setOutput([]);

    try {
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), ...options }),
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'done') {
              setDone(true);
              setExitCode(event.exitCode ?? 0);
              setRunning(false);
            } else if (event.type === 'start') {
              setOutput((prev) => [
                ...prev,
                { type: 'start', text: `$ ${event.command}` },
              ]);
            } else if (event.type === 'error') {
              setOutput((prev) => [
                ...prev,
                { type: 'error', text: `Error: ${event.message}` },
              ]);
              setRunning(false);
              setDone(true);
            } else if (event.type === 'stdout' || event.type === 'stderr') {
              const lines = (event.text as string).split('\n').filter((l: string) => l.trim());
              setOutput((prev) => [
                ...prev,
                ...lines.map((text: string) => ({
                  type: event.type as 'stdout' | 'stderr',
                  text,
                })),
              ]);
            }
          } catch {}
        }
      }
    } catch (err) {
      setOutput((prev) => [
        ...prev,
        { type: 'error', text: `Failed to start run: ${(err as Error).message}` },
      ]);
      setRunning(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-100">New Run</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Launch an AI-powered browser automation task
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Prompt */}
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-2">
            Task prompt
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Go to github.com and star the playwright repository…"
            rows={4}
            disabled={running}
            className="w-full px-4 py-3 text-sm bg-zinc-900 border border-zinc-700 rounded-xl text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-600 transition-colors resize-none disabled:opacity-60"
          />
        </div>

        {/* Options Accordion */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowOptions((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <span>Options</span>
            {showOptions ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          {showOptions && (
            <div className="border-t border-zinc-800 px-4 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Model */}
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Model</label>
                  <select
                    value={options.model}
                    onChange={(e) => setOptions((o) => ({ ...o, model: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:border-violet-600"
                  >
                    {MODELS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                {/* Profile */}
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Browser profile</label>
                  <input
                    type="text"
                    value={options.profile}
                    onChange={(e) => setOptions((o) => ({ ...o, profile: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:border-violet-600"
                  />
                </div>

                {/* Max steps */}
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Max steps</label>
                  <input
                    type="number"
                    value={options.maxSteps}
                    min={5}
                    max={100}
                    onChange={(e) => setOptions((o) => ({ ...o, maxSteps: parseInt(e.target.value) || 50 }))}
                    className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:border-violet-600"
                  />
                </div>
              </div>

              {/* Checkboxes */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.headless}
                    onChange={(e) => setOptions((o) => ({ ...o, headless: e.target.checked }))}
                    className="w-4 h-4 rounded accent-violet-600"
                  />
                  <span className="text-xs text-zinc-400">Headless browser</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.enhance}
                    onChange={(e) => setOptions((o) => ({ ...o, enhance: e.target.checked }))}
                    className="w-4 h-4 rounded accent-violet-600"
                  />
                  <span className="text-xs text-zinc-400">Enhance prompt (AI rewrite)</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={!prompt.trim() || running}
          className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          {running ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Running…
            </>
          ) : (
            <>
              <Play size={14} />
              Launch Run
            </>
          )}
        </button>
      </form>

      {/* Output Console */}
      {output.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-2">
            <Terminal size={14} className="text-zinc-500" />
            <span className="text-xs font-medium text-zinc-400">Output</span>
            {done && (
              <span
                className={`ml-auto text-xs px-2 py-0.5 rounded-full border font-medium ${
                  exitCode === 0
                    ? 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40'
                    : 'text-red-400 bg-red-950/40 border-red-800/40'
                }`}
              >
                {exitCode === 0 ? '✓ completed' : `✗ exit ${exitCode}`}
              </span>
            )}
          </div>
          <div
            ref={outputRef}
            className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 font-mono text-xs leading-relaxed overflow-auto max-h-96 space-y-0.5"
          >
            {output.map((line, i) => (
              <p
                key={i}
                className={
                  line.type === 'start'
                    ? 'text-zinc-500'
                    : line.type === 'stderr' || line.type === 'error'
                    ? 'text-red-400'
                    : 'text-zinc-300'
                }
              >
                {line.text}
              </p>
            ))}
            {running && (
              <p className="text-zinc-600 animate-pulse">▋</p>
            )}
          </div>

          {done && (
            <div className="mt-3 flex gap-2">
              <a
                href="/live"
                className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                <ExternalLink size={11} />
                View live session
              </a>
              <span className="text-zinc-700">·</span>
              <a
                href="/sessions"
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Browse sessions
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
