import { ApiClient } from '../utils/apiClient';
import { EmagApiResponse } from '../interfaces/ICommon';

export interface MessageFilterOptions {
  id?: number;
  order_id?: number;
  status?: number;
  currentPage?: number;
  itemsPerPage?: number;
}

export const readMessages = async (
  client: ApiClient,
  filters?: MessageFilterOptions
): Promise<EmagApiResponse<any[]>> => {
  return client.post('/message/read', filters || {});
};

export const countMessages = async (
  client: ApiClient,
  filters?: MessageFilterOptions
): Promise<EmagApiResponse<number>> => {
  return client.post('/message/count', filters || {});
};

export const saveMessage = async (
  client: ApiClient,
  data: { order_id: number; text: string }
): Promise<EmagApiResponse<any>> => {
  return client.post('/message/save', [data]);
};
