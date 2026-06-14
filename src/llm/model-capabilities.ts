import axios from 'axios';
import { logger } from '../cli/ui/logger.js';

export interface ModelCapabilities {
  id: string;
  name: string;
  supportsVision: boolean; // input modality includes image
  supportsFunctions: boolean; // supports tool/function calling
  contextLength: number;
  modality: string; // raw string e.g. "text+image->text"
  inputPricePerMToken: number;
  outputPricePerMToken: number;
}

// Process-lifetime cache: modelId → capabilities
const cache = new Map<string, ModelCapabilities>();

/**
 * Fetch capabilities for a specific model from the OpenRouter API.
 * Results are cached so only one API call is made per process per model.
 */
export async function fetchModelCapabilities(
  apiKey: string,
  modelId: string,
): Promise<ModelCapabilities | null> {
  if (cache.has(modelId)) {
    return cache.get(modelId)!;
  }

  try {
    logger.debug(`Fetching model capabilities from OpenRouter for: ${modelId}`);

    const response = await axios.get('https://openrouter.ai/api/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://github.com/orbiter-ai',
      },
      timeout: 8000,
    });

    const models: any[] = response.data?.data ?? [];
    const model = models.find((m: any) => m.id === modelId);

    if (!model) {
      logger.debug(`Model "${modelId}" not found in OpenRouter model list`);
      return null;
    }

    const modality: string = model.architecture?.modality ?? 'text->text';

    const caps: ModelCapabilities = {
      id: model.id,
      name: model.name ?? modelId,
      modality,
      // Vision if the input side of the modality string contains "image"
      // e.g. "text+image->text", "text+image+file->text"
      supportsVision: modality.split('->')[0].includes('image'),
      // OpenRouter doesn't expose a direct "supports_tools" field;
      // most modern models do — assume true unless modality is "image->text"
      supportsFunctions: !modality.startsWith('image->'),
      contextLength: model.context_length ?? 0,
      inputPricePerMToken: parseFloat(model.pricing?.prompt ?? '0') * 1_000_000,
      outputPricePerMToken:
        parseFloat(model.pricing?.completion ?? '0') * 1_000_000,
    };

    cache.set(modelId, caps);

    logger.debug(
      `Model capabilities loaded: ${modelId} — vision=${caps.supportsVision} modality="${caps.modality}"`,
    );

    return caps;
  } catch (error) {
    logger.debug(
      `Failed to fetch model capabilities: ${(error as Error).message}`,
    );
    return null;
  }
}

/** Clear the cache (useful in tests) */
export function clearCapabilitiesCache(): void {
  cache.clear();
}
