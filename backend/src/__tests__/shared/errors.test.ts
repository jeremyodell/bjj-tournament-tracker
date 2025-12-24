import { describe, it, expect } from '@jest/globals';
import {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
} from '../../shared/errors.js';

describe('Custom errors', () => {
  it('AppError has correct properties', () => {
    const error = new AppError('test message', 400, 'TEST_ERROR');
    expect(error.message).toBe('test message');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('TEST_ERROR');
    expect(error instanceof Error).toBe(true);
  });

  it('NotFoundError has 404 status', () => {
    const error = new NotFoundError('Tournament');
    expect(error.message).toBe('Tournament not found');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
  });

  it('ValidationError has 400 status', () => {
    const error = new ValidationError('Invalid email');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('UnauthorizedError has 401 status', () => {
    const error = new UnauthorizedError();
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('UNAUTHORIZED');
  });
});
