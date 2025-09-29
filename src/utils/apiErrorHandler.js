import ApiResponse from './ApiResponse.js';

// eslint-disable-next-line no-unused-vars
const apiErrorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const errors = err.errors || [];
  const data = err.data || null;

  console.error('Error caught by error handler:', err);

  return res
    .status(statusCode)
    .json(new ApiResponse(statusCode, message, data, errors));
};

export default apiErrorHandler;
