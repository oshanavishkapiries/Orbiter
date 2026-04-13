import path from 'path';
import fs from 'fs';
import { config } from '../config/index.js';
import { logger } from '../cli/ui/logger.js';
import { ensureDir, writeJson } from '../utils/fs.js';

export class OutputFormatter {
  private outputDir: string;

  constructor() {
    this.outputDir = config().output.dir;
    ensureDir(this.outputDir);
  }

  /**
   * Save extracted data to JSON
   */
  saveJson(data: any[], filename: string): string {
    const filePath = path.join(this.outputDir, `${filename}.json`);

    writeJson(filePath, {
      count: data.length,
      extractedAt: new Date().toISOString(),
      data,
    });

    logger.success(`JSON saved: ${filePath}`);
    return filePath;
  }

  /**
   * Save extracted data to CSV
   */
  saveCsv(data: any[], filename: string): string {
    if (data.length === 0) {
      logger.warn('No data to save to CSV');
      return '';
    }

    const filePath = path.join(this.outputDir, `${filename}.csv`);

    // Get headers from first item
    const headers = Object.keys(data[0]);

    // Build CSV content
    const lines: string[] = [];

    // Header row
    lines.push(headers.map((h) => this.escapeCsv(h)).join(','));

    // Data rows
    for (const row of data) {
      const values = headers.map((h) => {
        const value = row[h];
        if (value === null || value === undefined) return '';
        return this.escapeCsv(String(value));
      });
      lines.push(values.join(','));
    }

    fs.writeFileSync(filePath, lines.join('\n'));

    logger.success(`CSV saved: ${filePath}`);
    return filePath;
  }

  /**
   * Save all configured formats
   */
  saveAll(data: any[], filename: string): string[] {
    const cfg = config();
    const savedFiles: string[] = [];

    if (cfg.output.formats.includes('json')) {
      savedFiles.push(this.saveJson(data, filename));
    }

    if (cfg.output.formats.includes('csv')) {
      const csvPath = this.saveCsv(data, filename);
      if (csvPath) savedFiles.push(csvPath);
    }

    return savedFiles;
  }

  /**
   * Generate output filename
   */
  generateFilename(flowName: string): string {
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    return `${flowName}-${date}`;
  }

  /**
   * Escape CSV special characters
   */
  private escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
