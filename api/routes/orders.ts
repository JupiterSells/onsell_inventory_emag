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
  if (req.query.createdAfter) filters.createdAfter = req.query.createdAfter;
  if (req.query.createdBefore) filters.createdBefore = req.query.createdBefore;
  if (req.query.modifiedAfter) filters.modifiedAfter = req.query.modifiedAfter;
  if (req.query.modifiedBefore) filters.modifiedBefore = req.query.modifiedBefore;
  if (req.query.type) filters.type = parseInt(req.query.type as string, 10);
  if (req.query.payment_mode_id) filters.payment_mode_id = parseInt(req.query.payment_mode_id as string, 10);
  if (req.query.is_complete) filters.is_complete = parseInt(req.query.is_complete as string, 10);

  const result = await client.getOrders(filters);
  res.json({ success: !result.isError, data: result.results, messages: result.messages, meta: { page: filters.currentPage, limit: filters.itemsPerPage } });
}));

router.get('/count', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const filters: any = {};
  if (req.query.status) filters.status = parseInt(req.query.status as string, 10);
  if (req.query.type) filters.type = parseInt(req.query.type as string, 10);
  const result = await client.countOrders(filters);
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const result = await client.getOrders({ id: parseInt(req.params.id, 10) });
  const order = result.results?.[0] || null;
  res.json({ success: !result.isError, data: order, messages: result.messages });
}));

router.post('/:id/acknowledge', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const result = await client.acknowledgeOrder(parseInt(req.params.id, 10));
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.post('/save', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const result = await client.saveOrder(req.body);
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.get('/:orderId/attachments', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const result = await client.getAttachments(parseInt(req.params.orderId, 10));
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.post('/attachments/save', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const result = await client.saveAttachment(req.body);
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.get('/:orderId/volumetry', asyncHandler(async (req: Request, res: Response) => {
  const client = requireEmagClient();
  const type = req.query.type ? parseInt(req.query.type as string, 10) : undefined;
  const productId = req.query.product_id ? parseInt(req.query.product_id as string, 10) : undefined;
  const result = await client.getVolumetry(parseInt(req.params.orderId, 10), type, productId);
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

export default router;
