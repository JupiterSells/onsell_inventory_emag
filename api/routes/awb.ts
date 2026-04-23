import { Router, Request, Response } from 'express';
import { asyncHandler, requireEmagClient } from '../middleware';

const router = Router();

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const filters: any = {};
  if (req.query.emag_id) filters.emag_id = parseInt(req.query.emag_id as string, 10);
  if (req.query.reservation_id) filters.reservation_id = parseInt(req.query.reservation_id as string, 10);
  const result = await client.getAwb(filters);
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.post('/save', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const result = await client.saveAwb(req.body);
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.get('/pdf/:emagId', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const format = (req.query.format as string) || 'A4';
  const result = await client.getAwbPdf(parseInt(req.params.emagId, 10), format);
  res.json({ success: true, data: result });
}));

router.get('/zpl/:emagId', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const result = await client.getAwbZpl(parseInt(req.params.emagId, 10));
  res.json({ success: true, data: result });
}));

router.get('/localities', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const filters: any = {};
  if (req.query.name) filters.name = req.query.name;
  if (req.query.region2) filters.region2 = req.query.region2;
  if (req.query.page) filters.currentPage = parseInt(req.query.page as string, 10);
  if (req.query.limit) filters.itemsPerPage = parseInt(req.query.limit as string, 10);
  const result = await client.getLocalities(filters);
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.get('/localities/count', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const result = await client.countLocalities();
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.get('/courier-accounts', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const result = await client.getCourierAccounts();
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.get('/addresses', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const result = await client.getAddresses();
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.get('/packages', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const result = await client.getPackages();
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.post('/packages/save', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const result = await client.savePackages(req.body);
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

export default router;
