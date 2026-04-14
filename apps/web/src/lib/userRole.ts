/** Global role from JWT / auth API (`apps/api` uses ADMIN | USER). */
export function isGlobalAdmin(role: string | null | undefined): boolean {
  return role === "ADMIN";
}
