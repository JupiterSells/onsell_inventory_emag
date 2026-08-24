import { ApiClient, EmagApiResponse } from '../utils/apiClient';
import { AwbSaveRequest, EmagAwb, AwbFilterOptions, AwbPackagePreset, EmagVolumetry } from '../interfaces/IAwb';

export const readAwb = async (
  client: ApiClient,
  filters: AwbFilterOptions
): Promise<EmagApiResponse<EmagAwb[]>> => {
  return client.post<EmagAwb[]>('/awb/read', filters);
};

export const saveAwb = async (
  client: ApiClient,
  data: AwbSaveRequest | AwbSaveRequest[]
): Promise<EmagApiResponse<any>> => {
  const items = Array.isArray(data) ? data : [data];
  return client.save<any>('/awb/save', items);
};

export interface AwbLabel {
  buffer: Buffer;
  contentType: string;
}

/** Returns the PDF bytes; only AWBs issued through the API have an `emag_id`. */
export const readAwbPdf = async (
  client: ApiClient,
  emagId: number,
  format: string = 'A4'
): Promise<AwbLabel> => {
  const file = await client.getFile('/awb/read_pdf', {
    emag_id: emagId,
    awb_format: format,
  });
  return { buffer: file.buffer, contentType: file.contentType || 'application/pdf' };
};

/**
 * eMAG answers `read_zpl` with base64-encoded ZPL, so it is decoded here and the
 * caller gets printable label data.
 */
export const readAwbZpl = async (client: ApiClient, emagId: number): Promise<AwbLabel> => {
  const file = await client.getFile('/awb/read_zpl', { emag_id: emagId });
  const text = file.buffer.toString('utf8').trim();
  const isBase64 = text.length > 0 && /^[A-Za-z0-9+/\r\n]+={0,2}$/.test(text);
  return {
    buffer: isBase64 ? Buffer.from(text, 'base64') : file.buffer,
    contentType: 'application/octet-stream',
  };
};

export const readPackages = async (
  client: ApiClient
): Promise<EmagApiResponse<AwbPackagePreset[]>> => {
  return client.post<AwbPackagePreset[]>('/awb/package/read', {});
};

export const savePackages = async (
  client: ApiClient,
  data: AwbPackagePreset[]
): Promise<EmagApiResponse<any>> => {
  return client.save<any>('/awb/package/save', data);
};

export const readVolumetry = async (
  client: ApiClient,
  orderId: number,
  type?: number,
  productId?: number
): Promise<EmagApiResponse<EmagVolumetry[]>> => {
  const filters: any = { order_id: orderId };
  if (type !== undefined) filters.type = type;
  if (productId !== undefined) filters.product_id = productId;
  return client.post<EmagVolumetry[]>('/order/volumetry/read', filters);
};
