interface StatusBadgeProps {
  status: 'running' | 'completed' | 'failed';
  size?: 'sm' | 'md';
}

const config = {
  running: {
    dot: 'bg-blue-400 animate-pulse',
    text: 'text-blue-400',
    bg: 'bg-blue-950/60 border-blue-800/50',
    label: 'running',
  },
  completed: {
    dot: 'bg-emerald-400',
    text: 'text-emerald-400',
    bg: 'bg-emerald-950/60 border-emerald-800/50',
    label: 'completed',
  },
  failed: {
    dot: 'bg-red-400',
    text: 'text-red-400',
    bg: 'bg-red-950/60 border-red-800/50',
    label: 'failed',
  },
};

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const c = config[status] ?? config.completed;
  const padding = size === 'md' ? 'px-2.5 py-1' : 'px-2 py-0.5';
  const textSize = size === 'md' ? 'text-xs' : 'text-[11px]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${padding} ${textSize} ${c.bg} ${c.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
      {c.label}
    </span>
  );
}
