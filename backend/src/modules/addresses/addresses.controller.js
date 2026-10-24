// Контроллер адресов клиента.
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as addressesService from './addresses.service.js';

export const listAddresses = asyncHandler(async (req, res) => {
  const data = await addressesService.listAddresses(req.user.sub);
  res.json({ success: true, data });
});

export const createAddress = asyncHandler(async (req, res) => {
  const data = await addressesService.createAddress(req.user.sub, req.validated.body);
  res.status(201).json({ success: true, data });
});

export const setDefault = asyncHandler(async (req, res) => {
  const data = await addressesService.setDefaultAddress(req.user.sub, req.validated.params.id);
  res.json({ success: true, data });
});

export const removeAddress = asyncHandler(async (req, res) => {
  const data = await addressesService.deleteAddress(req.user.sub, req.validated.params.id);
  res.json({ success: true, data });
});