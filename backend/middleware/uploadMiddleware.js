export const handleUploadError = (err, _req, res, next) => {
  if (!err) return next();
  return res.status(400).json({ success: false, message: err.message || 'Upload failed' });
};
