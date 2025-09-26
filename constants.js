// import dotenv from "dotenv";
// dotenv.config();

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
export const API_ENDPOINT = process.env.API_ENDPOINT;
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
export const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
export const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
export const CLOUDINARY_GAMES_FOLDER = process.env.CLOUDINARY_GAMES_FOLDER;
export const EMAIL_HOST = process.env.EMAIL_HOST;
export const EMAIL_PORT = process.env.EMAIL_PORT;
export const EMAIL_USER = process.env.EMAIL_USER;
export const EMAIL_PASS = process.env.EMAIL_PASS;
