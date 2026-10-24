// Контроллер менеджера: очередь, смена статуса, отгрузка и комментарий.
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as managerService from './manager.service.js';
import * as detailsService from './manager.details.service.js';

export const listOrders = asyncHandler(async (req, res) => {
  const data = await managerService.listOrders(req.validated.query);
  res.json({ success: true, data });
});

export const changeStatus = asyncHandler(async (req, res) => {
  const data = await managerService.changeOrderStatus(
    req.user.sub,
    req.user.role,
    req.validated.params.id,
    req.validated.body
  );
  res.json({ success: true, data });
});

export const updateShipment = asyncHandler(async (req, res) => {
  const data = await detailsService.upsertShipment(
    req.user.sub,
    req.user.role,
    req.validated.params.id,
    req.validated.body
  );
  res.json({ success: true, data });
});

export const updateComment = asyncHandler(async (req, res) => {
  const data = await detailsService.setManagerComment(
    req.user.sub,
    req.user.role,
    req.validated.params.id,
    req.validated.body.comment
  );
  res.json({ success: true, data });
});