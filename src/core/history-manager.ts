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
    this.messages.push({ role: 'user', content: `Please accomplish this task: ${goal}` });
  }

  /** Add the assistant's tool-use action message */
  addAssistantAction(toolName: string, args: any): void {
    this.messages.push({
      role: 'assistant',
      content: `Used ${toolName}: ${JSON.stringify(args)}`,
    });
  }

  /**
   * Add a tool result. Full result goes to DB; only a semantic summary
   * enters conversation history. Pass imageBase64 for vision-capable models.
   */
  async addToolResult(
    stepNumber: number,
    toolName: string,
    result: any,
    params: any,
    duration: number,
    imageBase64?: string,
  ): Promise<void> {
    const summary = this.summarize(toolName, result, params);

    // Persist full result to DB (fire and don't block on failure)
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

        // Store DOM snapshot for navigate / analyze_page
        if (
          (toolName === 'navigate' || toolName === 'analyze_page') &&
          result?.success
        ) {
          const data = result.data ?? result;
          const url =
            data?.url ?? data?.pageIntelligence?.url ?? '';
          const title = data?.title ?? data?.pageIntelligence?.title ?? '';
          const elements =
            data?.pageIntelligence?.elements ??
            data?.pageIntelligence?.inputs ??
            data?.elements ??
            null;

          await this.sessionRepo.storeDomSnapshot(
            this.sessionId,
            stepNumber,
            url,
            title,
            elements,
            data?.pageIntelligence ?? data,
          );
        }

        // Store collected data for extract tools
        if (
          (toolName === 'extract_data' || toolName === 'extract_text') &&
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
        logger.debug(`Session DB write failed (non-fatal): ${(err as Error).message}`);
      }
    }

    // Build conversation message — summary only, no raw DOM/HTML
    if (imageBase64) {
      const textResult = { ...result };
      delete textResult.imageBase64;
      this.messages.push({
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Tool result: ${summary}\n\nHere is what the page looks like right now:`,
          },
          {
            type: 'image_url',
            image_url: { url: imageBase64, detail: 'auto' },
          },
        ],
      });
      logger.debug('Injected screenshot image into conversation');
    } else {
      this.messages.push({
        role: 'user',
        content: `Tool result: ${summary}`,
      });
    }

    this.trim();
  }

  /** Add a plain assistant text message (no tool call) */
  addAssistantText(content: string): void {
    this.messages.push({ role: 'assistant', content });
  }

  /** Current conversation array to send to LLM */
  getMessages(): Message[] {
    return this.messages;
  }

  /** Total message count (for debugging) */
  size(): number {
    return this.messages.length;
  }

  // ─── Private ────────────────────────────────────────────────

  /**
   * Keep system + goal anchored. Trim oldest step-pairs when over budget.
   * anchor = messages[0..1], tail = rolling window of last N pairs.
   */
  private trim(): void {
    const anchor = this.messages.slice(0, 2);
    const rest = this.messages.slice(2);

    // MAX_STEP_PAIRS * 2 messages (each step = assistant + user)
    const maxRest = MAX_STEP_PAIRS * 2;
    if (rest.length > maxRest) {
      this.messages = [...anchor, ...rest.slice(rest.length - maxRest)];
      logger.debug(`History trimmed to ${this.messages.length} messages`);
    }
  }

  /**
   * Create a short, semantic summary of a tool result.
   * This is what the LLM sees in conversation — no raw DOM, no big blobs.
   */
  private summarize(toolName: string, result: any, params: any): string {
    if (!result?.success) {
      return `${toolName} FAILED: ${result?.error ?? 'unknown error'}`;
    }

    const data = result.data;

    switch (toolName) {
      case 'navigate': {
        const url = data?.url ?? params?.url ?? '?';
        const title = data?.title ?? '';
        const intel = data?.pageIntelligence;
        if (intel) {
          const inputs = intel.inputs?.length ?? 0;
          const buttons = intel.buttons?.length ?? 0;
          const links = intel.links?.length ?? 0;
          return `Navigated to ${url}${title ? ` ("${title}")` : ''}. Page has ${inputs} inputs, ${buttons} buttons, ${links} links. DOM snapshot saved — use recall_dom_snapshot to inspect elements.`;
        }
        return `Navigated to ${url}${title ? ` ("${title}")` : ''}.`;
      }

      case 'analyze_page': {
        const inputs = data?.inputs?.length ?? 0;
        const buttons = data?.buttons?.length ?? 0;
        const links = data?.links?.length ?? 0;
        const summary = result.message ?? '';
        return `Page analyzed: ${inputs} inputs, ${buttons} buttons, ${links} links. ${summary} DOM snapshot saved — use recall_dom_snapshot to inspect full element list.`;
      }

      case 'click':
        return `Clicked "${params?.selector ?? '?'}". ${result.message ?? 'Success.'}`;

      case 'fill':
        return `Filled "${params?.selector ?? '?'}" with value. ${result.message ?? 'Success.'}`;

      case 'type':
        return `Typed into "${params?.selector ?? '?'}". ${result.message ?? 'Success.'}`;

      case 'scroll':
        return `Scrolled ${params?.direction ?? ''} by ${params?.amount ?? '?'}px. ${result.message ?? 'Success.'}`;

      case 'hover':
        return `Hovered over "${params?.selector ?? '?'}". ${result.message ?? 'Success.'}`;

      case 'select':
      case 'select_dropdown':
        return `Selected "${params?.value ?? '?'}" in "${params?.selector ?? '?'}". ${result.message ?? 'Success.'}`;

      case 'wait':
        return `Wait complete. ${result.message ?? 'Success.'}`;

      case 'screenshot':
        return `Screenshot captured. ${result.message ?? ''}`;

      case 'extract_text': {
        const text = typeof data === 'string' ? data : data?.text ?? '';
        const preview = text.slice(0, 120).replace(/\s+/g, ' ');
        return `Extracted ${text.length} chars of text. Preview: "${preview}${text.length > 120 ? '...' : ''}". Full data saved — use recall_session_data.`;
      }

      case 'extract_data': {
        const items = Array.isArray(data) ? data : [data];
        const fields = items[0] ? Object.keys(items[0]).join(', ') : '?';
        return `Extracted ${items.length} item(s). Fields: [${fields}]. Full dataset saved — use recall_session_data to retrieve.`;
      }

      case 'evaluate_js': {
        const preview = JSON.stringify(data ?? result.message ?? '').slice(0, 100);
        return `JavaScript evaluated. Result: ${preview}`;
      }

      case 'probe_selectors': {
        const probeResults = data?.probeResults ?? {};
        const total = Object.keys(probeResults).length;
        const valid = Object.values(probeResults).filter((v) => v !== null).length;
        return `Probed ${total} selectors: ${valid} valid, ${total - valid} null. ${result.message ?? ''}`;
      }

      case 'detect_repetitive_pattern':
        return `Pattern detected. ${result.message ?? ''} Loop engine configured.`;

      // Recall tools — already return formatted text, pass through
      case 'recall_step_history':
      case 'recall_dom_snapshot':
      case 'recall_session_data':
        return result.message ?? 'Recall complete.';

      default:
        return `${toolName} completed. ${result.message ?? ''}`.trim();
    }
  }
}
