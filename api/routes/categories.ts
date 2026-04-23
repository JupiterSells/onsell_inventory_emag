import { Router, Request, Response } from 'express';
import { asyncHandler, requireEmagClient } from '../middleware';

const router = Router();

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const filters: any = {};
  if (req.query.page) filters.currentPage = parseInt(req.query.page as string, 10);
  if (req.query.limit) filters.itemsPerPage = parseInt(req.query.limit as string, 10);
  if (req.query.id) filters.id = parseInt(req.query.id as string, 10);
  if (req.query.name) filters.name = req.query.name;
  if (req.query.is_allowed) filters.is_allowed = parseInt(req.query.is_allowed as string, 10);
  if (req.query.language) filters.language = req.query.language;
  const result = await client.getCategories(filters);
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.get('/count', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const result = await client.countCategories();
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.get('/vat', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const result = await client.getVatRates();
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.get('/handling-time', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const result = await client.getHandlingTimeValues();
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

export default router;
