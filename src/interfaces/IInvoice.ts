export interface EmagInvoiceCategory {
  category: string;
  name: string;
}

export interface EmagInvoiceEntity {
  name: string;
  register_number?: string;
  cif?: string;
  tax_code?: string;
  social_capital?: string;
  iban?: string;
  bank?: string;
  country?: string;
  address?: string;
  phone_number?: string;
}

export interface EmagInvoiceLine {
  product_name: string;
  unit_of_measure: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  value: number;
  vat_value: number;
}

export interface EmagInvoice {
  category: string;
  name: string;
  number: string;
  date: string;
  is_storno: number;
  supplier: EmagInvoiceEntity;
  customer: EmagInvoiceEntity;
  lines: EmagInvoiceLine[];
  payment_term: number;
  total_without_vat: number;
  total_vat_value: number;
  total_with_vat: number;
  currency: string;
}

export interface EmagCustomerInvoice {
  category: string;
  order_id: string;
  number: string;
  date: string;
  is_storno: number;
  reversal_for?: string;
  supplier: EmagInvoiceEntity;
  customer: EmagInvoiceEntity;
  lines: EmagInvoiceLine[];
  total_without_vat: number;
  total_vat_value: number;
  total_with_vat: number;
  currency: string;
}

export interface InvoiceFilterOptions {
  category?: string;
  number?: string;
  date_start?: string;
  date_end?: string;
  currentPage?: number;
  itemsPerPage?: number;
}

export interface CustomerInvoiceFilterOptions {
  category?: string; // 'normal' | 'storno'
  order_id?: string;
  number?: string;
  date_start?: string;
  date_end?: string;
  currentPage?: number;
  itemsPerPage?: number;
}

export interface InvoiceReadResponse {
  total_results: number;
  invoices: EmagInvoice[];
}

export interface CustomerInvoiceReadResponse {
  total_results: number;
  invoices: EmagCustomerInvoice[];
}
