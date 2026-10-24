// Маршруты корзины: получение, добавление, изменение, удаление позиций.
// Подключаются в app.js под префиксом /api/v1/cart.
import { Router } from 'express';
import { getCart, addItemToCart, updateItemInCart, deleteItemFromCart, clearCart } from './cart.controller.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { cartGetSchema, cartItemSchema, cartItemIdSchema, cartItemUpdateSchema } from './cart.schemas.js';

const router = Router();

router.get('/', requireAuth, validate(cartGetSchema), getCart);
router.post('/items', requireAuth, validate(cartItemSchema), addItemToCart);
router.patch('/items/:id', requireAuth, validate(cartItemUpdateSchema), updateItemInCart);
router.delete('/items/:id', requireAuth, validate(cartItemIdSchema), deleteItemFromCart);
router.delete('/', requireAuth, clearCart);

export default router;
