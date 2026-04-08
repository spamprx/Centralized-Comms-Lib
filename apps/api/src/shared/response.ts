import type { Response } from "express";

export function jsonOk<T>(res: Response, body: T, status = 200): Response {
  return res.status(status).json(body);
}

export function jsonError(res: Response, message: string, status = 400): Response {
  return res.status(status).json({ error: message });
}
