import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import apiRouter from './routes/routes.js';
import { errorHandler } from './middleware/errorHandler.js';

// Setup environment variables
dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// API Namespace
app.use('/api', apiRouter);

// Register centralized error handler
app.use(errorHandler);

export default app;
