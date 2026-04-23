export interface AwbSender {
  name: string;
  contact: string;
  phone1: string;
  phone2?: string;
  address_id?: string;
  locality_id: number;
  street: string;
  zipcode?: string;
}

export interface AwbReceiver {
  name: string;
  contact: string;
  phone1: string;
  phone2?: string;
  legal_entity?: number;
  address_id?: string;
  locality_id: number;
  street: string;
  zipcode?: string;
}

export interface AwbPackage {
  weight: number;
  length: number;
  width: number;
  height: number;
}

export interface AwbSaveRequest {
  order_id: number;
  rma_id?: number;
  sender: AwbSender;
  receiver: AwbReceiver;
  locker_id?: string;
  is_oversize: number;
  insured_value?: number;
  weight?: number;
  envelope_number: number;
  parcel_number: number;
  observation?: string;
  cod: number;
  courier_account_id?: number;
  pickup_and_return?: number;
  saturday_delivery?: number;
  sameday_delivery?: number;
  dropoff_locker?: number;
  unboxing?: number;
  date?: string;
  currency?: string;
  packages?: AwbPackage[];
  save_volumetric_awb_data?: number;
}

export interface AwbBarcode {
  emag_id: number;
  awb_number: string;
  awb_barcode: string;
}

export interface AwbStatus {
  code: string;
  name: string;
  description: string;
}

export interface AwbCourier {
  courier_account_id: number;
  courier_name: string;
}

export interface EmagAwb {
  emag_id: number;
  order_id: number;
  rma_id?: number;
  type: number;
  weight: number;
  awb_type?: number; // 1=delivery, 2=pickup
  awb: AwbBarcode[];
  status: AwbStatus;
  courier: AwbCourier;
  currency?: string;
  cash_on_delivery?: string;
}

export interface AwbFilterOptions {
  emag_id?: number;
  reservation_id?: number;
}

export interface AwbPdfOptions {
  emag_id: number;
  awb_format?: 'A4' | 'A5' | 'A6' | 'ZPL';
}

export interface EmagLocality {
  emag_id: number;
  name: string;
  name_latin?: string;
  region1?: string;
  region1_latin?: string;
  region2?: string;
  region2_latin?: string;
  region3?: string;
  region3_latin?: string;
  region4?: string;
  region4_latin?: string;
  geoid?: number;
  modified?: string;
  zipcode?: string;
  country_code?: string;
  iso2?: string;
}

export interface LocalityFilterOptions {
  emag_id?: number;
  name?: string;
  region2?: string;
  country_code?: string;
  modified?: string;
  currentPage?: number;
  itemsPerPage?: number;
}

export interface EmagCourierAccount {
  account_id: number;
  account_display_name: string;
  courier_account_type: number; // 1=RMA, 2=Order, 3=RMA&Order, 4=Non Marketplace
  courier_name: string;
  courier_account_properties: number[];
  created: string;
  status: number;
  pickup_country_code?: string;
}

export interface EmagAddress {
  address_id: string;
  country_id: number;
  country_code: string;
  address_type_id: number; // 1=return, 2=pickup, 3=invoice, 4=delivery estimates
  locality_id: number;
  suburb: string;
  city: string;
  address: string;
  zipcode?: string;
  quarter?: string;
  floor?: string;
  is_default: boolean;
}

export interface AwbPackagePreset {
  label: string;
  length: number;
  width: number;
  height: number;
  weight: number;
  is_default: boolean;
}

export interface EmagVolumetry {
  order_id: number;
  type: number;
  volumetric_data: {
    product_id: number;
    weight: number;
    length: number;
    width: number;
    height: number;
  }[];
}
