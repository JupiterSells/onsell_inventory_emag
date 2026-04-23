export interface EmagProductImage {
  url: string;
  display_type: number; // 1=main, 2=secondary, 0=other
}

export interface EmagCharacteristic {
  id: number;
  value: string;
  tag?: string;
}

export interface EmagStock {
  warehouse_id: number;
  value: number;
}

export interface EmagHandlingTime {
  warehouse_id: number;
  value: number;
}

export interface EmagFamily {
  id: number;
  name: string;
  family_type_id?: number;
}

export interface EmagValidationStatus {
  value: number;
  Description: string;
  errors?: any[];
}

export interface EmagManufacturer {
  name: string;
  address: string;
  email: string;
}

export interface EmagProduct {
  id: number;
  part_number_key?: string;
  category_id: number;
  vendor_category_id?: number;
  name: string;
  part_number: string;
  brand: string;
  description?: string;
  url?: string;
  ean?: string[];
  images?: EmagProductImage[];
  characteristics?: EmagCharacteristic[];
  family?: EmagFamily;
  status: number; // 0=inactive, 1=active, 2=end of life
  sale_price: number;
  recommended_price?: number;
  min_sale_price?: number;
  max_sale_price?: number;
  currency_type?: string;
  currency?: string;
  vat_id: number;
  stock?: EmagStock[];
  general_stock?: number;
  estimated_stock?: number;
  handling_time?: EmagHandlingTime[];
  warranty?: number;
  start_date?: string;
  supply_lead_time?: number;
  emag_club?: number;
  number_of_offers?: number;
  buy_button_rank?: number;
  best_offer_sale_price?: number;
  best_offer_recommended_price?: number;
  ownership?: number; // 1=eligible, 2=not eligible
  main_offer_price?: number;
  validation_status?: EmagValidationStatus;
  offer_validation_status?: EmagValidationStatus;
  translation_validation_status?: EmagValidationStatus;
  genius_eligibility?: number;
  genius_eligibility_type?: number;
  genius_computed?: number;
  manufacturer?: EmagManufacturer[] | boolean;
  eu_representative?: EmagManufacturer[] | boolean;
  safety_information?: string;
  green_tax?: number;
  images_overwrite?: number;
  force_images_download?: number;
  source_language?: string;
  attachments?: { id?: number; url: string }[];
}

export interface ProductSaveRequest {
  id: number;
  category_id?: number;
  vendor_category_id?: number;
  part_number_key?: string;
  name?: string;
  part_number?: string;
  brand?: string;
  description?: string;
  images?: EmagProductImage[];
  images_overwrite?: number;
  force_images_download?: number;
  characteristics?: EmagCharacteristic[];
  family?: EmagFamily;
  url?: string;
  warranty?: number;
  ean?: string[];
  status: number;
  sale_price: number;
  recommended_price?: number;
  min_sale_price?: number;
  max_sale_price?: number;
  currency_type?: string;
  vat_id: number;
  stock: EmagStock[];
  handling_time?: EmagHandlingTime[];
  supply_lead_time?: number;
  start_date?: string;
  emag_club?: number;
  safety_information?: string;
  manufacturer?: EmagManufacturer[];
  eu_representative?: EmagManufacturer[];
  green_tax?: number;
  source_language?: string;
  attachments?: { id?: number; url: string }[];
}

export interface OfferSaveRequest {
  id: number;
  sale_price?: number;
  recommended_price?: number;
  min_sale_price?: number;
  max_sale_price?: number;
  currency_type?: string;
  stock?: EmagStock[];
  handling_time?: EmagHandlingTime[];
  vat_id?: number;
  status?: number;
}

export interface ProductFilterOptions {
  id?: number;
  currentPage?: number;
  itemsPerPage?: number;
  status?: number;
  part_number?: string;
  part_number_key?: string;
  general_stock?: number;
  estimated_stock?: number;
  offer_validation_status?: number;
  validation_status?: number;
  translation_validation_status?: number;
}

export interface EanSearchRequest {
  eans: string[];
}

export interface EanSearchResult {
  eans: string;
  part_number_key: string;
  product_name: string;
  brand_name: string;
  category_name: string;
  doc_category_id: number;
  site_url?: string;
  allow_to_add_offer: boolean;
  vendor_has_offer: boolean;
  hotness: string;
  product_image: string;
}

export interface MeasurementsSaveRequest {
  id: number;
  length: number;
  width: number;
  height: number;
  weight: number;
}

export interface CampaignProposalRequest {
  id: number;
  sale_price: number;
  stock: number;
  max_qty_per_order?: number;
  post_campaign_sale_price?: number;
  campaign_id: number;
  not_available_post_campaign?: number;
  voucher_discount?: number;
  date_intervals?: CampaignDateInterval[];
}

export interface CampaignDateInterval {
  start_date: { date: string; timezone_type: number; timezone: string };
  end_date: { date: string; timezone_type: number; timezone: string };
  voucher_discount: number;
  index: number;
}
