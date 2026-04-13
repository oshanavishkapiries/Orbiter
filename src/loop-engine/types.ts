// ─────────────────────────────────────────────
// Extraction Schema Types
// ─────────────────────────────────────────────

export type ExtractionMethod = 'text' | 'attribute' | 'html' | 'evaluate';

export interface ExtractionRule {
  selector: string;
  method: ExtractionMethod;
  attribute?: string; // For method: 'attribute'
  evaluateCode?: string; // For method: 'evaluate'
  transform?: 'trim' | 'lowercase' | 'uppercase' | 'number';
  fallback?: string; // Default value if not found
  required?: boolean;
}

export type ExtractSchema = Record<string, string | ExtractionRule>;

// ─────────────────────────────────────────────
// Pagination Types
// ─────────────────────────────────────────────

export type PaginationType = 'scroll' | 'click-next' | 'url-based' | 'none';

export interface ScrollPagination {
  type: 'scroll';
  container?: string; // Scroll container selector
  scrollAmount?: number; // Pixels to scroll each time
  maxScrolls?: number; // Max scroll attempts
  waitAfterScroll?: number; // Wait ms after each scroll
  endCondition?: string; // Selector that means "no more items"
}

export interface ClickNextPagination {
  type: 'click-next';
  nextButtonSelector: string;
  disabledClass?: string; // Class that means button is disabled
  waitAfterClick?: number; // Wait ms after clicking next
  maxPages?: number;
}

export interface UrlPagination {
  type: 'url-based';
  urlTemplate: string; // e.g., "https://site.com/page/{{PAGE}}"
  startPage: number;
  maxPages?: number;
  waitAfterNavigate?: number;
}

export type PaginationConfig =
  | ScrollPagination
  | ClickNextPagination
  | UrlPagination
  | { type: 'none' };

// ─────────────────────────────────────────────
// Detail Page Types
// ─────────────────────────────────────────────

export interface DetailAction {
  clickSelector: string; // What to click to open detail
  waitForSelector: string; // Wait for this before extracting
  extractSchema: ExtractSchema; // What to extract from detail page
  backAction: 'browser.back' | 'close.tab' | string; // How to go back
  waitAfterBack?: number; // Wait after going back
}

// ─────────────────────────────────────────────
// Loop Task Types
// ─────────────────────────────────────────────

export interface LoopTask {
  id: string;
  name: string;

  // Pattern definition (LLM provides this)
  pattern: {
    containerSelector?: string; // Parent container
    itemSelector: string; // Each repeating item
    extractSchema: ExtractSchema; // What to extract per item
    detailAction?: DetailAction; // Optional detail page
    pagination?: PaginationConfig;
  };

  // Loop control
  control: {
    maxItems?: number;
    delayBetween: [number, number]; // [min, max] ms
    stopCondition?: string; // CSS selector - stop when found
    onError: 'skip' | 'retry' | 'stop';
    retryCount?: number;
  };
}

// ─────────────────────────────────────────────
// Result Types
// ─────────────────────────────────────────────

export interface ExtractedItem {
  index: number;
  data: Record<string, any>;
  sourceUrl: string;
  extractedAt: number;
  errors?: string[];
}

export interface LoopResult {
  taskId: string;
  taskName: string;
  success: boolean;

  // Stats
  totalItems: number;
  successfulItems: number;
  failedItems: number;
  pagesProcessed: number;
  duration: number;

  // Data
  items: ExtractedItem[];

  // Performance
  llmCallsUsed: number; // Always 0 (loop engine uses no LLM)
  estimatedSavings: string;

  errors: string[];
}

// ─────────────────────────────────────────────
// Pattern Detection Result (from LLM)
// ─────────────────────────────────────────────

export interface DetectedPattern {
  containerSelector?: string;
  itemSelector: string;
  visibleItemCount: number;
  extractSchema: ExtractSchema;
  hasPagination: boolean;
  paginationType?: PaginationType;
  pagination?: PaginationConfig;
  hasDetailPages?: boolean;
  detailAction?: DetailAction;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}
