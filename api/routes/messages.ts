import { Router, Request, Response } from 'express';
import { asyncHandler, getClientForRequest } from '../middleware';

const router = Router();

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const client = getClientForRequest(req);
  const filters: any = {};
  if (req.query.page) filters.currentPage = parseInt(req.query.page as string, 10);
  if (req.query.limit) filters.itemsPerPage = parseInt(req.query.limit as string, 10);
  if (req.query.order_id) filters.order_id = parseInt(req.query.order_id as string, 10);
  if (req.query.status) filters.status = parseInt(req.query.status as string, 10);
  if (req.query.id) filters.id = parseInt(req.query.id as string, 10);

  const result = await client.getMessages(filters);
  res.json({ success: !result.isError, data: result.results, messages: result.messages, meta: { page: filters.currentPage, limit: filters.itemsPerPage } });
}));

router.get('/count', asyncHandler(async (req: Request, res: Response) => {
  const client = getClientForRequest(req);
  const filters: any = {};
  if (req.query.order_id) filters.order_id = parseInt(req.query.order_id as string, 10);
  if (req.query.status) filters.status = parseInt(req.query.status as string, 10);

  const result = await client.countMessages(filters);
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.post('/save', asyncHandler(async (req: Request, res: Response) => {
  const client = getClientForRequest(req);
  const result = await client.saveMessage(req.body);
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

export default router;
