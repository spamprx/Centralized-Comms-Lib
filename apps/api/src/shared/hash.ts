import bcrypt from "bcryptjs";

const SALT_ROUNDS = Math.min(
  15,
  Math.max(10, Number(process.env.BCRYPT_COST ?? 12) || 12),
);

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
