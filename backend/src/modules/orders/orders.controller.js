// Контроллер заказов: HTTP-обработчики.
// Все ответы следуют единому формату: { success, data, error }.
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as ordersService from './orders.service.js';
import * as paymentService from './orders.payment.service.js';

export const createOrder = asyncHandler(async (req, res) => {
  const { addressId, customerComment } = req.validated.body;
  const order = await ordersService.createOrder(req.user.sub, {
    addressId,
    customerComment,
  });
  res.status(201).json({
    success: true,
    data: order,
  });
});

export const getOrders = asyncHandler(async (req, res) => {
  const { page, limit, status, q } = req.validated.query;
  const orders = await ordersService.getOrders(req.user.sub, {
    page,
    limit,
    status,
    q,
  });
  res.json({
    success: true,
    data: orders,
  });
});

export const getOrder = asyncHandler(async (req, res) => {
  const order = await ordersService.getOrderById(
    req.params.id,
    req.user.sub,
    req.user.role
  );
  res.json({
    success: true,
    data: order,
  });
});

export const pay = asyncHandler(async (req, res) => {
  const order = await paymentService.payOrder(req.user.sub, req.params.id);
  res.json({
    success: true,
    data: order,
  });
});
