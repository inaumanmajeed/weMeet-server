import dotenv from 'dotenv';
dotenv.config();

export const BASE_URL = process.env.API_BASE_URL;
export const PORT = process.env.PORT || 5000;

export const DB_NAME = process.env.DB_NAME;
export const MONGO_URI = process.env.MONGO_URI;
export const CORS_ORIGIN = process.env.CORS_ORIGIN;
export const LIMIT = process.env.LIMIT;
export const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
export const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;
export const ACCESS_EXPIRY = process.env.ACCESS_EXPIRY;
export const REFRESH_EXPIRY = process.env.REFRESH_EXPIRY;
export const NODE_ENV = process.env.NODE_ENV || 'development';

export const GRAVATAR_API_KEY = process.env.GRAVATAR_API_KEY;
export const GRAVATAR_BASE_URL = process.env.GRAVATAR_BASE_URL;


export const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
