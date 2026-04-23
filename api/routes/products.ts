import { Router, Request, Response } from 'express';
import { asyncHandler, requireEmagClient } from '../middleware';

const router = Router();

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const filters: any = {};
  if (req.query.page) filters.currentPage = parseInt(req.query.page as string, 10);
  if (req.query.limit) filters.itemsPerPage = parseInt(req.query.limit as string, 10);
  if (req.query.status) filters.status = parseInt(req.query.status as string, 10);
  if (req.query.id) filters.id = parseInt(req.query.id as string, 10);
  if (req.query.part_number) filters.part_number = req.query.part_number;
  if (req.query.part_number_key) filters.part_number_key = req.query.part_number_key;
  if (req.query.validation_status) filters.validation_status = parseInt(req.query.validation_status as string, 10);

  const result = await client.getProducts(filters);
  res.json({ success: !result.isError, data: result.results, messages: result.messages, meta: { page: filters.currentPage, limit: filters.itemsPerPage } });
}));

router.get('/count', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const filters: any = {};
  if (req.query.status) filters.status = parseInt(req.query.status as string, 10);
  const result = await client.countProducts(filters);
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.get('/by-id/:id', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const result = await client.getProducts({ id: parseInt(req.params.id, 10) });
  const product = result.results?.[0] || null;
  res.json({ success: !result.isError, data: product, messages: result.messages });
}));

router.get('/by-pnk/:pnk', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const result = await client.getProducts({ part_number_key: req.params.pnk });
  const product = result.results?.[0] || null;
  res.json({ success: !result.isError, data: product, messages: result.messages });
}));

router.post('/save', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const result = await client.saveProductOffer(req.body);
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.post('/offer/save', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const result = await client.saveOffer(req.body);
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.patch('/stock/:productId', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const productId = parseInt(req.params.productId, 10);
  const { stock } = req.body;
  const result = await client.updateStock(productId, stock);
  res.json({ success: true, data: result });
}));

router.post('/measurements', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const result = await client.saveMeasurements(req.body);
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.post('/find-by-eans', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const { eans } = req.body;
  const result = await client.findByEans(eans);
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.post('/campaigns/propose', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const result = await client.saveCampaignProposals(req.body);
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.get('/smart-deals/:productId', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const result = await client.checkSmartDealsPrice(parseInt(req.params.productId, 10));
  res.json({ success: true, data: result });
}));

export default router;
