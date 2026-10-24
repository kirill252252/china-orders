// Контроллер каталога товаров: HTTP-обработчики для списка и одного товара.
// Все ответы следуют единому формату: { success, data, error }.
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  listProducts as listProductsService,
  getProductById,
  importProduct as importProductService,
  createProductManual as createManualProductService,
} from './products.service.js';
import { cachedList, bumpProductsVersion } from './products.cache.js';
import { addToMine, listMine as listMineService, removeFromMine } from './products.mine.service.js';

export const listProducts = asyncHandler(async (req, res) => {
  const params = req.validated.query;
  const { result, hit } = await cachedList(params, () => listProductsService(params));
  res.set('X-Cache', hit ? 'HIT' : 'MISS');
  res.json({
    success: true,
    data: result,
  });
});

export const getProduct = asyncHandler(async (req, res) => {
  const product = await getProductById(req.params.id);
  res.json({
    success: true,
    data: product,
  });
});

export const importProduct = asyncHandler(async (req, res) => {
  const { url } = req.validated.body;
  const product = await importProductService(url, req.user.sub);
  await addToMine(req.user.sub, product.id);
  if (product.created) {
    await bumpProductsVersion();
  }
  res.status(product.created ? 201 : 200).json({
    success: true,
    data: product,
  });
});

export const createProductManual = asyncHandler(async (req, res) => {
  const product = await createManualProductService(req.validated.body, req.user.sub);
  await addToMine(req.user.sub, product.id);
  await bumpProductsVersion();
  res.status(201).json({
    success: true,
    data: product,
  });
});

export const listMine = asyncHandler(async (req, res) => {
  const data = await listMineService(req.user.sub, req.validated.query);
  res.json({ success: true, data });
});

export const removeMine = asyncHandler(async (req, res) => {
  const data = await removeFromMine(req.user.sub, req.validated.params.id);
  res.json({ success: true, data });
});