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
  'POST:/product_offer/read': {
    isError: false, messages: [], results: [
      {
        id: 900001, name: 'Produs Demo 1', brand: 'Demo Brand', part_number: 'DEMO-001',
        ean: ['5900000000001'], category_id: 1001, status: 1, sale_price: 149.99,
        recommended_price: 199.99, min_sale_price: 100.00, max_sale_price: 250.00,
        currency_type: 'RON', stock: [{ warehouse_id: 1, value: 50 }],
        vat_rate: 0.19, handling_time: [{ warehouse_id: 1, value: 2 }],
        start_date: '2024-01-01 00:00:00',
      },
      {
        id: 900002, name: 'Produs Demo 2', brand: 'Demo Brand', part_number: 'DEMO-002',
        ean: ['5900000000002'], category_id: 1001, status: 1, sale_price: 89.99,
        recommended_price: 119.99, min_sale_price: 60.00, max_sale_price: 150.00,
        currency_type: 'RON', stock: [{ warehouse_id: 1, value: 30 }],
        vat_rate: 0.19, handling_time: [{ warehouse_id: 1, value: 2 }],
        start_date: '2024-01-01 00:00:00',
      },
    ],
  },
  'POST:/order/read': {
    isError: false, messages: [], results: [
      {
        id: 800001, status: 1, date: new Date().toISOString(), payment_mode: 'ramburs',
        payment_mode_id: 1, customer: { name: 'Ion Popescu', phone: '0712345678', billing_city: 'București',
          billing_street: 'Str. Demonstrației Nr. 1', billing_postal_code: '010001' },
        products: [
          { product_id: 900001, name: 'Produs Demo 1', quantity: 1, sale_price: 149.99,
            currency: 'RON', vat: 19, part_number: 'DEMO-001' },
        ],
        shipping_tax: 15.99, is_complete: 0,
      },
    ],
  },
  'POST:/product_offer/count': { isError: false, messages: [], results: 2 },
  'POST:/order/count': { isError: false, messages: [], results: 1 },
  'POST:/rma/read': { isError: false, messages: [], results: [] },
  'POST:/rma/count': { isError: false, messages: [], results: 0 },
  'POST:/awb/read': { isError: false, messages: [], results: [] },
  'POST:/category/read': {
    isError: false, messages: [], results: [
      { id: 1001, name: 'Categorie Demo', parent_id: 0 },
    ],
  },
  'default': { isError: false, messages: ['DEMO_MODE: No fixture data for this endpoint'], results: [] },
};

function getDemoResponse(method: string, endpoint: string): any {
  const key = `${method}:${endpoint}`;
  for (const [pattern, fixture] of Object.entries(DEMO_FIXTURES)) {
    if (pattern === 'default') continue;
    if (key.startsWith(pattern) || key === pattern) return fixture;
  }
  return DEMO_FIXTURES['default'];
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

    const config: AxiosRequestConfig = {
      method,
      url,
      headers: this.getHeaders(contentType),
      maxBodyLength: 10 * 1024 * 1024,
      maxRedirects: 0,
      timeout: 30000,
    };

    if (data) {
      config.data = data;
    }

    if (params) {
      config.params = params;
    }

    try {
      const response: AxiosResponse<T> = await axios(config);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  }

  async post<T>(endpoint: string, data?: any): Promise<EmagApiResponse<T>> {
    return this.request<EmagApiResponse<T>>('POST', endpoint, data);
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
}

export const createAuthToken = (username: string, password: string): string => {
  return Buffer.from(`${username}:${password}`, 'utf8').toString('base64');
};
