import { Request } from 'express';
import { Emag, createEmagClient, Platform } from '../../src';
import { ApiError } from './errorHandler';

let emagClient: Emag | null = null;
let credentialsConfigured = false;

export const getEmagClient = (): Emag | null => {
  if (!emagClient) {
    try {
      emagClient = createEmagClient();
      credentialsConfigured = true;
      console.log(`[eMAG] Client initialized for platform: ${emagClient.platform}`);
    } catch (error: any) {
      console.log(`[eMAG] Client not initialized: ${error.message}`);
      credentialsConfigured = false;
      return null;
    }
  }
  return emagClient;
};

/**
 * How to treat a request that carries no credential headers.
 *
 * `off` is the correct setting and the only safe one once this process serves
 * more than one account: without headers there is no way to know whose account
 * the caller meant, and the env singleton belongs to whoever was configured
 * last. `warn` exists only to carry existing tenants across the change — it
 * logs every occurrence so the callers can be found and fixed first.
 */
const FALLBACK_MODE: 'warn' | 'off' =
  process.env.CREDENTIAL_FALLBACK === 'off' ? 'off' : 'warn';

/**
 * Resolve an eMAG client for a request from the per-request credential headers
 * (X-Emag-Username, X-Emag-Password, X-Emag-Platform) that node_api attaches to
 * every call.
 */
export const getClientForRequest = (req: Request): Emag => {
  const username = req.headers['x-emag-username'] as string | undefined;
  const password = req.headers['x-emag-password'] as string | undefined;
  const platform = (req.headers['x-emag-platform'] as Platform) || 'ro';

  if (username && password) {
    return new Emag(username, password, platform);
  }

  if (FALLBACK_MODE === 'off') {
    throw new ApiError(
      'eMAG credentials missing from request. The caller must send X-Emag-Username and X-Emag-Password.',
      400
    );
  }

  console.warn(
    `[eMAG][SECURITY] ${req.method} ${req.originalUrl} arrived without credential headers; ` +
      'falling back to the process-wide env credentials. This request may act on the wrong eMAG account.'
  );
  return requireEmagClient();
};

export const requireEmagClient = (): Emag => {
  const client = getEmagClient();
  if (!client) {
    throw new Error('eMAG credentials not configured. Please configure credentials in Settings.');
  }
  return client;
};

export const hasCredentials = (): boolean => {
  if (!emagClient) {
    getEmagClient();
  }
  return credentialsConfigured && emagClient !== null;
};

export const createCustomClient = (
  username: string,
  password: string,
  platform: Platform = 'ro'
): Emag => {
  return new Emag(username, password, platform);
};

export const resetClient = (): void => {
  emagClient = null;
  credentialsConfigured = false;
};

export const getPlatform = (): Platform => {
  const client = getEmagClient();
  return client?.platform || (process.env.EMAG_PLATFORM as Platform) || 'ro';
};

export const getUsername = (): string => {
  const client = getEmagClient();
  return client?.getUsername() || '';
};
