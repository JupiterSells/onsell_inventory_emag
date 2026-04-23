import * as dotenv from 'dotenv';

dotenv.config();

export type Platform = 'ro';

export interface EmagConfig {
  platform: Platform;
  username: string;
  password: string;
}

export const MARKETPLACE_API_URLS: Record<Platform, string> = {
  ro: 'https://marketplace-api.emag.ro/api-3',
};

export const MARKETPLACE_URLS: Record<Platform, string> = {
  ro: 'https://marketplace.emag.ro',
};

export const DEFAULT_CURRENCY: Record<Platform, string> = {
  ro: 'RON',
};

export const getApiBaseUrl = (platform: Platform): string => {
  return MARKETPLACE_API_URLS[platform];
};

export const getMarketplaceUrl = (platform: Platform): string => {
  return MARKETPLACE_URLS[platform];
};

export const getEnvCredentials = (platform: Platform = 'ro'): EmagConfig => {
  const username = process.env.EMAG_USERNAME || '';
  const password = process.env.EMAG_PASSWORD || '';

  return {
    platform,
    username,
    password,
  };
};

export const getDefaultPlatform = (): Platform => {
  const platform = process.env.EMAG_PLATFORM;
  return (platform as Platform) || 'ro';
};
