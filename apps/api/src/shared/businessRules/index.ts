/**
 * S3 — Business Rule Enforcement (SRS §3.4.6)
 *
 * Central registry for cross-cutting business rules that span multiple domain
 * services.  Domain services call `evaluateBusinessRule` before mutating state
 * so rules remain auditable and independently testable.
 *
 * Built-in rules:
 *
 *   content.lifecycle.transition
 *     Validates a content lifecycle state transition against the SRS-defined
 *     state machine (F-AUT-001 REQ-2):
 *       DRAFT → IN_REVIEW
 *       IN_REVIEW → DRAFT (deny)
 *       IN_REVIEW → PUBLISHED (approve)
 *       IN_REVIEW → ARCHIVED
 *       PUBLISHED → ARCHIVED
 *       PUBLISHED → IN_REVIEW (rollback — F-REV-004)
 *       ARCHIVED → DRAFT (restore)
 *
 *   content.visibility.transition
 *     Validates that a visibility change is coherent with the current lifecycle
 *     state (e.g. DRAFT cannot be set PUBLIC — F-AUT-002).
 *
 *   review.quorum
 *     Checks whether the required number of approvals has been reached before
 *     auto-publishing (F-REV-001 REQ-2).
 *
 *   template.integrity
 *     Ensures a template being deleted is not in use by live content.
 *
 * Additional rules can be added by extending RULE_REGISTRY below.
 */

export type RuleResult = { passed: boolean; message?: string };

type RuleHandler = (context: Record<string, unknown>) => RuleResult;

// ---------------------------------------------------------------------------
// Content lifecycle state machine
// ---------------------------------------------------------------------------

type LifecycleState = "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED";

const VALID_TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
  DRAFT: ["IN_REVIEW"],
  IN_REVIEW: ["DRAFT", "PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["ARCHIVED", "IN_REVIEW"],
  ARCHIVED: ["DRAFT"],
};

function lifecycleTransitionRule(ctx: Record<string, unknown>): RuleResult {
  const from = ctx.from as LifecycleState | undefined;
  const to = ctx.to as LifecycleState | undefined;

  if (!from || !to) {
    return { passed: false, message: "Missing from/to states in context" };
  }

  const allowed = VALID_TRANSITIONS[from];
  if (!allowed) {
    return { passed: false, message: `Unknown source state: ${from}` };
  }

  if (!allowed.includes(to)) {
    return {
      passed: false,
      message: `Invalid state transition: ${from} → ${to}. Allowed: ${allowed.join(", ")}`,
    };
  }

  return { passed: true };
}

// ---------------------------------------------------------------------------
// Visibility transition rule (F-AUT-002)
// ---------------------------------------------------------------------------

function visibilityTransitionRule(ctx: Record<string, unknown>): RuleResult {
  const lifecycleState = ctx.lifecycleState as LifecycleState | undefined;
  const toVisibility = ctx.toVisibility as string | undefined;

  if (!lifecycleState || !toVisibility) {
    return { passed: false, message: "Missing lifecycleState or toVisibility" };
  }

  // Only published content can be PUBLIC (audience-visible)
  if (toVisibility === "PUBLIC" && lifecycleState !== "PUBLISHED") {
    return {
      passed: false,
      message: `Content must be PUBLISHED before it can be set to PUBLIC visibility (current: ${lifecycleState})`,
    };
  }

  return { passed: true };
}

// ---------------------------------------------------------------------------
// Review quorum rule (F-REV-001 REQ-2)
// ---------------------------------------------------------------------------

function reviewQuorumRule(ctx: Record<string, unknown>): RuleResult {
  const requiredApprovals = ctx.requiredApprovals as number | undefined;
  const receivedApprovals = ctx.receivedApprovals as number | undefined;

  if (
    requiredApprovals === undefined ||
    receivedApprovals === undefined
  ) {
    return {
      passed: false,
      message: "Missing requiredApprovals or receivedApprovals in context",
    };
  }

  if (receivedApprovals < requiredApprovals) {
    return {
      passed: false,
      message: `Quorum not met: ${receivedApprovals}/${requiredApprovals} approvals received`,
    };
  }

  return { passed: true };
}

// ---------------------------------------------------------------------------
// Template integrity rule (F-TMP-001 REQ-2)
// ---------------------------------------------------------------------------

function templateIntegrityRule(ctx: Record<string, unknown>): RuleResult {
  const contentUsingTemplate = ctx.contentUsingTemplate as number | undefined;

  if (contentUsingTemplate === undefined) {
    return {
      passed: false,
      message: "Missing contentUsingTemplate count in context",
    };
  }

  if (contentUsingTemplate > 0) {
    return {
      passed: false,
      message: `Cannot delete template: ${contentUsingTemplate} content item(s) still reference it. Migrate content first.`,
    };
  }

  return { passed: true };
}

// ---------------------------------------------------------------------------
// Rule registry
// ---------------------------------------------------------------------------

const RULE_REGISTRY: Record<string, RuleHandler> = {
  "content.lifecycle.transition": lifecycleTransitionRule,
  "content.visibility.transition": visibilityTransitionRule,
  "review.quorum": reviewQuorumRule,
  "template.integrity": templateIntegrityRule,
};

/**
 * Evaluate a named business rule against the provided context.
 * Returns `{ passed: true }` for unknown rules so existing code that
 * has not yet adopted a specific rule is not broken.
 */
export function evaluateBusinessRule(
  rule: string,
  context: Record<string, unknown>,
): RuleResult {
  const handler = RULE_REGISTRY[rule];
  if (!handler) {
    return { passed: true };
  }
  return handler(context);
}

/** Register a custom rule at runtime (useful for plugin-style extensions). */
export function registerBusinessRule(
  name: string,
  handler: RuleHandler,
): void {
  RULE_REGISTRY[name] = handler;
}
