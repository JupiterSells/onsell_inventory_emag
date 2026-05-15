import { Request } from 'express';
import { Emag, createEmagClient, Platform } from '../../src';

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
 * Resolve an eMAG client for a request. Prefers per-request credential
 * headers (X-Emag-Username, X-Emag-Password, X-Emag-Platform) sent by
 * node_api's ConnectionJobScheduler. Falls back to the singleton client
 * for backward compatibility.
 */
export const getClientForRequest = (req: Request): Emag => {
  const username = req.headers['x-emag-username'] as string | undefined;
  const password = req.headers['x-emag-password'] as string | undefined;
  const platform = (req.headers['x-emag-platform'] as Platform) || 'ro';

  if (username && password) {
    return new Emag(username, password, platform);
  }

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
