import { validationResult, param, body } from 'express-validator';
import { HTTP } from '../config/constants.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error('[Validation Error]', JSON.stringify(errors.array(), null, 2));
    console.error('[Request Body]', JSON.stringify(req.body, null, 2));
    return res.status(HTTP.BAD_REQUEST).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

/**
 * idParam(name?)
 * Validates a route param is a non-empty string that looks like a UUID
 * (standard OR seed-data repeated-char format like dddddddd-dddd-dddd-dddd-dddddddddddd).
 *
 * Uses a regex instead of isUUID() so seed/test IDs are accepted.
 */
export const idParam = (name = 'id') =>
  param(name)
    .trim()
    .matches(UUID_REGEX)
    .withMessage(`${name} must be a valid UUID`);

/**
 * uuidBody(name)
 * Validates a request body field is a UUID-shaped string
 * (standard OR seed-data repeated-char format like dddddddd-dddd-dddd-dddd-dddddddddddd).
 */
export const uuidBody = (name) =>
  body(name)
    .optional({ values: 'falsy' })
    .trim()
    .matches(UUID_REGEX)
    .withMessage(`${name} must be a valid UUID`);
