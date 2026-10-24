// Контроллер калькулятора стоимости.
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as calcService from './calc.service.js';

export const calculate = asyncHandler(async (req, res) => {
  const data = await calcService.calculate(req.validated.query);
  res.json({ success: true, data });
});