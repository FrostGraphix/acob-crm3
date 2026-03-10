import type { NextFunction, Request, Response } from "express";
import { sendEnvelope } from "../services/response.js";

export class HttpError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function notFoundHandler(_request: Request, response: Response) {
  sendEnvelope(response, 404, null, "Not found", 1);
}

export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
) {
  const statusCode =
    error instanceof HttpError
      ? error.statusCode
      : 500;
  const message =
    error instanceof Error
      ? error.message
      : "Unexpected server error";

  sendEnvelope(response, statusCode, null, message, 1);
}
