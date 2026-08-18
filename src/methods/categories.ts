import { ApiClient, EmagApiResponse } from '../utils/apiClient';
import { EmagCategory, CategoryFilterOptions, EmagVat, EmagHandlingTimeValue } from '../interfaces/ICategory';

export const readCategories = async (
  client: ApiClient,
  filters?: CategoryFilterOptions
): Promise<EmagApiResponse<EmagCategory[]>> => {
  // `language` is a query parameter (`category/read?language=en`), not a body filter.
  const { language, ...body } = filters || {};
  return client.post<EmagCategory[]>('/category/read', body, language ? { language } : undefined);
};

export const countCategories = async (
  client: ApiClient,
  filters?: CategoryFilterOptions
): Promise<EmagApiResponse<number>> => {
  return client.post<number>('/category/count', filters);
};

export const readVat = async (
  client: ApiClient
): Promise<EmagApiResponse<EmagVat[]>> => {
  return client.post<EmagVat[]>('/vat/read', {});
};

export const readHandlingTime = async (
  client: ApiClient
): Promise<EmagApiResponse<EmagHandlingTimeValue[]>> => {
  return client.post<EmagHandlingTimeValue[]>('/handling_time/read', {});
};
