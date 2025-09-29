import { User } from '../models/user.model.js';
import ApiError from './ApiError.js';

export const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    user.accessToken = accessToken;

    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    console.log('🚀 ~ generateAccessAndRefreshTokens ~ error:', error);
    throw new ApiError(500, 'Error generating tokens');
  }
};
