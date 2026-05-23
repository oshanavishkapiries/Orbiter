import { McpClient } from '../mcp/client.js';
import { logger } from '../cli/ui/logger.js';

interface ActionEntry {
  tool: string;
  success: boolean;
}

export class BrowserOverlay {
  private recentActions: ActionEntry[] = [];
  private dataCount = 0;
  private enabled: boolean;

  constructor(enabled: boolean = false) {
    this.enabled = enabled;
  }

  async update(
    mcpClient: McpClient,
    stepNum: number,
    maxSteps: number,
    tool: string,
    success: boolean,
    dataCount: number,
  ): Promise<void> {
    if (!this.enabled) return;

    this.dataCount = dataCount;
    this.recentActions.unshift({ tool, success });
    if (this.recentActions.length > 6) this.recentActions.pop();

    try {
      await this.inject(mcpClient, stepNum, maxSteps, tool);
    } catch {
      // Silently ignore — page may be mid-navigation
    }
  }

  private async inject(
    mcpClient: McpClient,
    stepNum: number,
    maxSteps: number,
    currentTool: string,
  ): Promise<void> {
    const logLines = this.recentActions
      .map((a) => {
        const icon = a.success ? '✓' : '✖';
        const color = a.success ? '#4ade80' : '#f87171';
        return `<div style="color:${color};padding:2px 0;">${icon} ${a.tool}</div>`;
      })
      .join('');

    const dataSection =
      this.dataCount > 0
        ? `<div style="margin-top:10px;border-top:1px solid #1e2a4a;padding-top:8px;color:#818cf8;">📦 ${this.dataCount} records collected</div>`
        : '';

    const progressPct = Math.round((stepNum / maxSteps) * 100);
    const progressBar = `<div style="height:3px;background:#1e2a4a;border-radius:2px;margin-top:10px;"><div style="height:100%;width:${progressPct}%;background:linear-gradient(90deg,#6366f1,#00f5ff);border-radius:2px;transition:width 0.3s;"></div></div>`;

    const html = `
<div id="__orbiter_overlay__" style="position:fixed;bottom:20px;right:20px;width:280px;background:#0d0f1a;border:1px solid #1e2a4a;border-radius:12px;padding:14px;font-family:'Courier New',monospace;font-size:11px;color:#94a3b8;z-index:2147483647;pointer-events:none;box-shadow:0 8px 32px rgba(0,0,255,0.12);">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
    <div style="width:7px;height:7px;border-radius:50%;background:#00f5ff;animation:__orb_pulse__ 1.2s ease-in-out infinite;"></div>
    <span style="color:#e2e8f0;font-size:12px;font-weight:bold;letter-spacing:0.05em;">ORBITER</span>
    <span style="margin-left:auto;color:#475569;">${stepNum}/${maxSteps}</span>
  </div>
  <div style="color:#818cf8;font-size:11px;margin-bottom:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">⚡ ${currentTool}</div>
  <div style="border-top:1px solid #1e2a4a;padding-top:8px;">${logLines}</div>
  ${dataSection}
  ${progressBar}
</div>
<style>@keyframes __orb_pulse__{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(0,245,255,0.4)}50%{opacity:0.6;box-shadow:0 0 0 4px rgba(0,245,255,0)}}</style>`;

    const script = `(function(){
      try {
        const prev = document.getElementById('__orbiter_overlay__');
        if (prev) prev.remove();
        const wrapper = document.createElement('div');
        wrapper.innerHTML = ${JSON.stringify(html)};
        document.body.appendChild(wrapper.firstElementChild);
        // Also inject the style tag if not already present
        const styleId = '__orbiter_style__';
        if (!document.getElementById(styleId)) {
          const style = wrapper.querySelector('style');
          if (style) { style.id = styleId; document.head.appendChild(style); }
        }
      } catch(e) {}
    })()`;

    await mcpClient.evaluate(script);
  }

  async remove(mcpClient: McpClient): Promise<void> {
    if (!this.enabled) return;
    try {
      await mcpClient.evaluate(
        `(function(){ const el = document.getElementById('__orbiter_overlay__'); if(el) el.remove(); })()`,
      );
    } catch {}
  }
}
