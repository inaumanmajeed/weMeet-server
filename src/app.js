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
app.use(express.json({ limit: LIMIT }));
app.use(express.urlencoded({ extended: true, limit: LIMIT }));
app.use(cors({ origin: CORS_ORIGIN }));
app.use(morgan('dev'));
app.use(helmet());
app.use(cookieParser());

// Routes
import healthRoutes from './routes/health.js';

app.use(`${BASE_URL}/`, healthRoutes);

// Error handling middleware should be last
app.use(apiErrorHandler);
