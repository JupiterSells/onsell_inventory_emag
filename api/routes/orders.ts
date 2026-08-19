import { Router, Request, Response } from 'express';
import { asyncHandler, getClientForRequest } from '../middleware';

const router = Router();

// Parse a query value that may be a single number or a comma-separated list
// into either a number or a number[] (eMAG accepts both for status/payment_mode_id).
const parseNumberOrList = (value: unknown): number | number[] | undefined => {
  if (value == null) return undefined;
  const raw = String(value);
  if (raw.includes(',')) {
    const list = raw.split(',').map((v) => parseInt(v.trim(), 10)).filter((n) => !Number.isNaN(n));
    return list.length ? list : undefined;
  }
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? undefined : n;
};

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const client = getClientForRequest(req);
  const filters: any = {};
  if (req.query.page) filters.currentPage = parseInt(req.query.page as string, 10);
  if (req.query.limit) filters.itemsPerPage = parseInt(req.query.limit as string, 10);
  if (req.query.status !== undefined) filters.status = parseNumberOrList(req.query.status);
  if (req.query.id) filters.id = parseInt(req.query.id as string, 10);
  if (req.query.createdAfter) filters.createdAfter = req.query.createdAfter;
  if (req.query.createdBefore) filters.createdBefore = req.query.createdBefore;
  if (req.query.modifiedAfter) filters.modifiedAfter = req.query.modifiedAfter;
  if (req.query.modifiedBefore) filters.modifiedBefore = req.query.modifiedBefore;
  if (req.query.type) filters.type = parseInt(req.query.type as string, 10);
  if (req.query.payment_mode_id !== undefined) filters.payment_mode_id = parseNumberOrList(req.query.payment_mode_id);
  if (req.query.is_complete) filters.is_complete = parseInt(req.query.is_complete as string, 10);

  const result = await client.getOrders(filters);
  res.json({ success: !result.isError, data: result.results, messages: result.messages, meta: { page: filters.currentPage, limit: filters.itemsPerPage } });
}));

router.get('/count', asyncHandler(async (req: Request, res: Response) => {
  const client = getClientForRequest(req);
  const filters: any = {};
  if (req.query.status) filters.status = parseInt(req.query.status as string, 10);
  if (req.query.type) filters.type = parseInt(req.query.type as string, 10);
  const result = await client.countOrders(filters);
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const client = getClientForRequest(req);
  const result = await client.getOrders({ id: parseInt(req.params.id, 10) });
  const order = result.results?.[0] || null;
  res.json({ success: !result.isError, data: order, messages: result.messages });
}));

router.post('/:id/acknowledge', asyncHandler(async (req: Request, res: Response) => {
  const client = getClientForRequest(req);
  const result = await client.acknowledgeOrder(parseInt(req.params.id, 10));
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.post('/:orderId/unlock-courier', asyncHandler(async (req: Request, res: Response) => {
  const client = getClientForRequest(req);
  const result = await client.unlockCourier(parseInt(req.params.orderId, 10));
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.post('/save', asyncHandler(async (req: Request, res: Response) => {
  const client = getClientForRequest(req);
  const result = await client.saveOrder(req.body);
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.get('/:orderId/attachments', asyncHandler(async (req: Request, res: Response) => {
  const client = getClientForRequest(req);
  const orderType = req.query.order_type ? parseInt(req.query.order_type as string, 10) : undefined;
  const result = await client.getAttachments(parseInt(req.params.orderId, 10), orderType);
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.get('/:orderId/invoice-pdf', asyncHandler(async (req: Request, res: Response) => {
  const client = getClientForRequest(req);
  const orderId = parseInt(req.params.orderId, 10);
  const preferredUrl = typeof req.query.url === 'string' ? req.query.url : undefined;
  const file = await client.downloadOrderInvoicePdf(orderId, preferredUrl);
  if (!file) {
    res.status(404).json({
      success: false,
      error: 'Factura nu a putut fi descărcată din eMAG.',
    });
    return;
  }
  const filename = file.filename.replace(/"/g, '').replace(/[^\w.\-ăâîșțĂÂÎȘȚ ]+/g, '_') || 'factura.pdf';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.send(file.buffer);
}));

router.post('/attachments/save', asyncHandler(async (req: Request, res: Response) => {
  const client = getClientForRequest(req);
  const result = await client.saveAttachment(req.body);
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.get('/:orderId/volumetry', asyncHandler(async (req: Request, res: Response) => {
  const client = getClientForRequest(req);
  const type = req.query.type ? parseInt(req.query.type as string, 10) : undefined;
  const productId = req.query.product_id ? parseInt(req.query.product_id as string, 10) : undefined;
  const result = await client.getVolumetry(parseInt(req.params.orderId, 10), type, productId);
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

export default router;
