interface ToolBadgeProps {
  tool: string;
  size?: 'sm' | 'md';
}

const toolColors: Record<string, string> = {
  navigate: 'bg-blue-950/70 text-blue-300 border-blue-800/50',
  click: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/50',
  fill: 'bg-teal-950/70 text-teal-300 border-teal-800/50',
  type: 'bg-teal-950/70 text-teal-300 border-teal-800/50',
  select: 'bg-teal-950/70 text-teal-300 border-teal-800/50',
  select_dropdown: 'bg-teal-950/70 text-teal-300 border-teal-800/50',
  extract_data: 'bg-violet-950/70 text-violet-300 border-violet-800/50',
  extract_text: 'bg-violet-950/70 text-violet-300 border-violet-800/50',
  screenshot: 'bg-yellow-950/70 text-yellow-300 border-yellow-800/50',
  evaluate: 'bg-orange-950/70 text-orange-300 border-orange-800/50',
  evaluate_js: 'bg-orange-950/70 text-orange-300 border-orange-800/50',
  scroll: 'bg-zinc-800/70 text-zinc-300 border-zinc-700/50',
  hover: 'bg-zinc-800/70 text-zinc-300 border-zinc-700/50',
  wait: 'bg-zinc-800/70 text-zinc-300 border-zinc-700/50',
  analyze_page: 'bg-cyan-950/70 text-cyan-300 border-cyan-800/50',
  detect_pattern: 'bg-pink-950/70 text-pink-300 border-pink-800/50',
  detect_repetitive_pattern: 'bg-pink-950/70 text-pink-300 border-pink-800/50',
  probe_selectors: 'bg-lime-950/70 text-lime-300 border-lime-800/50',
  recall_memory: 'bg-indigo-950/70 text-indigo-300 border-indigo-800/50',
  recall_dom_snapshot: 'bg-indigo-950/70 text-indigo-300 border-indigo-800/50',
  recall_session_data: 'bg-indigo-950/70 text-indigo-300 border-indigo-800/50',
  recall_step_history: 'bg-indigo-950/70 text-indigo-300 border-indigo-800/50',
  store_memory: 'bg-indigo-950/70 text-indigo-300 border-indigo-800/50',
};

export function ToolBadge({ tool, size = 'sm' }: ToolBadgeProps) {
  const color =
    toolColors[tool] ?? 'bg-zinc-800/70 text-zinc-300 border-zinc-700/50';
  const padding = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]';

  return (
    <span
      className={`inline-flex items-center rounded border font-mono font-medium whitespace-nowrap ${padding} ${color}`}
    >
      {tool}
    </span>
  );
}
