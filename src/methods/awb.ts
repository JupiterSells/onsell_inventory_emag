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

export const readAwbPdf = async (
  client: ApiClient,
  emagId: number,
  format: string = 'A4'
): Promise<any> => {
  return client.get(`/awb/read_pdf`, { emag_id: emagId, awb_format: format });
};

export const readAwbZpl = async (
  client: ApiClient,
  emagId: number
): Promise<any> => {
  return client.get(`/awb/read_zpl`, { emag_id: emagId });
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
