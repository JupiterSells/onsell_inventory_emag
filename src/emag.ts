import { Platform, getApiBaseUrl, getEnvCredentials, getDefaultPlatform } from './config';
import { ApiClient } from './utils/apiClient';
import { EmagApiResponse } from './interfaces/ICommon';
import { EmagProduct, ProductFilterOptions, ProductSaveRequest, OfferSaveRequest, MeasurementsSaveRequest, CampaignProposalRequest } from './interfaces/IProduct';
import { EmagOrder, OrderFilterOptions, EmagOrderAttachment } from './interfaces/IOrder';
import { EmagRma, RmaFilterOptions } from './interfaces/IRma';
import { AwbSaveRequest, EmagAwb, AwbFilterOptions, AwbPackagePreset, EmagLocality, LocalityFilterOptions, EmagCourierAccount, EmagAddress, EmagVolumetry } from './interfaces/IAwb';
import { EmagCategory, CategoryFilterOptions, EmagVat, EmagHandlingTimeValue } from './interfaces/ICategory';
import { EmagInvoiceCategory, InvoiceFilterOptions, InvoiceReadResponse, CustomerInvoiceFilterOptions, CustomerInvoiceReadResponse } from './interfaces/IInvoice';

import * as productMethods from './methods/products';
import * as orderMethods from './methods/orders';
import * as attachmentMethods from './methods/attachments';
import * as rmaMethods from './methods/rma';
import * as awbMethods from './methods/awb';
import * as categoryMethods from './methods/categories';
import * as localityMethods from './methods/localities';
import * as invoiceMethods from './methods/invoices';
import * as campaignMethods from './methods/campaigns';

export class Emag {
  public platform: Platform;
  private client: ApiClient;

  constructor(username: string, password: string, platform: Platform = 'ro') {
    this.platform = platform;
    this.client = new ApiClient({
      username,
      password,
      baseUrl: getApiBaseUrl(platform),
    });
  }

  getClient(): ApiClient {
    return this.client;
  }

  getUsername(): string {
    return this.client.getUsername();
  }

  // ============ PRODUCTS ============

  async getProducts(filters?: ProductFilterOptions): Promise<EmagApiResponse<EmagProduct[]>> {
    return productMethods.readProducts(this.client, filters);
  }

  async countProducts(filters?: ProductFilterOptions): Promise<EmagApiResponse<number>> {
    return productMethods.countProducts(this.client, filters);
  }

  async saveProductOffer(data: ProductSaveRequest | ProductSaveRequest[]): Promise<EmagApiResponse<any>> {
    return productMethods.saveProductOffer(this.client, data);
  }

  async saveOffer(data: OfferSaveRequest | OfferSaveRequest[]): Promise<EmagApiResponse<any>> {
    return productMethods.saveOffer(this.client, data);
  }

  async updateStock(productId: number, stock: { warehouse_id: number; value: number }[]): Promise<any> {
    return productMethods.updateStock(this.client, productId, stock);
  }

  async saveMeasurements(data: MeasurementsSaveRequest | MeasurementsSaveRequest[]): Promise<EmagApiResponse<any>> {
    return productMethods.saveMeasurements(this.client, data);
  }

  async findByEans(eans: string[]): Promise<EmagApiResponse<any>> {
    return productMethods.findByEans(this.client, eans);
  }

  // ============ ORDERS ============

  async getOrders(filters?: OrderFilterOptions): Promise<EmagApiResponse<EmagOrder[]>> {
    return orderMethods.readOrders(this.client, filters);
  }

  async countOrders(filters?: OrderFilterOptions): Promise<EmagApiResponse<number>> {
    return orderMethods.countOrders(this.client, filters);
  }

  async saveOrder(data: Partial<EmagOrder>): Promise<EmagApiResponse<any>> {
    return orderMethods.saveOrder(this.client, data);
  }

  async acknowledgeOrder(orderId: number): Promise<EmagApiResponse<any>> {
    return orderMethods.acknowledgeOrder(this.client, orderId);
  }

  // ============ ATTACHMENTS ============

  async getAttachments(orderId: number): Promise<EmagApiResponse<EmagOrderAttachment[]>> {
    return attachmentMethods.readAttachments(this.client, orderId);
  }

  async saveAttachment(data: EmagOrderAttachment | EmagOrderAttachment[]): Promise<EmagApiResponse<any>> {
    return attachmentMethods.saveAttachment(this.client, data);
  }

  // ============ RMA (RETURNS) ============

