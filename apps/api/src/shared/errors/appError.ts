/**
 * Application-level error with an HTTP status code.
 */
export class AppError extends Error {
  public constructor(
    message: string,
    public readonly statusCode = 500,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}
