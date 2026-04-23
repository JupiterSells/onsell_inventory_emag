import axios, { AxiosRequestConfig, AxiosResponse, Method } from 'axios';

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
