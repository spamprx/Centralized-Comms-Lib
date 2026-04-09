/**
 * S3 — Business Rule Enforcement
 * Placeholder: central place for business rules (e.g. state transitions, quotas).
 * Domain services may call here or enforce rules inline until this is implemented.
 */
export function evaluateBusinessRule(
  _rule: string,
  _context: Record<string, unknown>,
): { passed: boolean; message?: string } {
  // TODO: implement rule engine
  return { passed: true };
}
