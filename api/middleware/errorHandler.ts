import { Request, Response, NextFunction } from 'express';
import axios, { AxiosError } from 'axios';

export class ApiError extends Error {
  statusCode: number;
  details?: any;

  constructor(message: string, statusCode: number = 500, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const formatEmagError = (error: any): { message: string; details?: any } => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<any>;
    if (axiosError.response) {
      const { status, data } = axiosError.response;
      if (data?.isError && data?.messages?.length > 0) {
        return {
          message: data.messages.join(', '),
          details: data,
        };
      }
      if (data?.message) {
        return { message: data.message, details: data };
      }
      return {
        message: `HTTP ${status}: ${axiosError.message}`,
        details: data,
      };
    }
    return { message: axiosError.message };
  }
  return {
    message: error.message || 'Unknown error occurred',
    details: error,
  };
};

export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err);

  let statusCode = 500;
  let message = 'An unexpected error occurred';
  let details: any = undefined;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (axios.isAxiosError(err)) {
    const formatted = formatEmagError(err);
    statusCode = err.response?.status || 500;
    message = formatted.message;
    details = formatted.details;
  } else if (err instanceof Error) {
    message = err.message;
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    errorType: err.name || 'Error',
    message,
    details,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
  });
};

export const validationError = (message: string, field?: string): ApiError => {
  return new ApiError(message, 400, field ? { field, type: 'validation_error' } : undefined);
};

export const notFoundError = (resource: string): ApiError => {
  return new ApiError(`${resource} not found`, 404);
};
