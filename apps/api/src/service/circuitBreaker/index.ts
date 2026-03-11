/**
 * S6 — Circuit Breakers
 * Placeholder: protect external / unreliable calls (AI, integrations).
 * Domain services that call Intelligence or Integration layers should wrap calls here.
 */
export async function withCircuitBreaker<T>(
  _key: string,
  fn: () => Promise<T>,
): Promise<T> {
  // TODO: implement circuit breaker (e.g. opossum)
  return fn();
}
