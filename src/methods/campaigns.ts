import { ApiClient, EmagApiResponse } from '../utils/apiClient';
import { CampaignProposalRequest } from '../interfaces/IProduct';

export const saveCampaignProposals = async (
  client: ApiClient,
  data: CampaignProposalRequest | CampaignProposalRequest[]
): Promise<EmagApiResponse<any>> => {
  const items = Array.isArray(data) ? data : [data];
  return client.post<any>('/campaign_proposals/save', items);
};

export const checkSmartDealsPrice = async (
  client: ApiClient,
  productId: number
): Promise<any> => {
  return client.get(`/smart-deals-price-check`, { productId });
};
