import { ApiClient, EmagApiResponse } from '../utils/apiClient';
import { EmagOrderAttachment } from '../interfaces/IOrder';

export const readAttachments = async (
  client: ApiClient,
  orderId: number
): Promise<EmagApiResponse<EmagOrderAttachment[]>> => {
  return client.post<EmagOrderAttachment[]>('/order/attachments/read', { order_id: orderId });
};

export const saveAttachment = async (
  client: ApiClient,
  data: EmagOrderAttachment | EmagOrderAttachment[]
): Promise<EmagApiResponse<any>> => {
  const items = Array.isArray(data) ? data : [data];
  return client.post<any>('/order/attachments/save', items);
};
