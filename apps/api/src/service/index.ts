/**
 * Service layer (SRS architecture).
 * S1 Validation, S2 Authorization, S3 BusinessRules, S6 CircuitBreaker = placeholders.
 * S4 Domain services live under `modules/<domain>/`.
 */
export { type AuditContext } from "../shared/context";
export { validatePayload } from "../shared/validation";
export { checkResourceAccess } from "../shared/authorization";
export { evaluateBusinessRule } from "../shared/businessRules";
export { withCircuitBreaker } from "../shared/circuitBreaker";
export { contentService } from "../modules/content/content.service";
export { tagService } from "../modules/tag/tag.service";
export { reviewService } from "../modules/review/review.service";
export { adminService } from "../modules/admin/admin.service";
export { authService } from "../modules/auth/auth.service";
export { channelService } from "../modules/channel/channel.service";
export { templateService } from "../modules/template/template.service";
export { formattingRuleService } from "../modules/template/formattingRule.service";
export { workspaceService } from "../modules/workspace/workspace.service";
export { whatsappSendService } from "../modules/whatsapp-send/whatsappSend.service";
