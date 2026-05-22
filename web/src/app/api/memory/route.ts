import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { MemorySelector } from '@/lib/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get('domain');
  const statsOnly = searchParams.get('stats') === 'true';

  if (statsOnly || !domain) {
    const [totalRows, domainRows] = await Promise.all([
      query<{ type: string; cnt: string }>(
        `SELECT type, COUNT(*) as cnt FROM memories WHERE is_active = 1 GROUP BY type`,
      ),
      query<{ domain: string; cnt: string }>(
        `SELECT domain, COUNT(*) as cnt FROM memories
         WHERE is_active = 1 GROUP BY domain ORDER BY cnt DESC LIMIT 20`,
      ),
    ]);

    const avgRows = await query<{ avg: string }>(
      `SELECT AVG(confidence) as avg FROM memories WHERE is_active = 1`,
    );

    const byType: Record<string, number> = {};
    let total = 0;
    for (const r of totalRows) {
      byType[r.type] = parseInt(r.cnt, 10);
      total += parseInt(r.cnt, 10);
    }

    const domains = domainRows.map((r) => ({
      domain: r.domain,
      count: parseInt(r.cnt, 10),
    }));

    return NextResponse.json({
      total,
      byType,
      domains,
      averageConfidence: parseFloat(avgRows[0]?.avg ?? '0'),
    });
  }

  // Selectors for a specific domain
  const rows = await query<{
    id: string;
    domain: string;
    element_name: string;
    element_type: string;
    primary_selector: string;
    created_at: string;
    confidence: number;
    usage_count: number;
    success_count: number;
  }>(
    `SELECT s.id, s.domain, s.element_name, s.element_type, s.primary_selector,
            s.created_at, m.confidence, m.usage_count, m.success_count
     FROM selectors s
     JOIN memories m ON s.memory_id = m.id
     WHERE s.domain = $1 AND m.is_active = 1
     ORDER BY m.confidence DESC
     LIMIT 100`,
    [domain],
  );

  const selectors: MemorySelector[] = rows.map((r) => ({
    id: r.id,
    domain: r.domain,
    elementName: r.element_name,
    elementType: r.element_type,
    primarySelector: r.primary_selector,
    confidence: Number(r.confidence),
    usageCount: Number(r.usage_count),
    successCount: Number(r.success_count),
    createdAt: Number(r.created_at),
  }));

  return NextResponse.json(selectors);
}
