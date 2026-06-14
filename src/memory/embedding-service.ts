import { pipeline } from '@xenova/transformers';

export class EmbeddingService {
  private static instance: EmbeddingService;
  private embedder: any = null;
  private isInitializing = false;

  private constructor() {}

  static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService();
    }
    return EmbeddingService.instance;
  }

  async initialize() {
    if (this.embedder) return;
    if (this.isInitializing) {
      while (this.isInitializing) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return;
    }

    this.isInitializing = true;
    try {
      // Using all-MiniLM-L6-v2 which produces 384-dimensional embeddings
      this.embedder = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
      );
    } finally {
      this.isInitializing = false;
    }
  }

  async embed(text: string): Promise<number[]> {
    await this.initialize();

    // pooling: 'mean', normalize: true -> generates standard document embeddings
    const output = await this.embedder(text, {
      pooling: 'mean',
      normalize: true,
    });
    return Array.from(output.data);
  }
}
