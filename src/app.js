import { BASE_URL, CORS_ORIGIN, LIMIT } from '../constants.js';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import apiErrorHandler from './utils/apiErrorHandler.js';

export const app = express();

// Middleware
app.set('trust proxy', 1);
const allowedOrigins = CORS_ORIGIN.split(',').map((origin) => origin.trim());
app.use(express.json({ limit: LIMIT }));
app.use(express.urlencoded({ extended: true, limit: LIMIT }));
app.use(cors({ origin: allowedOrigins }));
app.use(morgan('dev'));
app.use(helmet());
app.use(cookieParser());
app.use(apiErrorHandler);

// Routes

import healthRoutes from './routes/health.js';

app.use(`${BASE_URL}/`, healthRoutes);
