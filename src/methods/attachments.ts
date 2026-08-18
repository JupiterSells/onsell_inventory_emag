import { ApiClient, EmagApiResponse } from '../utils/apiClient';
import { EmagOrderAttachment } from '../interfaces/IOrder';

export const readAttachments = async (
  client: ApiClient,
  orderId: number,
  orderType?: number
): Promise<EmagApiResponse<EmagOrderAttachment[]>> => {
  const filters: Record<string, number> = { order_id: orderId };
  if (orderType !== undefined) filters.order_type = orderType;
  return client.post<EmagOrderAttachment[]>('/order/attachments/read', filters);
};

export const saveAttachment = async (
  client: ApiClient,
  data: EmagOrderAttachment | EmagOrderAttachment[]
): Promise<EmagApiResponse<any>> => {
  const items = Array.isArray(data) ? data : [data];
  return client.save<any>('/order/attachments/save', items);
};
