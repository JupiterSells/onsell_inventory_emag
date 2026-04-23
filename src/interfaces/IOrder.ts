export interface EmagOrderProduct {
  id: number;
  product_id: number;
  part_number?: string;
  ext_part_number?: string;
  created?: string;
  modified?: string;
  currency?: string;
  quantity: number;
  sale_price: number;
  details?: string;
  status: number; // 0=cancelled, 1=active
  product_voucher_split?: EmagVoucherSplit[];
  recycle_warranties?: EmagRecycleWarranty[];
  serial_numbers?: string[];
}

export interface EmagVoucherSplit {
  voucher_id: number;
  value: number;
  vat_value: number;
  vat?: number;
  offered_by?: string;
  voucher_name?: string;
}

export interface EmagRecycleWarranty {
  quantity: number;
  sale_price: number;
  vat_rate: number;
  product_name: string;
  recycle_warranty_voucher_split?: EmagVoucherSplit[];
}

export interface EmagCustomer {
  id?: number;
  name?: string;
  email?: string;
  company?: string;
  gender?: string;
  code?: string;
  registration_number?: string;
  bank?: string;
  iban?: string;
  fax?: string;
  legal_entity?: number;
  is_vat_payer?: number;
  phone_1?: string;
  phone_2?: string;
  phone_3?: string;
  billing_name?: string;
  billing_phone?: string;
  billing_country?: string;
  billing_suburb?: string;
  billing_city?: string;
  billing_locality_id?: string;
  billing_street?: string;
  billing_postal_code?: string;
  shipping_locality_id?: string;
  shipping_contact?: string;
  shipping_phone?: string;
}

export interface EmagVoucher {
  voucher_id: number;
  modified?: string;
  created?: string;
  status?: number;
  sale_price_vat?: string;
  sale_price?: string;
  voucher_name?: string;
  vat?: string;
  issue_date?: string;
}

export interface EmagOrderDetails {
  locker_id?: string;
  locker_name?: string;
  locker_delivery_eligible?: number;
  courier_external_office_id?: string;
}

export interface EmagOrder {
  id: number;
  status: number; // 0=cancelled, 1=new, 2=in progress, 3=prepared, 4=finalized, 5=returned
  is_complete?: number;
  type?: number; // 2=fulfilled by eMAG, 3=fulfilled by seller
  payment_mode_id: number; // 1=COD, 2=bank transfer, 3=online card
  detailed_payment_method?: string;
  delivery_mode?: string; // "courier" or "pickup"
  details?: EmagOrderDetails;
  date?: string;
  modified?: string;
  payment_status?: number;
  cashed_co?: number;
  cashed_cod?: number;
  shipping_tax?: string;
  shipping_tax_voucher_split?: EmagVoucherSplit[];
  customer?: EmagCustomer;
  products?: EmagOrderProduct[];
  attachments?: EmagOrderAttachment[];
  vouchers?: EmagVoucher[];
  is_storno?: boolean;
  reason_cancellation?: number;
  enforced_vendor_courier_accounts?: number[];
}

export interface EmagOrderAttachment {
  order_id?: number;
  order_type?: number;
  order_product_id?: number;
  name?: string;
  url: string;
  type?: number; // 1=invoice, 3=warranty, 4=user manual, 8=user guide, 10=AWB, 11=proforma
  force_download?: number;
}

export interface OrderFilterOptions {
  id?: number;
  currentPage?: number;
  itemsPerPage?: number;
  createdBefore?: string;
  createdAfter?: string;
  modifiedBefore?: string;
  modifiedAfter?: string;
  status?: number | number[];
  payment_mode_id?: number | number[];
  is_complete?: number;
  type?: number;
}

export type OrderStatus = 0 | 1 | 2 | 3 | 4 | 5;
