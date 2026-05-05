/**
 * S1 — Input Validation & Schema Enforcement (Zod).
 */
import type { ZodType } from "zod";
import { AppError } from "../errors/appError";

export function validatePayload<T>(schema: ZodType<T>, payload: unknown): T {
  const r = schema.safeParse(payload);
  if (!r.success) {
    throw new AppError("Validation failed", 400, "VALIDATION_FAILED", {
      issues: r.error.issues,
    });
  }
  return r.data;
}
