import chalk from 'chalk';

export interface TimelineEvent {
  time: number;
  type: 'start' | 'step' | 'error' | 'recovery' | 'end';
  tool?: string;
  status?: 'success' | 'failed' | 'pending';
  message: string;
  duration?: number;
}

export class Timeline {
  private events: TimelineEvent[] = [];
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Add event to timeline
   */
  add(event: Omit<TimelineEvent, 'time'>): void {
    this.events.push({
      ...event,
      time: Date.now() - this.startTime,
    });
  }

  /**
   * Display timeline
   */
  display(): void {
    console.log('\n' + chalk.bold('📅 Execution Timeline:'));
    console.log(chalk.gray('─'.repeat(50)));

    for (const event of this.events) {
      const timeStr = this.formatTime(event.time);
      const icon = this.getIcon(event);
      const color = this.getColor(event);

      let line = `  ${chalk.gray(timeStr)} ${icon} `;

      if (event.tool) {
        line += chalk.cyan(event.tool) + ': ';
      }

      line += color(event.message);

      if (event.duration) {
        line += chalk.gray(` (${(event.duration / 1000).toFixed(1)}s)`);
      }

      console.log(line);
    }

    console.log('');
  }

  /**
   * Get compact summary
   */
  getSummary(): string {
    const successful = this.events.filter(
      (e) => e.type === 'step' && e.status === 'success',
    ).length;

    const failed = this.events.filter(
      (e) => e.type === 'step' && e.status === 'failed',
    ).length;

    const recovered = this.events.filter(
      (e) => e.type === 'recovery' && e.status === 'success',
    ).length;

    const total = Date.now() - this.startTime;

    return `${successful} success, ${failed} failed, ${recovered} recovered (${(total / 1000).toFixed(1)}s)`;
  }

  private formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const millis = ms % 1000;

    if (minutes > 0) {
      return `${minutes}:${String(secs).padStart(2, '0')}.${String(Math.floor(millis / 100))}`;
    }

    return `${secs}.${String(Math.floor(millis / 100)).padStart(1, '0')}s`;
  }

  private getIcon(event: TimelineEvent): string {
    switch (event.type) {
      case 'start':
        return chalk.blue('▶');
      case 'end':
        return chalk.blue('■');
      case 'step':
        return event.status === 'success'
          ? chalk.green('✓')
          : event.status === 'failed'
            ? chalk.red('✖')
            : chalk.yellow('○');
      case 'error':
        return chalk.red('✖');
      case 'recovery':
        return event.status === 'success' ? chalk.yellow('↻') : chalk.red('↻');
      default:
        return chalk.gray('·');
    }
  }

  private getColor(event: TimelineEvent): (text: string) => string {
    if (event.status === 'success') return chalk.green;
    if (event.status === 'failed') return chalk.red;
    if (event.type === 'recovery') return chalk.yellow;
    return chalk.white;
  }
}
