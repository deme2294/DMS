import * as authService from '../services/authService.js';
import * as userService from '../services/userService.js';
import { HTTP } from '../config/constants.js';
import { sanitizeUser } from '../models/User.js';

export const login = async (req, res, next) => {
  try {
    const rawIdentifier = req.body.identifier ?? req.body.username ?? req.body.email ?? '';
    const identifier = typeof rawIdentifier === 'string' ? rawIdentifier.trim() : '';
    const { password, rememberMe } = req.body;
    const result = await authService.login({
      identifier,
      password,
      rememberMe,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : undefined,
    });

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000,
    });

    res.status(HTTP.OK).json({
      success: true,
      message: 'Login successful',
      token: result.accessToken,
      data: { user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken },
    });
  } catch (err) {
    next(err);
  }
};

export const refreshToken = async (req, res, next) => {
  try {
    const token = req.body.refreshToken || req.cookies.refreshToken;
    const tokens = await authService.refresh(token);

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(HTTP.OK).json({ success: true, data: tokens });
  } catch (err) {
    next(err);
  }
};

export const logout = async (req, res, next) => {
  try {
    const token = req.body.refreshToken || req.cookies.refreshToken;
    await authService.logout(token, req.user?.id, req.ip);
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.status(HTTP.OK).json({ success: true, message: 'Logged out' });
  } catch (err) {
    next(err);
  }
};

export const me = async (req, res, next) => {
  try {
    res.status(HTTP.OK).json({ success: true, data: sanitizeUser(req.user) });
  } catch (err) {
    next(err);
  }
};

export const updateMyProfile = async (req, res, next) => {
  try {
    const profileImage = req.file ? `/uploads/users/${req.file.filename}` : undefined;
    const { username, email, firstName, lastName, phone, themePreference, currentPassword, newPassword, confirmPassword } = req.body;

    if (newPassword && !currentPassword) {
      return res.status(HTTP.BAD_REQUEST).json({ success: false, message: 'Current password is required to change password' });
    }

    if (newPassword && newPassword !== confirmPassword) {
      return res.status(HTTP.BAD_REQUEST).json({ success: false, message: 'New password and confirm password do not match' });
    }

    const payload = {};
    if (username !== undefined) payload.username = username;
    if (email !== undefined) payload.email = email;
    if (firstName !== undefined) payload.firstName = firstName;
    if (lastName !== undefined) payload.lastName = lastName;
    if (phone !== undefined) payload.phone = phone;
    if (themePreference !== undefined) payload.themePreference = themePreference;
    if (profileImage !== undefined) payload.profileImage = profileImage;
    if (newPassword) payload.newPassword = newPassword;
    if (currentPassword) payload.currentPassword = currentPassword;

    const user = await userService.updateMyProfile(req.user.id, payload);
    res.status(HTTP.OK).json({ success: true, message: 'Profile updated successfully', data: user });
  } catch (err) {
    next(err);
  }
};

export const updateMyTheme = async (req, res, next) => {
  try {
    const { themePreference } = req.body;
    const updatedUser = await userService.updateMyTheme(req.user.id, themePreference);
    res.status(HTTP.OK).json({
      success: true,
      message: 'Theme preference updated successfully',
      data: updatedUser,
    });
  } catch (err) {
    next(err);
  }
};