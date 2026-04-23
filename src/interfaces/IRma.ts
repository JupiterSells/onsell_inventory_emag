export interface EmagRmaProduct {
  id: number;
  product_emag_id?: number;
  product_id: number;
  quantity: number;
  product_name: string;
  return_reason: number;
  observations?: string;
  diagnostic?: number;
  reject_reason?: number;
  refund_value?: string;
}

export interface EmagRmaAwb {
  reservation_id?: number;
}

export interface EmagRma {
  emag_id: number;
  id?: number;
  order_id: number;
  type: number; // 2=fulfilled by eMAG, 3=fulfilled by seller
  invoice_number?: string;
  customer_name: string;
  customer_company?: string;
  customer_phone: string;
  products: EmagRmaProduct[];
  awbs?: EmagRmaAwb[];
  pickup_country: string;
  pickup_suburb: string;
  pickup_city: string;
  pickup_address: string;
  pickup_address_id?: number;
  pickup_zipcode?: string;
  pickup_date?: string;
  pickup_locality_id: number;
  pickup_method: number; // 1=eMAG courier, 2=Seller courier, 3=Sent by client
  return_reason: number;
  observations?: string;
  return_type: number; // 1=Replace same, 2=Replace diff, 3=Refund, 4=Cancel payment, 5=Voucher
  return_address_id?: number;
  return_tax_value?: number;
  customer_account_iban?: string;
  customer_account_bank?: string;
  customer_account_beneficiary?: string;
  replacement_product_emag_id?: number;
  replacement_product_id?: number;
  replacement_product_name?: string;
  replacement_product_quantity?: number;
  date: string;
  request_status?: number; // 1=Incomplete, 2=New, 3=Approved, 4=Refused, 5=Cancelled, 6=Received, 7=Finalized
  currency?: string;
}

export interface RmaFilterOptions {
  id?: number;
  emag_id?: number;
  order_id?: number;
  product_id?: number;
  product_emag_id?: number;
  request_status?: number;
  date_start?: string;
  date_end?: string;
  type?: number;
  currentPage?: number;
  itemsPerPage?: number;
}
