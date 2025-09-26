import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import { User } from '../models/user.model.js';
import { cookieOptions } from '../config.js';

// Method to generate refresh token and access token
const generateAccessAndRefreshTokens = async (userId) => {
  try {
    // fetch user from userId
    const user = await User.findById(userId);
    // generate access token and refresh token
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    // save refresh token in user document
    user.refreshToken = refreshToken;
    user.accessToken = accessToken;
    await user.save({ validateBeforeSave: false });
    // return both tokens
    return { accessToken, refreshToken };
  } catch (error) {
    console.log('🚀 ~ generateAccessAndRefreshTokens ~ error:', error);
    throw new ApiError(500, 'Error generating tokens');
  }
};

const registerUser = asyncHandler(async (req, res) => {
  // extract user data from request body
  const { userName, name, email, password, phoneNumber } = req.body;

  // Validate required fields
  if (
    [userName, name, email, password, phoneNumber].some(
      (field) => field?.trim() === ''
    )
  ) {
    throw new ApiError(400, 'All fields are required');
  }

  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [{ email }, { userName }, { phoneNumber }],
  });
  if (existingUser) {
    throw new ApiError(400, 'User already exists');
  }

  // Create new user
  const user = await User.create({
    userName,
    name,
    email,
    password,
    phoneNumber,
  });

  // validate user creation
  const createdUser = await User.findById(user._id);
  if (!createdUser) {
    throw new ApiError(500, 'User creation failed');
  }

  // Send success response
  return res.status(201).json(
    new ApiResponse(201, `${createdUser.userName} registered successfully`, {
      user: createdUser,
    })
  );
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, userName, password } = req.body;
  // Validate required fields
  if ((!(email || userName) && !password) || password.trim() === '') {
    throw new ApiError(400, 'Email or username and password are required');
  }
  // Find user by email or username
  const user = await User.findOne({
    $or: [{ email }, { userName }],
  });
  if (!user) {
    throw new ApiError(404, 'Invalid email/username');
  }
  // Check password
  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid password');
  }
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  // here we can call the database to fetch the refresh token along with the latest user data or we can update the user document with the new refresh token

  // calling the database to fetch the user data
  const loggedInUser = await User.findById(user._id);

  // updating the user document with the new refresh token
  // user.refreshToken = refreshToken;
  // console.log('🚀 ~ loginUser ~ user:', user);
  return res
    .status(200)
    .cookie('accessToken', accessToken, cookieOptions)
    .cookie('refreshToken', refreshToken, cookieOptions)
    .json(
      new ApiResponse(200, `${loggedInUser.userName} logged in successfully`, {
        user: loggedInUser,
        accessToken,
        refreshToken,
      })
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
  // This function is used to reassign access token when the user is already logged in and the access token is expired.
  // It will generate a new access token and return it to the user.
  if (!req.user) {
    throw new ApiError(401, '👮🏻‍♂️ Unauthorized Access');
  }
  const { accessToken: NewAccessToken, refreshToken: NewRefreshToken } =
    await generateAccessAndRefreshTokens(req.user.id);

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
