import { Request, Response, NextFunction } from 'express';

export interface CustomError extends Error {
  status?: number;
}

export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  console.error(`[Error Handler] [${req.method} ${req.url}]:`, {
    message,
    status,
    stack: status === 500 ? err.stack : undefined
  });

  res.status(status).json({
    error: message,
    status
  });
};
