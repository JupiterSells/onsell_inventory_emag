import { ApiClient, EmagApiResponse } from '../utils/apiClient';
import {
  EmagInvoiceCategory,
  InvoiceFilterOptions,
  InvoiceReadResponse,
  CustomerInvoiceFilterOptions,
  CustomerInvoiceReadResponse,
} from '../interfaces/IInvoice';

export const readInvoiceCategories = async (
  client: ApiClient
): Promise<EmagApiResponse<EmagInvoiceCategory[]>> => {
  return client.post<EmagInvoiceCategory[]>('/invoice/categories/read', {});
};

export const readInvoices = async (
  client: ApiClient,
  filters?: InvoiceFilterOptions
): Promise<EmagApiResponse<InvoiceReadResponse>> => {
  return client.post<InvoiceReadResponse>('/invoice/read', filters);
};

export const readCustomerInvoices = async (
  client: ApiClient,
  filters?: CustomerInvoiceFilterOptions
): Promise<EmagApiResponse<CustomerInvoiceReadResponse>> => {
  return client.post<CustomerInvoiceReadResponse>('/customer-invoice/read', filters);
};
