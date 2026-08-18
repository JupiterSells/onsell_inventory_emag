import axios, { AxiosRequestConfig, AxiosResponse, Method } from 'axios';
import { isDemoMode } from '../config';

export interface ApiClientConfig {
  username: string;
  password: string;
  baseUrl: string;
}

export interface EmagApiResponse<T = any> {
  isError: boolean;
  messages: string[];
  results: T;
}

const DEMO_FIXTURES: Record<string, any> = {
  'POST:/product_offer/read': { isError: false, messages: [], results: [] },
  'POST:/order/read': { isError: false, messages: [], results: [] },
  'POST:/product_offer/count': { isError: false, messages: [], results: 0 },
  'POST:/order/count': { isError: false, messages: [], results: 0 },
  'POST:/rma/read': { isError: false, messages: [], results: [] },
  'POST:/rma/count': { isError: false, messages: [], results: 0 },
  'POST:/awb/read': { isError: false, messages: [], results: [] },
  'POST:/category/read': { isError: false, messages: [], results: [] },
  'default': { isError: false, messages: [], results: [] },
};

function getDemoResponse(method: string, endpoint: string): any {
  const key = `${method}:${endpoint}`;
  for (const [pattern, fixture] of Object.entries(DEMO_FIXTURES)) {
    if (pattern === 'default') continue;
    if (key.startsWith(pattern) || key === pattern) return fixture;
  }
  return DEMO_FIXTURES['default'];
}

// ── Documented API constraints (v4.5.1 §1.5, §pagination) ────────────────────
// Rate limits: 12 req/s for order resources, 3 req/s cumulative for the rest.
const ORDERS_MIN_TIME_MS = Math.ceil(1000 / 12); // ~84ms
const GENERAL_MIN_TIME_MS = Math.ceil(1000 / 3); // ~334ms
// Bulk save: max 50 entities per request (§save actions).
const MAX_BULK_SAVE = 50;
// Pagination: itemsPerPage maximum is 100.
const MAX_ITEMS_PER_PAGE = 100;
// Retry policy for 429 / 5xx.
const MAX_RETRIES = 4;
const BASE_BACKOFF_MS = 500;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Serial token bucket: runs one task at a time and spaces successive tasks by
 * `minTime`, which is enough to stay under eMAG's per-second ceilings without a
 * third-party dependency. Order and non-order resources get separate buckets so
 * the 12/s order budget is never spent by a burst of catalogue calls.
 */
class TokenBucket {
  private chain: Promise<unknown> = Promise.resolve();
  private last = 0;

  constructor(private readonly minTime: number) {}

  schedule<T>(task: () => Promise<T>): Promise<T> {
    const result = this.chain.then(async () => {
      const wait = this.last + this.minTime - Date.now();
      if (wait > 0) await sleep(wait);
      this.last = Date.now();
      return task();
    });
    // Keep the chain alive even when a task rejects, so one failure does not
    // wedge the bucket.
    this.chain = result.then(
      () => undefined,
      () => undefined
    );
    return result as Promise<T>;
  }
}

const ordersBucket = new TokenBucket(ORDERS_MIN_TIME_MS);
const generalBucket = new TokenBucket(GENERAL_MIN_TIME_MS);

