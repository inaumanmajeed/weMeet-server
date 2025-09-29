import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import jwt from 'jsonwebtoken';
import { ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET } from '../../constants.js';
import { User } from '../models/user.model.js';

export const verifyAccessToken = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.accessToken || req.headers?.authorization?.split(' ')[1];

  if (!token) {
    throw new ApiError(401, '👮🏻‍♂️ Unauthorized Access');
  }

  try {
    const decodedToken = jwt.verify(token, ACCESS_TOKEN_SECRET);
    const user = await User.findById(decodedToken.id);

    if (!user) {
      throw new ApiError(401, '👮🏻‍♂️ Invalid Access Token');
    }

    if (user.accessToken !== token) {
      throw new ApiError(401, '👮🏻‍♂️ Invalid Access Token');
    }

    req.user = user;
    next();
  } catch (error) {
    console.log('🚀 ~ error:', error);
    throw new ApiError(401, '👮🏻‍♂️ Unauthorized Access');
  }
});

export const verifyRefreshToken = asyncHandler(async (req, res, next) => {
  const incomingRefreshToken = req.cookies?.refreshToken || req.headers?._x_otu_rt;

  if (!incomingRefreshToken) {
    throw new ApiError(401, '👮🏻‍♂️ Unauthorized Access');
  }

  try {
    const decodedRefreshToken = jwt.verify(incomingRefreshToken, REFRESH_TOKEN_SECRET);

    if (req.user && req.user.id === decodedRefreshToken.id) {
      if (req.user.refreshToken === incomingRefreshToken) {
        return next();
      }
    } else {
      throw new ApiError(401, '👮🏻‍♂️ Invalid Refresh Token');
    }
    next();
  } catch (error) {
    console.log('🚀 ~ error:', error);
    throw new ApiError(401, '👮🏻‍♂️ Unauthorized Access');
  }
});

export const verifyAdmin = asyncHandler(async (req, res, next) => {
  // Check if the user is an admin
  if (req.user && req.user.isAdmin) {
    return next();
  }
  // If not an admin, throw an error
  throw new ApiError(403, '👮🏻‍♂️ Forbidden: Admins only');
});
