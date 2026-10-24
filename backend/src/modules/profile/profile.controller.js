// Контроллер профиля.
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as profileService from './profile.service.js';

export const updateProfile = asyncHandler(async (req, res) => {
  const data = await profileService.updateProfile(req.user.sub, req.validated.body);
  res.json({ success: true, data });
});

export const changePassword = asyncHandler(async (req, res) => {
  const data = await profileService.changePassword(req.user.sub, req.validated.body);
  res.json({ success: true, data });
});