import { CORS_ORIGIN, NODE_ENV } from '../../constants.js';

export const cookieOptions = {
  httpOnly: NODE_ENV === 'production',
  secure: NODE_ENV === 'production',
  sameSite: NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge: 24 * 60 * 60 * 1000,
};

export const corsConfig = {
  origin: CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