  async getRma(filters?: RmaFilterOptions): Promise<EmagApiResponse<EmagRma[]>> {
    return rmaMethods.readRma(this.client, filters);
  }

  async countRma(filters?: RmaFilterOptions): Promise<EmagApiResponse<number>> {
    return rmaMethods.countRma(this.client, filters);
  }

  async saveRma(data: Partial<EmagRma>): Promise<EmagApiResponse<any>> {
    return rmaMethods.saveRma(this.client, data);
  }

  // ============ AWB ============

  async getAwb(filters: AwbFilterOptions): Promise<EmagApiResponse<EmagAwb[]>> {
    return awbMethods.readAwb(this.client, filters);
  }

  async saveAwb(data: AwbSaveRequest): Promise<EmagApiResponse<any>> {
    return awbMethods.saveAwb(this.client, data);
  }

  async getAwbPdf(emagId: number, format: string = 'A4'): Promise<any> {
    return awbMethods.readAwbPdf(this.client, emagId, format);
  }

  async getAwbZpl(emagId: number): Promise<any> {
    return awbMethods.readAwbZpl(this.client, emagId);
  }

  async getPackages(): Promise<EmagApiResponse<AwbPackagePreset[]>> {
    return awbMethods.readPackages(this.client);
  }

  async savePackages(data: AwbPackagePreset[]): Promise<EmagApiResponse<any>> {
    return awbMethods.savePackages(this.client, data);
  }

  async getVolumetry(orderId: number, type?: number, productId?: number): Promise<EmagApiResponse<EmagVolumetry[]>> {
    return awbMethods.readVolumetry(this.client, orderId, type, productId);
  }

  // ============ CATEGORIES ============

  async getCategories(filters?: CategoryFilterOptions): Promise<EmagApiResponse<EmagCategory[]>> {
    return categoryMethods.readCategories(this.client, filters);
  }

  async countCategories(filters?: CategoryFilterOptions): Promise<EmagApiResponse<number>> {
    return categoryMethods.countCategories(this.client, filters);
  }

  async getVatRates(): Promise<EmagApiResponse<EmagVat[]>> {
    return categoryMethods.readVat(this.client);
  }

  async getHandlingTimeValues(): Promise<EmagApiResponse<EmagHandlingTimeValue[]>> {
    return categoryMethods.readHandlingTime(this.client);
  }

  // ============ LOCALITIES ============

  async getLocalities(filters?: LocalityFilterOptions): Promise<EmagApiResponse<EmagLocality[]>> {
    return localityMethods.readLocalities(this.client, filters);
  }

  async countLocalities(filters?: LocalityFilterOptions): Promise<EmagApiResponse<number>> {
    return localityMethods.countLocalities(this.client, filters);
  }

  async getCourierAccounts(): Promise<EmagApiResponse<EmagCourierAccount[]>> {
    return localityMethods.readCourierAccounts(this.client);
  }

  async getAddresses(): Promise<EmagApiResponse<EmagAddress[]>> {
    return localityMethods.readAddresses(this.client);
  }

  // ============ INVOICES ============

  async getInvoiceCategories(): Promise<EmagApiResponse<EmagInvoiceCategory[]>> {
    return invoiceMethods.readInvoiceCategories(this.client);
  }

  async getInvoices(filters?: InvoiceFilterOptions): Promise<EmagApiResponse<InvoiceReadResponse>> {
    return invoiceMethods.readInvoices(this.client, filters);
  }

  async getCustomerInvoices(filters?: CustomerInvoiceFilterOptions): Promise<EmagApiResponse<CustomerInvoiceReadResponse>> {
    return invoiceMethods.readCustomerInvoices(this.client, filters);
  }

  // ============ CAMPAIGNS ============

  async saveCampaignProposals(data: CampaignProposalRequest | CampaignProposalRequest[]): Promise<EmagApiResponse<any>> {
    return campaignMethods.saveCampaignProposals(this.client, data);
  }

  async checkSmartDealsPrice(productId: number): Promise<any> {
    return campaignMethods.checkSmartDealsPrice(this.client, productId);
  }
}

export const createEmagClient = (platform?: Platform): Emag => {
  const p = platform || getDefaultPlatform();
  const config = getEnvCredentials(p);
  
  if (!config.username || !config.password) {
    throw new Error('eMAG credentials not configured. Set EMAG_USERNAME and EMAG_PASSWORD environment variables.');
  }

  return new Emag(config.username, config.password, p);
};

export const createDefaultClient = (): Emag => {
  return createEmagClient();
};
