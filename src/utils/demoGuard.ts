import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { isDemoMode } from '../config';

/**
 * Fail-closed outbound network guard.
 *
 * On the demo tenant every integration is mocked in node_api's proxy layer, so
 * this service should never be reached at all. If it somehow is — a stale route,
 * a job, a manual call — this guard makes sure no request leaves the box, rather
 * than quietly hitting the real provider with demo credentials.
 *
 * Imported for its side effect as the very first import of the entry point, so
 * it patches axios before any module has a chance to build a client.
 */

let installed = false;

function blockedError(target: string): Error {
  return new Error(
    `[DEMO_GUARD] Outbound request to ${target} blocked because DEMO_MODE is enabled`
  );
}

function guard(instance: AxiosInstance): void {
  instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const target = `${config.baseURL ?? ''}${config.url ?? ''}` || 'unknown host';
    console.warn(`[DEMO_GUARD] Blocked ${(config.method ?? 'get').toUpperCase()} ${target}`);
    throw blockedError(target);
  });
}

export function installDemoNetworkGuard(): void {
  if (installed || !isDemoMode()) return;
  installed = true;

  guard(axios);

  const originalCreate = axios.create.bind(axios);
  axios.create = ((config?: Parameters<typeof originalCreate>[0]) => {
    const instance = originalCreate(config);
    guard(instance);
    return instance;
  }) as typeof axios.create;

  const globalScope = globalThis as { fetch?: unknown };
  if (typeof globalScope.fetch === 'function') {
    globalScope.fetch = (input: unknown): Promise<never> =>
      Promise.reject(blockedError(String(input)));
  }

  console.log('[DEMO_GUARD] DEMO_MODE active — all outbound HTTP requests are blocked');
}

installDemoNetworkGuard();
