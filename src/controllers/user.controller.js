import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import { User } from '../models/user.model.js';
import { cookieOptions } from '../config/config.js';
import crypto from 'crypto';
import {
  ADMIN_EMAIL,
  GRAVATAR_API_KEY,
  GRAVATAR_BASE_URL,
} from '../../constants.js';
import { generateAccessAndRefreshTokens } from '../utils/generateAccessAndRefreshTokens.js';

const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if ([name, email, password].some((field) => field?.trim() === '')) {
    throw new ApiError(400, 'All fields are required');
  }
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(400, 'User already exists');
  }

  const user = await User.create({
    name,
    email,
    password,
  });

  const hash = crypto.createHash('sha256').update(email).digest('hex');
  const response = await fetch(`${GRAVATAR_BASE_URL}/profiles/${hash}`, {
    headers: {
      Authorization: `Basic ${GRAVATAR_API_KEY}`,
    },
  });
  if (response.status === 200) {
    const data = await response.json();
    if (data && data.avatar_url) {
      user.avatar = `${data.avatar_url}?s=1040`;
    }
    await user.save({ validateBeforeSave: false });
  }

  if (email === ADMIN_EMAIL) {
    user.isAdmin = true;
    await user.save({ validateBeforeSave: false });
  }

  const createdUser = await User.findById(user._id);
  if (!createdUser) {
    throw new ApiError(500, 'User creation failed');
  }

  return res.status(201).json(
    new ApiResponse(201, `${createdUser.name} registered successfully`, {
      user: createdUser,
    })
  );
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || email.trim() === '') {
    throw new ApiError(400, 'Email is required');
  }
  if (!password || password.trim() === '') {
    throw new ApiError(400, 'Password is required');
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(404, 'Invalid email address');
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid password');
  }
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  user.refreshToken = refreshToken;
  user.accessToken = accessToken;
  await user.save({ validateBeforeSave: false });

  const loggedInUser = await User.findById(user._id);

  return res
    .status(200)
    .cookie('accessToken', accessToken, cookieOptions)
    .cookie('refreshToken', refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        `${
          loggedInUser.name.charAt(0).toUpperCase() + loggedInUser.name.slice(1)
        } logged in successfully`,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        }
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user.id,
    {
      refreshToken: null,
      accessToken: null,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  return res
    .status(200)
    .clearCookie('accessToken', cookieOptions)
    .clearCookie('refreshToken', cookieOptions)
    .json(new ApiResponse(200, 'User logged out successfully'));
});

const reassignAccessToken = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, '👮🏻‍♂️ Unauthorized Access');
  }
  const { accessToken: NewAccessToken, refreshToken: NewRefreshToken } =
    await generateAccessAndRefreshTokens(req.user.id);

  req.user.accessToken = NewAccessToken;
  req.user.refreshToken = NewRefreshToken;
  const response = await req.user.save({ validateBeforeSave: false });

  if (!response) {
    throw new ApiError(500, 'Failed to reassign access token');
  }

  return res
    .status(200)
    .cookie('accessToken', NewAccessToken, cookieOptions)
    .cookie('refreshToken', NewRefreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        'New access & refresh token generated successfully',
        {
          accessToken: NewAccessToken,
          refreshToken: NewRefreshToken,
        }
      )
    );
});

export { registerUser, loginUser, logoutUser, reassignAccessToken };
