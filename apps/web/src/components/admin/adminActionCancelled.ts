/** Thrown when the user backs out of a two-step admin confirmation (do not show as error). */
export class AdminActionCancelled extends Error {
  constructor() {
    super("AdminActionCancelled");
    this.name = "AdminActionCancelled";
  }
}

export function isAdminActionCancelled(e: unknown): boolean {
  return e instanceof AdminActionCancelled;
}
