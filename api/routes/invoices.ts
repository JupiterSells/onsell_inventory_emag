import { Router, Request, Response } from 'express';
import { asyncHandler, requireEmagClient } from '../middleware';

const router = Router();

router.get('/categories', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const result = await client.getInvoiceCategories();
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const filters: any = {};
  if (req.query.category) filters.category = req.query.category;
  if (req.query.number) filters.number = req.query.number;
  if (req.query.date_start) filters.date_start = req.query.date_start;
  if (req.query.date_end) filters.date_end = req.query.date_end;
  if (req.query.page) filters.currentPage = parseInt(req.query.page as string, 10);
  if (req.query.limit) filters.itemsPerPage = parseInt(req.query.limit as string, 10);
  const result = await client.getInvoices(filters);
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.get('/customer', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const filters: any = {};
  if (req.query.category) filters.category = req.query.category;
  if (req.query.order_id) filters.order_id = req.query.order_id;
  if (req.query.number) filters.number = req.query.number;
  if (req.query.date_start) filters.date_start = req.query.date_start;
  if (req.query.date_end) filters.date_end = req.query.date_end;
  if (req.query.page) filters.currentPage = parseInt(req.query.page as string, 10);
  if (req.query.limit) filters.itemsPerPage = parseInt(req.query.limit as string, 10);
  const result = await client.getCustomerInvoices(filters);
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

export default router;
