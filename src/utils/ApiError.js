class ApiError extends Error {
  constructor(statusCode, message, errors = [], data = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.data = data;
    this.success = false;
  }
}

export default ApiError;
