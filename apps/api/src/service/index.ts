/**
 * Service layer (SRS architecture).
 * S1 Validation, S2 Authorization, S3 BusinessRules, S6 CircuitBreaker = placeholders.
 * S4 Domain Services + S5 Outbox (transactional) = implemented in domain/.
 */
export { type AuditContext } from "./context";
export { validatePayload } from "./validation";
export { checkResourceAccess } from "./authorization";
export { evaluateBusinessRule } from "./businessRules";
export { withCircuitBreaker } from "./circuitBreaker";
export {
  contentService,
  tagService,
  reviewService,
  adminService,
  authService,
  channelService,
  templateService,
} from "./domain";