function bucketFor(endpoint: string): TokenBucket {
  return endpoint.startsWith('/order') ? ordersBucket : generalBucket;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function isRetryableStatus(status?: number): boolean {
  return status === 429 || (status != null && status >= 500 && status <= 599);
}

export class ApiClient {
  private config: ApiClientConfig;
  private token: string;

  constructor(config: ApiClientConfig) {
    this.config = config;
    this.token = Buffer.from(
      `${config.username}:${config.password}`,
      'utf8'
    ).toString('base64');
  }

  private getHeaders(contentType: string = 'application/json'): Record<string, string> {
    return {
      Authorization: `Basic ${this.token}`,
      'Content-Type': contentType,
      'Accept-Encoding': 'gzip, deflate, br',
    };
  }

  /** Clamp pagination to the documented maximum so requests never 400 on it. */
  private clampPagination(data: any): any {
    if (data && typeof data === 'object' && !Array.isArray(data) && data.itemsPerPage != null) {
      const n = Number(data.itemsPerPage);
      if (Number.isFinite(n) && n > MAX_ITEMS_PER_PAGE) {
        return { ...data, itemsPerPage: MAX_ITEMS_PER_PAGE };
      }
    }
    return data;
  }

  async request<T>(
    method: Method,
    endpoint: string,
    data?: any,
    params?: Record<string, any>,
    contentType?: string
  ): Promise<T> {
    if (isDemoMode()) {
      return getDemoResponse(method, endpoint) as T;
    }

    const url = `${this.config.baseUrl}${endpoint}`;
    const body = this.clampPagination(data);

    const config: AxiosRequestConfig = {
      method,
      url,
      headers: this.getHeaders(contentType),
      maxBodyLength: 10 * 1024 * 1024,
      maxRedirects: 0,
      timeout: 30000,
    };

    if (body !== undefined) {
      config.data = body;
    }

    if (params) {
      config.params = params;
    }

    return bucketFor(endpoint).schedule(() => this.sendWithRetry<T>(config, endpoint));
  }

  private async sendWithRetry<T>(config: AxiosRequestConfig, endpoint: string): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response: AxiosResponse<T> = await axios(config);
        return response.data;
      } catch (error: any) {
        lastError = error;
        const status = error?.response?.status;
        if (!isRetryableStatus(status) || attempt === MAX_RETRIES) {
          throw error;
        }

        const remaining = Number(error?.response?.headers?.['x-ratelimit-remaining-3second']);
        const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt) + Math.floor(Math.random() * 200);
        console.warn(
          `[eMAG] ${status} on ${endpoint} (attempt ${attempt + 1}/${MAX_RETRIES + 1}), ` +
            `retrying in ${backoff}ms` +
            (Number.isFinite(remaining) ? ` (rate-limit remaining: ${remaining})` : '')
        );
        await sleep(backoff);
      }
    }

    throw lastError;
  }

  async post<T>(endpoint: string, data?: any, params?: Record<string, any>): Promise<EmagApiResponse<T>> {
    return this.request<EmagApiResponse<T>>('POST', endpoint, data, params);
  }

  /**
   * Save/write helper. eMAG requires the documented `{ "data": [ ... ] }`
   * envelope and caps each request at 50 entities, so this chunks the input,
   * wraps every chunk, and aggregates the per-chunk responses.
   */
  async save<T = any>(endpoint: string, items: any[], chunkSize = MAX_BULK_SAVE): Promise<EmagApiResponse<T>> {
    const list = Array.isArray(items) ? items : [items];
    const chunks = list.length > 0 ? chunk(list, Math.min(chunkSize, MAX_BULK_SAVE)) : [[]];

    const aggregated: EmagApiResponse<any> = { isError: false, messages: [], results: [] };

    for (const part of chunks) {
      const resp = await this.post<any>(endpoint, { data: part });
      if (resp?.isError) aggregated.isError = true;
      if (Array.isArray(resp?.messages)) aggregated.messages.push(...resp.messages);
      if (Array.isArray(resp?.results)) {
        aggregated.results.push(...resp.results);
      } else if (resp?.results !== undefined) {
        aggregated.results = resp.results;
      }
    }

    return aggregated as EmagApiResponse<T>;
  }

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    return this.request<T>('GET', endpoint, undefined, params);
  }

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>('PATCH', endpoint, data);
  }

  getBaseUrl(): string {
    return this.config.baseUrl;
  }

  getUsername(): string {
    return this.config.username;
  }

  getAuthToken(): string {
    return this.token;
  }
}

export const createAuthToken = (username: string, password: string): string => {
  return Buffer.from(`${username}:${password}`, 'utf8').toString('base64');
};
