import { ApiClient, EmagApiResponse } from '../utils/apiClient';
import { EmagLocality, LocalityFilterOptions, EmagCourierAccount, EmagAddress } from '../interfaces/IAwb';

export const readLocalities = async (
  client: ApiClient,
  filters?: LocalityFilterOptions
): Promise<EmagApiResponse<EmagLocality[]>> => {
  return client.post<EmagLocality[]>('/locality/read', filters);
};

export const countLocalities = async (
  client: ApiClient,
  filters?: LocalityFilterOptions
): Promise<EmagApiResponse<number>> => {
  return client.post<number>('/locality/count', filters);
};

export const readCourierAccounts = async (
  client: ApiClient
): Promise<EmagApiResponse<EmagCourierAccount[]>> => {
  return client.post<EmagCourierAccount[]>('/courier_accounts/read', {});
};

export const readAddresses = async (
  client: ApiClient
): Promise<EmagApiResponse<EmagAddress[]>> => {
  return client.post<EmagAddress[]>('/addresses/read', {});
};
