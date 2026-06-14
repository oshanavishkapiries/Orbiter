import { Message } from '../llm/types.js';
import { SessionRepository } from '../memory/database/repositories/session-repository.js';
import { logger } from '../cli/ui/logger.js';

// Keep system + goal + last N step-pairs in conversation.
// Each step = 2 messages (assistant action + user result).
const MAX_STEP_PAIRS = 12;

export class HistoryManager {
  private messages: Message[] = [];

  constructor(
    systemPrompt: string,
    goal: string,
    private sessionRepo: SessionRepository | null,
    private sessionId: string | null,
  ) {
    this.messages.push({ role: 'system', content: systemPrompt });
    this.messages.push({
      role: 'user',
      content: `Please accomplish this task: ${goal}`,
    });
  }

  addAssistantAction(toolCallId: string, toolName: string, args: any): void {
    this.messages.push({
      role: 'assistant',
      content: '',
      toolCalls: [{ id: toolCallId, name: toolName, arguments: args }],
    });
  }

  async addToolResult(
    toolCallId: string,
    stepNumber: number,
    toolName: string,
    result: any,
    params: any,
    duration: number,
    imageBase64?: string,
  ): Promise<void> {
    const summary = this.summarize(toolName, result, params);

    if (this.sessionRepo && this.sessionId) {
      try {
        await this.sessionRepo.storeStep(
          this.sessionId,
          stepNumber,
          toolName,
          params,
          summary,
          result,
          result?.success ?? false,
          duration,
        );

        // Persist ariaSnapshot from navigate and snapshot tools
        if (
          (toolName === 'navigate' || toolName === 'snapshot') &&
          result?.success
        ) {
          const data = result.data ?? {};
          await this.sessionRepo.storeDomSnapshot(
            this.sessionId,
            stepNumber,
            data.url ?? '',
            data.title ?? '',
            undefined,
            data.snapshot ?? null,
          );
        }

        if (
          (toolName === 'save_csv' || toolName === 'save_json') &&
          result?.success &&
          result?.data
        ) {
          await this.sessionRepo.storeCollectedData(
            this.sessionId,
            stepNumber,
            toolName,
            result.data,
          );
        }
      } catch (err) {
        logger.debug(
          `Session DB write failed (non-fatal): ${(err as Error).message}`,
        );
      }
    }

    this.messages.push({
      role: 'tool',
      toolCallId,
      name: toolName,
      content: summary,
    });

    if (imageBase64) {
      this.messages.push({
        role: 'user',
        content: [
          { type: 'text', text: `Tool result: ${summary}\n\nCurrent page:` },
          {
            type: 'image_url',
            image_url: { url: imageBase64, detail: 'auto' },
          },
        ],
      });
    } else {
      this.messages.push({ role: 'user', content: `Tool result: ${summary}` });
    }

    this.trim();
  }

  injectSkillContext(skillName: string, context: string): void {
    this.messages.push({
      role: 'user',
      content: `[Site Skill: ${skillName}]\n${context}`,
    });
    this.messages.push({
      role: 'assistant',
      content: `Understood. I will apply the ${skillName} site skill guidance for this page.`,
    });
  }

  addAssistantText(content: string): void {
    this.messages.push({ role: 'assistant', content });
  }

  addUserText(content: string): void {
    this.messages.push({ role: 'user', content });
    this.trim();
  }

  getMessages(): Message[] {
    return this.messages;
  }

  size(): number {
    return this.messages.length;
  }

  private trim(): void {
    const anchor = this.messages.slice(0, 2);
    const rest = this.messages.slice(2);
    const maxRest = MAX_STEP_PAIRS * 3;
    if (rest.length > maxRest) {
      this.messages = [...anchor, ...rest.slice(rest.length - maxRest)];
      logger.debug(`History trimmed to ${this.messages.length} messages`);
    }
  }

  /**
   * What the LLM sees for each tool result.
   * For page-observation tools (navigate, snapshot) we include the full ARIA tree
   * so the LLM can immediately read roles/names without an extra round-trip.
   */
  private summarize(toolName: string, result: any, params: any): string {
    if (!result?.success) {
      return `${toolName} FAILED: ${result?.error ?? 'unknown error'}`;
    }

    const data = result.data;

    switch (toolName) {
      case 'navigate': {
        const url = data?.url ?? params?.url ?? '?';
        const title = data?.title ? ` ("${data.title}")` : '';
        const snap = data?.snapshot
          ? `\n\nPage accessibility snapshot:\n${data.snapshot}`
          : '';
        return `Navigated to ${url}${title}.${snap}`;
      }

      case 'snapshot': {
        const url = data?.url ?? '?';
        const title = data?.title ? ` "${data.title}"` : '';
        const snap = data?.snapshot
          ? `\n\n${data.snapshot}`
          : ' (no snapshot available)';
        return `Snapshot of${title} — ${url}:${snap}`;
      }

      case 'click':
      case 'fill':
      case 'type':
      case 'hover':
      case 'select_dropdown':
        return result.message ?? `${toolName} completed.`;

      case 'scroll':
        return `Scrolled ${params?.direction ?? ''} by ${params?.amount ?? '?'}px. ${result.message ?? ''}`.trim();

      case 'wait':
        return result.message ?? 'Wait complete.';

      case 'screenshot':
        return `Screenshot captured. ${result.message ?? ''}`.trim();

      case 'save_csv':
      case 'save_json': {
        const count = data?.count ?? '?';
        const fp = data?.filePath ?? '';
        return `${toolName}: saved ${count} record(s) → ${fp}`;
      }

      case 'run_code': {
        const preview = JSON.stringify(data ?? result.message ?? '').slice(
          0,
          300,
        );
        return `run_code result: ${preview}`;
      }

      case 'evaluate_js': {
        const preview = JSON.stringify(data ?? result.message ?? '').slice(
          0,
          200,
        );
        return `JavaScript result: ${preview}`;
      }

      // Recall tools — return their content directly so the LLM can read it
      case 'recall_dom_snapshot':
      case 'recall_step_history':
      case 'recall_session_data':
        return result.message ?? 'Recall complete.';

      default:
        return `${toolName} completed. ${result.message ?? ''}`.trim();
    }
  }
}
