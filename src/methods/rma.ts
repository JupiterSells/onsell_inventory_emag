import { ApiClient, EmagApiResponse } from '../utils/apiClient';
import { EmagRma, RmaFilterOptions } from '../interfaces/IRma';

export const readRma = async (
  client: ApiClient,
  filters?: RmaFilterOptions
): Promise<EmagApiResponse<EmagRma[]>> => {
  return client.post<EmagRma[]>('/rma/read', filters);
};

export const countRma = async (
  client: ApiClient,
  filters?: RmaFilterOptions
): Promise<EmagApiResponse<number>> => {
  return client.post<number>('/rma/count', filters);
};

export const saveRma = async (
  client: ApiClient,
  data: Partial<EmagRma>
): Promise<EmagApiResponse<any>> => {
  return client.post<any>('/rma/save', [data]);
};
