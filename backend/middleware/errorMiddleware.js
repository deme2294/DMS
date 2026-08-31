import { HTTP } from '../config/constants.js';

export const notFound = (req, res) => {
  res.status(HTTP.NOT_FOUND).json({ success: false, message: `Route not found: ${req.originalUrl}` });
};

export const errorHandler = (err, _req, res, _next) => {
  console.error(`[Error] ${err.name || 'Error'}: ${err.message}`);
  
  let status = err.statusCode || HTTP.SERVER_ERROR;
  let message = err.message || 'Internal server error';

  // Handle JWT Errors
  if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(err.name)) {
    status = HTTP.UNAUTHORIZED;
    message = 'Invalid or expired token';
  }

  // Handle Multer Errors
  if (err.name === 'MulterError') {
    status = HTTP.BAD_REQUEST;
    message = `File upload error: ${err.message}`;
  }

  // Handle CORS Errors
  if (err.message && err.message.includes('Not allowed by CORS')) {
    status = HTTP.FORBIDDEN;
    message = 'Cross-Origin Resource Sharing policy does not allow access from this origin.';
  }

  res.status(status).json({
    success: false,
    message,
    errors: err.errors || undefined,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};
