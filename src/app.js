import { BASE_URL, LIMIT } from '../constants.js';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import apiErrorHandler from './utils/apiErrorHandler.js';
import { corsConfig } from './config/config.js';

export const app = express();

// Middleware
app.set('trust proxy', 1);
app.use(express.json({ limit: LIMIT }));
app.use(express.urlencoded({ extended: true, limit: LIMIT }));
app.use(cors(corsConfig));
app.use(morgan('dev'));
app.use(helmet());
app.use(cookieParser());

// ====================== { Routes } ======================

// ====================== { Health Check Route } ======================
import healthRoutes from './routes/health.js';
app.use(BASE_URL, healthRoutes);
// ====================== { Auth Routes } ======================
import authRoutes from './routes/auth.routes.js';
app.use(`${BASE_URL}/auth`, authRoutes);

// Error handling middleware should be last
app.use(apiErrorHandler);
