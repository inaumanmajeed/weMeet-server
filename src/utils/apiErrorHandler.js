import ApiResponse from '../utils/ApiResponse.js';

const apiErrorHandler = (err, req, res) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const errors = err.errors || [];
  const data = err.data || null;

  return res
    .status(statusCode)
    .json(new ApiResponse(statusCode, message, data, errors));
};

export default apiErrorHandler;
