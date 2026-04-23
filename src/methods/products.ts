import { ApiClient, EmagApiResponse } from '../utils/apiClient';
import { EmagProduct, ProductFilterOptions, ProductSaveRequest, OfferSaveRequest, MeasurementsSaveRequest } from '../interfaces/IProduct';

export const readProducts = async (
  client: ApiClient,
  filters?: ProductFilterOptions
): Promise<EmagApiResponse<EmagProduct[]>> => {
  return client.post<EmagProduct[]>('/product_offer/read', filters);
};

export const countProducts = async (
  client: ApiClient,
  filters?: ProductFilterOptions
): Promise<EmagApiResponse<number>> => {
  return client.post<number>('/product_offer/count', filters);
};

export const saveProductOffer = async (
  client: ApiClient,
  data: ProductSaveRequest | ProductSaveRequest[]
): Promise<EmagApiResponse<any>> => {
  const items = Array.isArray(data) ? data : [data];
  return client.post<any>('/product_offer/save', items);
};

export const saveOffer = async (
  client: ApiClient,
  data: OfferSaveRequest | OfferSaveRequest[]
): Promise<EmagApiResponse<any>> => {
  const items = Array.isArray(data) ? data : [data];
  return client.post<any>('/offer/save', items);
};

export const updateStock = async (
  client: ApiClient,
  productId: number,
  stock: { warehouse_id: number; value: number }[]
): Promise<any> => {
  return client.patch(`/offer_stock/${productId}`, { stock });
};

export const saveMeasurements = async (
  client: ApiClient,
  data: MeasurementsSaveRequest | MeasurementsSaveRequest[]
): Promise<EmagApiResponse<any>> => {
  const items = Array.isArray(data) ? data : [data];
  return client.post<any>('/measurements/save', items);
};

export const findByEans = async (
  client: ApiClient,
  eans: string[]
): Promise<EmagApiResponse<any>> => {
  const params: Record<string, string> = {};
  eans.forEach((ean, i) => {
    params[`eans[${i}]`] = ean;
  });
  return client.get('/documentation/find_by_eans', params);
};
