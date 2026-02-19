import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from './error.middleware';

export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const message = error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        next(new AppError(`Validation error: ${message}`, 400));
      } else {
        next(error);
      }
    }
  };
}
