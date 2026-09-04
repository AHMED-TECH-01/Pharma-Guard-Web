import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';

/**
 * Body validation middleware (master spec §13 - server validation is
 * authoritative). Zod failures flow to the error middleware as 422.
 */
export function validateBody<TSchema extends ZodTypeAny>(schema: TSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(result.error);
      return;
    }
    (req as Request & { validatedBody: z.infer<TSchema> }).validatedBody = result.data;
    next();
  };
}

export function getValidatedBody<TSchema extends ZodTypeAny>(
  req: Request,
  _schema: TSchema,
): z.infer<TSchema> {
  return (req as Request & { validatedBody?: z.infer<TSchema> }).validatedBody as z.infer<TSchema>;
}

/**
 * Query-string validation middleware. Express 5 treats req.query as
 * read-only, so the parsed result is stored separately instead of being
 * assigned back onto req.query.
 */
export function validateQuery<TSchema extends ZodTypeAny>(schema: TSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(result.error);
      return;
    }
    (req as Request & { validatedQuery: z.infer<TSchema> }).validatedQuery = result.data;
    next();
  };
}

export function getValidatedQuery<TSchema extends ZodTypeAny>(
  req: Request,
  _schema: TSchema,
): z.infer<TSchema> {
  return (req as Request & { validatedQuery?: z.infer<TSchema> }).validatedQuery as z.infer<TSchema>;
}
