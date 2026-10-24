// Контроллер корзины: HTTP-обработчики.
// Все ответы следуют единому формату: { success, data, error }.
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as cartService from './cart.service.js';

export const getCart = asyncHandler(async (req, res) => {
  const cart = await cartService.getCart(req.user.sub);
  res.json({
    success: true,
    data: cart,
  });
});

export const addItemToCart = asyncHandler(async (req, res) => {
  const { productId, quantity, selectedAttributes } = req.validated.body;
  const cart = await cartService.addItemToCart(req.user.sub, {
    productId,
    quantity,
    selectedAttributes,
  });
  res.status(201).json({
    success: true,
    data: cart,
  });
});

export const updateItemInCart = asyncHandler(async (req, res) => {
  const { quantity } = req.validated.body;
  const cart = await cartService.updateItemInCart(req.user.sub, req.params.id, quantity);
  res.json({
    success: true,
    data: cart,
  });
});

export const deleteItemFromCart = asyncHandler(async (req, res) => {
  const cart = await cartService.deleteItemFromCart(req.user.sub, req.params.id);
  res.json({
    success: true,
    data: cart,
  });
});

export const clearCart = asyncHandler(async (req, res) => {
  const cart = await cartService.clearCart(req.user.sub);
  res.json({
    success: true,
    data: cart,
  });
});
