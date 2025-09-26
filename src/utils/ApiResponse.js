class ApiResponse {
  constructor(status, message, data = null, meta, errors) {
    this.status = status;
    this.success = status >= 200 && status < 300;
    this.message = message;
    if (meta) {
      this.meta = meta;
    }
    this.data = data;
    this.errors = errors || [];
  }
}
export default ApiResponse;
