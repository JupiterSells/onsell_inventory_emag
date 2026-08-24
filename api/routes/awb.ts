import { Router, Request, Response } from 'express';
import { asyncHandler, getClientForRequest } from '../middleware';

const router = Router();

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const client = getClientForRequest(req);
  const filters: any = {};
  if (req.query.emag_id) filters.emag_id = parseInt(req.query.emag_id as string, 10);
  if (req.query.reservation_id) filters.reservation_id = parseInt(req.query.reservation_id as string, 10);
  const result = await client.getAwb(filters);
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.post('/save', asyncHandler(async (req: Request, res: Response) => {
  const client = getClientForRequest(req);
  const result = await client.saveAwb(req.body);
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

// eMAG returns the label file itself, so both routes stream bytes rather than
// wrapping them in the usual JSON envelope.
router.get('/pdf/:emagId', asyncHandler(async (req: Request, res: Response) => {
  const client = getClientForRequest(req);
  const emagId = parseInt(req.params.emagId, 10);
  const format = (req.query.format as string) || 'A4';
  const label = await client.getAwbPdf(emagId, format);
  res.setHeader('Content-Type', label.contentType || 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="awb-${emagId}-${format}.pdf"`);
  res.send(label.buffer);
}));

router.get('/zpl/:emagId', asyncHandler(async (req: Request, res: Response) => {
  const client = getClientForRequest(req);
  const emagId = parseInt(req.params.emagId, 10);
  const label = await client.getAwbZpl(emagId);
  res.setHeader('Content-Type', label.contentType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="awb-${emagId}.zpl"`);
  res.send(label.buffer);
}));

router.get('/localities', asyncHandler(async (req: Request, res: Response) => {
  const client = getClientForRequest(req);
  const filters: any = {};
  if (req.query.name) filters.name = req.query.name;
  if (req.query.region2) filters.region2 = req.query.region2;
  if (req.query.country_code) filters.country_code = req.query.country_code;
  if (req.query.modified) filters.modified = req.query.modified;
  if (req.query.emag_id) filters.emag_id = parseInt(req.query.emag_id as string, 10);
  if (req.query.page) filters.currentPage = parseInt(req.query.page as string, 10);
  if (req.query.limit) filters.itemsPerPage = parseInt(req.query.limit as string, 10);
  const result = await client.getLocalities(filters);
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.get('/localities/count', asyncHandler(async (req: Request, res: Response) => {
  const client = getClientForRequest(req);
  const result = await client.countLocalities();
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.get('/courier-accounts', asyncHandler(async (req: Request, res: Response) => {
  const client = getClientForRequest(req);
  const result = await client.getCourierAccounts();
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.get('/addresses', asyncHandler(async (req: Request, res: Response) => {
  const client = getClientForRequest(req);
  const result = await client.getAddresses();
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.get('/packages', asyncHandler(async (req: Request, res: Response) => {
  const client = getClientForRequest(req);
  const result = await client.getPackages();
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

router.post('/packages/save', asyncHandler(async (req: Request, res: Response) => {
  const client = getClientForRequest(req);
  const result = await client.savePackages(req.body);
  res.json({ success: !result.isError, data: result.results, messages: result.messages });
}));

export default router;
