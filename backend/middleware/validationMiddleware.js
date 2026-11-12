import { validationResult, param, body } from 'express-validator';
import { HTTP } from '../config/constants.js';

const UUID_REGEX = /^[0-9a-z]{8}-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{12}$/i;
const ID_PARAM_REGEX = /^[0-9a-zA-Z_-]{1,36}$/;
const UUID_OR_SHORT_REGEX = /^([0-9a-z]{8}-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{12}|[0-9a-zA-Z_-]{1,36})$/i;

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
 * Validates a route param is a valid ID (numeric, short ID, or UUID).
 */
export const idParam = (name = 'id') =>
  param(name)
    .trim()
    .matches(ID_PARAM_REGEX)
    .withMessage(`${name} must be a valid identifier`);

/**
 * uuidBody(name)
 * Validates a request body field is a UUID-shaped string or concise short ID
 * (standard, reduced short ID, or seed-data format).
 */
export const uuidBody = (name) =>
  body(name)
    .optional({ values: 'falsy' })
    .trim()
    .matches(UUID_OR_SHORT_REGEX)
    .withMessage(`${name} must be a valid identifier`);

export const DEPT_ID_REGEX = /^[0-9a-zA-Z_-]{2,36}$/i;

export const departmentIdParam = (name = 'departmentId') =>
  param(name)
    .trim()
    .matches(DEPT_ID_REGEX)
    .withMessage(`${name} must be a valid department identifier`);

export const departmentIdBody = (name = 'departmentId') =>
  body(name)
    .optional({ values: 'falsy' })
    .trim()
    .matches(DEPT_ID_REGEX)
    .withMessage(`${name} must be a valid department identifier`);
