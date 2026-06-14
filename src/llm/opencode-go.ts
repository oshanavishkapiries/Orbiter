import { config } from '../config/index.js';
import { OpenAICompatibleProvider } from './openai-compatible.js';

export class OpenCodeGoProvider extends OpenAICompatibleProvider {
  name = 'opencode-go';

  constructor(apiKey?: string, model?: string, cfg?: any) {
    const activeCfg = cfg || config();
    const resolvedApiKey = apiKey || activeCfg.llm.opencodeApiKey || process.env.OPENCODE_GO_API_KEY || '';
    const resolvedModel = model || activeCfg.llm.model;

    if (!resolvedApiKey) {
      throw new Error(
        'OpenCode Go API key not found. Please set it in Settings on the web dashboard or via environment variable.',
      );
    }

    super({
      providerName: 'opencode-go',
      model: normalizeModelId(resolvedModel),
      apiKey: resolvedApiKey,
      baseURL: 'https://opencode.ai/zen/go/v1',
      title: 'Orbiter Browser Automation',
      config: activeCfg,
    });
  }

  supportsVision(): boolean {
    return false;
  }

  async loadCapabilities(): Promise<void> {
    // OpenCode Go model metadata is not wired into Orbiter pricing/capability lookup yet.
  }

  async getModels(): Promise<any[]> {
    const response = await this.client.get('/models');
    const payload = response.data;

    if (Array.isArray(payload)) {
      return payload;
    }

    if (Array.isArray(payload?.data)) {
      return payload.data;
    }

    if (Array.isArray(payload?.models)) {
      return payload.models;
    }

    return [];
  }
}

function normalizeModelId(model: string): string {
  return model.startsWith('opencode-go/')
    ? model.slice('opencode-go/'.length)
    : model;
}
