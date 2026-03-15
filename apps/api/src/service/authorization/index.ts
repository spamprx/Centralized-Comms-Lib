/**
 * S2 — Object-Level Authorization
 * Placeholder: check resource ownership / permissions before domain logic.
 * Domain services may call here or enforce inline until this is implemented.
 */
export async function checkResourceAccess(
  _actorId: string,
  _resource: string,
  _resourceId: string,
  _action: string,
): Promise<{ allowed: boolean }> {
  // TODO: implement policy checks
  return { allowed: true };
}
