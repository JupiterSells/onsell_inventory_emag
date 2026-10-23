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

type StockRow = { warehouse_id: number; value: number };

/** eMAG accepts at most 50 entities per save call. */
export const MAX_SAVE_BATCH = 50;

const cleanStock = (stock: StockRow[]): StockRow[] =>
  stock.map((row) => ({
    warehouse_id: Number(row.warehouse_id) || 1,
    value: Math.max(0, Number(row.value) || 0),
  }));

/**
 * Stock-only updates used to PATCH /offer_stock/{id}. eMAG still documents
 * that resource, but the live API rejects it with HTTP 400 (method/body).
 *
 * The light `offer/save` takes `{ id, stock }` alone and is one call. When
 * eMAG refuses it (typically a warehouse id the caller guessed wrong), the
 * offer is read and re-saved through product_offer/save with the mandatory
 * offer keys and the warehouse the offer actually uses.
 */
export const updateStock = async (
  client: ApiClient,
  productId: number,
  stock: StockRow[]
): Promise<EmagApiResponse<any>> => {
  if (Array.isArray(stock) && stock.length > 0) {
    const light = await saveOffer(client, { id: productId, stock: cleanStock(stock) } as OfferSaveRequest);
    if (!light.isError) return light;
  }
  return updateStockByProductOffer(client, productId, stock);
};

/**
 * Stock for many offers, `MAX_SAVE_BATCH` per light `offer/save` call. A
 * batch eMAG rejects is retried offer by offer, so one bad row does not
 * leave the other 49 unwritten; the per-offer outcome is returned in input
 * order.
 */
export const updateStockBulk = async (
  client: ApiClient,
  items: { id: number; stock: StockRow[] }[]
): Promise<{ id: number; ok: boolean; messages: string[] }[]> => {
  const outcomes: { id: number; ok: boolean; messages: string[] }[] = [];
  for (let start = 0; start < items.length; start += MAX_SAVE_BATCH) {
    const batch = items.slice(start, start + MAX_SAVE_BATCH);
    const saved = await saveOffer(
      client,
      batch.map((item) => ({ id: item.id, stock: cleanStock(item.stock) }) as OfferSaveRequest)
    );
    if (!saved.isError) {
      for (const item of batch) outcomes.push({ id: item.id, ok: true, messages: [] });
      continue;
    }
    for (const item of batch) {
      const one = await updateStock(client, item.id, item.stock);
      outcomes.push({
        id: item.id,
        ok: !one.isError,
        messages: Array.isArray(one.messages) ? one.messages.filter(Boolean).map(String) : [],
      });
    }
  }
  return outcomes;
};

const updateStockByProductOffer = async (
  client: ApiClient,
  productId: number,
  stock: StockRow[]
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
