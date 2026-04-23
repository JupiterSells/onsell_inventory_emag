export interface EmagCharacteristicValue {
  id: number;
  value: string;
}

export interface EmagCategoryCharacteristic {
  id: number;
  name: string;
  type_id: number;
  display_order: number;
  is_mandatory: number;
  is_filter: number;
  allow_new_value: number;
  values?: string[];
  tags?: string[];
}

export interface EmagFamilyTypeCharacteristic {
  characteristic_id: number;
  characteristic_family_type_id: number;
  is_foldable: number;
  display_order: number;
}

export interface EmagFamilyType {
  id: number;
  name: string;
  characteristics: EmagFamilyTypeCharacteristic[];
}

export interface EmagCategory {
  id: number;
  name: string;
  is_allowed: number;
  parent_id?: number;
  is_ean_mandatory?: number;
  is_warranty_mandatory?: number;
  characteristics?: EmagCategoryCharacteristic[];
  family_types?: EmagFamilyType[];
}

export interface CategoryFilterOptions {
  id?: number;
  name?: string;
  is_allowed?: number;
  language?: string;
  currentPage?: number;
  itemsPerPage?: number;
  valuesCurrentPage?: number;
  valuesPerPage?: number;
}

export interface EmagVat {
  vat_id: number;
  vat_rate: number;
}

export interface EmagHandlingTimeValue {
  value: number;
  description: string;
}
