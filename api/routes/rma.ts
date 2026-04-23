import { Router, Request, Response } from 'express';
import { asyncHandler, requireEmagClient } from '../middleware';

const router = Router();

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const filters: any = {};
  if (req.query.page) filters.currentPage = parseInt(req.query.page as string, 10);
  if (req.query.limit) filters.itemsPerPage = parseInt(req.query.limit as string, 10);
  if (req.query.request_status) filters.request_status = parseInt(req.query.request_status as string, 10);
  if (req.query.order_id) filters.order_id = parseInt(req.query.order_id as string, 10);
  if (req.query.emag_id) filters.emag_id = parseInt(req.query.emag_id as string, 10);
  if (req.query.date_start) filters.date_start = req.query.date_start;
  if (req.query.date_end) filters.date_end = req.query.date_end;
  if (req.query.type) filters.type = parseInt(req.query.type as string, 10);

  const result = await client.getRma(filters);
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.get('/count', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const filters: any = {};
  if (req.query.request_status) filters.request_status = parseInt(req.query.request_status as string, 10);
  const result = await client.countRma(filters);
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.post('/save', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const result = await client.saveRma(req.body);
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

export default router;
