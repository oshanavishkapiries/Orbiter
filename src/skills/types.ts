export interface SiteSkill {
  name: string;
  domain: string;       // URL substring to match, e.g. "google.com/maps"
  description: string;
  context: string;      // Injected into LLM history on first visit
  selectors?: Record<string, string>;
  pagination?: {
    type: 'click_next' | 'url_page' | 'infinite_scroll';
    selector?: string;
    urlTemplate?: string;
  };
}
