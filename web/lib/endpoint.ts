/**
 * Central API Endpoints and Service Layer for the Orbiter Frontend
 */

export const API_BASE = '/api/v1';

export const ENDPOINTS = {
  // Execution Domain
  EXECUTION_RUN: `${API_BASE}/execution/run`,
  EXECUTION_REPLAY: `${API_BASE}/execution/replay`,
  EXECUTION_SESSIONS: `${API_BASE}/execution/sessions`,
  EXECUTION_SESSION_DETAIL: (id: string) => `${API_BASE}/execution/sessions/${id}`,
  EXECUTION_SESSION_DATA: (id: string) => `${API_BASE}/execution/sessions/${id}/data`,
  
  // Flows Domain
  FLOWS: `${API_BASE}/flows`,
  FLOW_REFINE: (id: string) => `${API_BASE}/flows/${id}/refine`,
  
  // Memory Domain
  MEMORY_SELECTORS: `${API_BASE}/memory/selectors`,
  MEMORY_SELECTORS_SEARCH: `${API_BASE}/memory/selectors/search`,
  MEMORY_VECTOR_SEARCH: `${API_BASE}/memory/vector/search`,
  MEMORY_STATS: `${API_BASE}/memory/stats`,
  MEMORY_CLEAR: `${API_BASE}/memory`,
  
  // System Domain
  SYSTEM_CONFIG: `${API_BASE}/system/config`,
  SYSTEM_SETTINGS: `${API_BASE}/system/settings`,
  SYSTEM_PROFILES: `${API_BASE}/system/profiles`,
  SYSTEM_PROFILE_DETAIL: (name: string) => `${API_BASE}/system/profiles/${name}`,
  SYSTEM_MODELS: `${API_BASE}/system/models`,
};

// HTTP Utility Functions
async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok || (data && data.success === false)) {
    throw new Error(data?.error || `HTTP error! status: ${response.status}`);
  }
  return data as T;
}

// Service Methods for API interaction
export const orbiterApi = {
  // Execution
  async getSessions(page = 1, limit = 15) {
    const res = await fetch(`${ENDPOINTS.EXECUTION_SESSIONS}?page=${page}&limit=${limit}`);
    return handleResponse<any>(res);
  },

  async getSessionDetails(id: string, full = false) {
    const res = await fetch(`${ENDPOINTS.EXECUTION_SESSION_DETAIL(id)}?full=${full}`);
    return handleResponse<any>(res);
  },

  async getSessionData(id: string, json = false) {
    const res = await fetch(`${ENDPOINTS.EXECUTION_SESSION_DATA(id)}?json=${json}`);
    return handleResponse<any>(res);
  },

  async runTask(payload: {
    prompt: string;
    model?: string;
    profile?: string;
    headless?: boolean;
    maxSteps?: number;
    record?: boolean;
    enhance?: boolean;
    highlight?: boolean;
  }) {
    const res = await fetch(ENDPOINTS.EXECUTION_RUN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<any>(res);
  },

  async replayFlow(payload: {
    flowPath: string;
    params?: Record<string, any>;
    headless?: boolean;
    profile?: string;
    stopOnError?: boolean;
    screenshotSteps?: boolean;
    skipSteps?: number[];
  }) {
    const res = await fetch(ENDPOINTS.EXECUTION_REPLAY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<any>(res);
  },

  // Flows
  async getFlows(page = 1, limit = 10, type?: 'raw' | 'optimized') {
    let url = `${ENDPOINTS.FLOWS}?page=${page}&limit=${limit}`;
    if (type) url += `&type=${type}`;
    const res = await fetch(url);
    return handleResponse<any>(res);
  },

  async refineFlow(id: string, mode: 'auto' | 'llm' | 'interactive', options?: {
    removeFailures?: boolean;
    mergeSteps?: boolean;
    outputPath?: string;
    dryRun?: boolean;
  }) {
    const res = await fetch(ENDPOINTS.FLOW_REFINE(id), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, options }),
    });
    return handleResponse<any>(res);
  },

  // Memory
  async getSelectors(domain: string, limit = 20) {
    const res = await fetch(`${ENDPOINTS.MEMORY_SELECTORS}?domain=${encodeURIComponent(domain)}&limit=${limit}`);
    return handleResponse<any>(res);
  },

  async searchSelectors(domain: string, query: string) {
    const res = await fetch(`${ENDPOINTS.MEMORY_SELECTORS_SEARCH}?domain=${encodeURIComponent(domain)}&query=${encodeURIComponent(query)}`);
    return handleResponse<any>(res);
  },

  async searchVector(domain: string, query: string, limit = 3) {
    const res = await fetch(ENDPOINTS.MEMORY_VECTOR_SEARCH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, query, limit }),
    });
    return handleResponse<any>(res);
  },

  async getMemoryStats() {
    const res = await fetch(ENDPOINTS.MEMORY_STATS);
    return handleResponse<any>(res);
  },

  async clearMemory(domain?: string, all = false) {
    let url = ENDPOINTS.MEMORY_CLEAR;
    if (all) {
      url += `?all=true`;
    } else if (domain) {
      url += `?domain=${encodeURIComponent(domain)}`;
    }
    const res = await fetch(url, { method: 'DELETE' });
    return handleResponse<any>(res);
  },

  // System
  async getConfig() {
    const res = await fetch(ENDPOINTS.SYSTEM_CONFIG);
    return handleResponse<any>(res);
  },

  async updateSettings(settings: { key: string; value: string }[]) {
    const res = await fetch(ENDPOINTS.SYSTEM_SETTINGS, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings }),
    });
    return handleResponse<any>(res);
  },

  async getProfiles() {
    const res = await fetch(ENDPOINTS.SYSTEM_PROFILES);
    return handleResponse<any>(res);
  },

  async getProfileDetails(name: string) {
    const res = await fetch(ENDPOINTS.SYSTEM_PROFILE_DETAIL(name));
    return handleResponse<any>(res);
  },

  async createProfile(name: string, description?: string) {
    const res = await fetch(ENDPOINTS.SYSTEM_PROFILES, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    return handleResponse<any>(res);
  },

  async getModels(provider?: string) {
    let url = ENDPOINTS.SYSTEM_MODELS;
    if (provider) url += `?provider=${encodeURIComponent(provider)}`;
    const res = await fetch(url);
    return handleResponse<any>(res);
  },
};
