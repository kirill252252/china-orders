// Маршруты адресов клиента. Подключаются в app.js под /api/v1/addresses.
import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { createAddressSchema, addressIdSchema } from './addresses.schemas.js';
import { listAddresses, createAddress, setDefault, removeAddress } from './addresses.controller.js';

const router = Router();
const customer = [requireAuth, requireRole('customer')];

router.get('/', ...customer, listAddresses);
router.post('/', ...customer, validate(createAddressSchema), createAddress);
router.post('/:id/default', ...customer, validate(addressIdSchema), setDefault);
router.delete('/:id', ...customer, validate(addressIdSchema), removeAddress);

export default router;