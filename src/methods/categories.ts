import { ApiClient, EmagApiResponse } from '../utils/apiClient';
import { EmagCategory, CategoryFilterOptions, EmagVat, EmagHandlingTimeValue } from '../interfaces/ICategory';

export const readCategories = async (
  client: ApiClient,
  filters?: CategoryFilterOptions
): Promise<EmagApiResponse<EmagCategory[]>> => {
  return client.post<EmagCategory[]>('/category/read', filters);
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
