/** Fel som är avsedda att nå klienten med en läsbar svensk text. */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'bad_request', message, details);

export const unauthorized = (message = 'Du måste vara inloggad.') =>
  new AppError(401, 'unauthorized', message);

export const forbidden = (message = 'Du har inte behörighet till den här resursen.') =>
  new AppError(403, 'forbidden', message);

export const notFound = (message = 'Resursen hittades inte.') =>
  new AppError(404, 'not_found', message);

export const conflict = (message: string, details?: unknown) =>
  new AppError(409, 'conflict', message, details);

export const failedDependency = (message: string, details?: unknown) =>
  new AppError(424, 'integration_error', message, details);

/** Funktionen finns i koden men är inte påslagen i den här miljön. */
export const serviceUnavailable = (message: string) =>
  new AppError(503, 'service_unavailable', message);
