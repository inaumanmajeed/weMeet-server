import { NODE_ENV } from '../../constants.js';

export const cookieOptions = {
  httpOnly: NODE_ENV === 'production',
  secure: NODE_ENV === 'production',
  sameSite: NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge: 24 * 60 * 60 * 1000,
};
