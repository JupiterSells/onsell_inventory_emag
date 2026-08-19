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
  return client.save<any>('/product_offer/save', items);
};

export const saveOffer = async (
  client: ApiClient,
  data: OfferSaveRequest | OfferSaveRequest[]
): Promise<EmagApiResponse<any>> => {
  const items = Array.isArray(data) ? data : [data];
  return client.save<any>('/offer/save', items);
};

/**
 * Stock-only updates used to PATCH /offer_stock/{id}. eMAG still documents
 * that resource, but the live API rejects it with HTTP 400 (method/body).
 * Offer updates go through product_offer/save with the mandatory offer keys
 * (id, status, sale_price, vat_id, handling_time, stock) and without
 * documentation fields.
 */
export const updateStock = async (
  client: ApiClient,
  productId: number,
  stock: { warehouse_id: number; value: number }[]
): Promise<EmagApiResponse<any>> => {
  const current = await readProducts(client, { id: productId, itemsPerPage: 1 });
  if (current.isError) return current;
  const product = Array.isArray(current.results) ? current.results[0] : current.results;
  if (!product) {
    return {
      isError: true,
      messages: [`Produsul eMAG ${productId} nu a fost găsit`],
      results: [],
    };
  }

  const offerWarehouse =
    product.stock?.[0]?.warehouse_id ??
    product.handling_time?.[0]?.warehouse_id ??
    1;

  const nextStock = (Array.isArray(stock) && stock.length > 0
    ? stock
    : [{ warehouse_id: offerWarehouse, value: 0 }]
  ).map((row) => ({
    warehouse_id:
      row.warehouse_id === 1 && offerWarehouse !== 1 ? offerWarehouse : row.warehouse_id || offerWarehouse,
    value: Math.max(0, Number(row.value) || 0),
  }));

  return saveProductOffer(client, {
    id: productId,
    status: product.status,
    sale_price: product.sale_price,
    vat_id: product.vat_id,
    handling_time: product.handling_time?.length
      ? product.handling_time
      : [{ warehouse_id: offerWarehouse, value: 0 }],
    stock: nextStock,
  });
};

export const saveMeasurements = async (
  client: ApiClient,
  data: MeasurementsSaveRequest | MeasurementsSaveRequest[]
): Promise<EmagApiResponse<any>> => {
  const items = Array.isArray(data) ? data : [data];
  return client.save<any>('/measurements/save', items);
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
