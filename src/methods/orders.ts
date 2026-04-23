import { ApiClient, EmagApiResponse } from '../utils/apiClient';
import { EmagOrder, OrderFilterOptions } from '../interfaces/IOrder';

export const readOrders = async (
  client: ApiClient,
  filters?: OrderFilterOptions
): Promise<EmagApiResponse<EmagOrder[]>> => {
  return client.post<EmagOrder[]>('/order/read', filters);
};

export const countOrders = async (
  client: ApiClient,
  filters?: OrderFilterOptions
): Promise<EmagApiResponse<number>> => {
  return client.post<number>('/order/count', filters);
};

export const saveOrder = async (
  client: ApiClient,
  data: Partial<EmagOrder>
): Promise<EmagApiResponse<any>> => {
  return client.post<any>('/order/save', [data]);
};

export const acknowledgeOrder = async (
  client: ApiClient,
  orderId: number
): Promise<EmagApiResponse<any>> => {
  return client.post<any>(`/order/acknowledge/${orderId}`, {});
};
