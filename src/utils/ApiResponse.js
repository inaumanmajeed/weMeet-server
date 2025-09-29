class ApiResponse {
  constructor(status, message, data = null, meta = null, errors = null) {
    this.status = status;
    this.success = status >= 200 && status < 300;
    this.message = message;
    if (meta && meta !== null && Object.keys(meta).length > 0) {
      this.meta = meta;
    }
    if (data && data !== null) {
      this.data = data;
    }
    if (errors && errors.length > 0) {
      this.errors = errors;
    }
  }
}
export default ApiResponse;
