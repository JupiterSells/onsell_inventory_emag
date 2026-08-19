import axios from 'axios';
import { ApiClient, EmagApiResponse } from '../utils/apiClient';
import { EmagOrderAttachment } from '../interfaces/IOrder';

const PDF_MAGIC = Buffer.from('%PDF');

export const isPdfBuffer = (buf: Buffer): boolean =>
  buf.length >= 4 && buf.subarray(0, 4).equals(PDF_MAGIC);

export const readAttachments = async (
  client: ApiClient,
  orderId: number,
  orderType?: number
): Promise<EmagApiResponse<EmagOrderAttachment[]>> => {
  const filters: Record<string, number> = { order_id: orderId };
  if (orderType !== undefined) filters.order_type = orderType;
  return client.post<EmagOrderAttachment[]>('/order/attachments/read', filters);
};

/**
 * Attachment URLs from `/order/attachments/read` are often marketplace.emag.*
 * pages. The browser shows the seller login; the Marketplace API Basic auth
 * that we already hold can fetch the file server-side (same pattern as
 * commission/estimate on marketplace.emag.ro).
 */
export const downloadAuthenticatedFile = async (
  client: ApiClient,
  url: string
): Promise<Buffer | null> => {
  const attempts: Array<Record<string, string>> = [
    { Authorization: `Basic ${client.getAuthToken()}` },
    {},
  ];

  for (const headers of attempts) {
    try {
      const response = await axios.get<ArrayBuffer>(url, {
        headers,
        responseType: 'arraybuffer',
        timeout: 20000,
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400,
      });
      const buf = Buffer.from(response.data);
      if (isPdfBuffer(buf)) return buf;
    } catch {
      // Try the next auth variant.
    }
  }

  return null;
};

export const pickInvoiceAttachment = (
  attachments: EmagOrderAttachment[] | undefined
): EmagOrderAttachment | undefined => {
  const list = attachments || [];
  return list.find((a) => a.type === 1 && a.url) || list.find((a) => a.type === 11 && a.url);
};

export const saveAttachment = async (
  client: ApiClient,
  data: EmagOrderAttachment | EmagOrderAttachment[]
): Promise<EmagApiResponse<any>> => {
  const items = Array.isArray(data) ? data : [data];
  return client.save<any>('/order/attachments/save', items);
};
