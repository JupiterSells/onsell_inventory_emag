import * as dotenv from 'dotenv';

dotenv.config();

export type Platform = 'ro' | 'bg' | 'hu' | 'fd_ro' | 'fd_bg';

const PLATFORMS: readonly Platform[] = ['ro', 'bg', 'hu', 'fd_ro', 'fd_bg'] as const;

export interface EmagConfig {
  platform: Platform;
  username: string;
  password: string;
}

export const MARKETPLACE_API_URLS: Record<Platform, string> = {
  ro: 'https://marketplace-api.emag.ro/api-3',
  bg: 'https://marketplace-api.emag.bg/api-3',
  hu: 'https://marketplace-api.emag.hu/api-3',
  fd_ro: 'https://marketplace-ro-api.fashiondays.com/api-3',
  fd_bg: 'https://marketplace-bg-api.fashiondays.com/api-3',
};

export const MARKETPLACE_URLS: Record<Platform, string> = {
  ro: 'https://marketplace.emag.ro',
  bg: 'https://marketplace.emag.bg',
  hu: 'https://marketplace.emag.hu',
  fd_ro: 'https://marketplace-ro.fashiondays.com',
  fd_bg: 'https://marketplace-bg.fashiondays.com',
};

export const DEFAULT_CURRENCY: Record<Platform, string> = {
  ro: 'RON',
  bg: 'EUR',
  hu: 'HUF',
  fd_ro: 'RON',
  fd_bg: 'EUR',
};

export const PLATFORM_LOCALES: Record<Platform, string> = {
  ro: 'ro_RO',
  bg: 'bg_BG',
  hu: 'hu_HU',
  fd_ro: 'ro_RO',
  fd_bg: 'bg_BG',
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

export const isValidPlatform = (value: string): value is Platform => {
  return PLATFORMS.includes(value as Platform);
};

export const getDefaultPlatform = (): Platform => {
  const platform = process.env.EMAG_PLATFORM;
  if (platform && isValidPlatform(platform)) {
    return platform;
  }
  return 'ro';
};

export const isDemoMode = (): boolean => {
  const val = process.env.DEMO_MODE;
  return val === 'true' || val === '1';
};
