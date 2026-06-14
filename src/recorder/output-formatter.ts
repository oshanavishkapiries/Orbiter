import { logger } from '../cli/ui/logger.js';
import { DataRepository } from '../memory/database/repositories/data-repository.js';

export class OutputFormatter {
  private repo: DataRepository;

  constructor() {
    this.repo = new DataRepository();
  }

  async saveJson(
    data: any[],
    name: string,
    sessionId?: string | null,
    flowId?: string | null,
  ): Promise<string> {
    const id = await this.repo.saveOutput(
      name,
      'json',
      { count: data.length, extractedAt: new Date().toISOString(), data },
      null,
      data.length,
      sessionId,
      flowId,
    );
    logger.success(`Data saved to database (output #${id}, ${data.length} records)`);
    return `#${id}`;
  }

  async saveCsv(
    data: any[],
    name: string,
    sessionId?: string | null,
    flowId?: string | null,
  ): Promise<string> {
    if (data.length === 0) {
      logger.warn('No data to save to CSV');
      return '';
    }

    const csvContent = this.buildCsv(data);
    const id = await this.repo.saveOutput(
      name,
      'csv',
      null,
      csvContent,
      data.length,
      sessionId,
      flowId,
    );
    logger.success(`CSV saved to database (output #${id}, ${data.length} records)`);
    return `#${id}`;
  }

  async saveAll(
    data: any[],
    name: string,
    sessionId?: string | null,
    flowId?: string | null,
  ): Promise<string[]> {
    const ref = await this.saveJson(data, name, sessionId, flowId);
    return ref ? [ref] : [];
  }

  generateFilename(flowName: string): string {
    const date = new Date().toISOString().slice(0, 10);
    return `${flowName}-${date}`;
  }

  private buildCsv(data: any[]): string {
    const headers = Object.keys(data[0]);
    const lines: string[] = [headers.map((h) => this.escapeCsv(h)).join(',')];

    for (const row of data) {
      const values = headers.map((h) => {
        const v = row[h];
        if (v === null || v === undefined) return '';
        return this.escapeCsv(String(v));
      });
      lines.push(values.join(','));
    }

    return lines.join('\n');
  }

  private escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
