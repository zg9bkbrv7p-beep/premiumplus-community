import {
  randomBytes,
  createHash,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
export const token = () => randomBytes(32).toString("hex");
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function passwordMatches(password: string, value: string) {
  const [salt, key] = value.split(":");
  if (!key) return false;
  const candidate = scryptSync(password, salt, 64);
  const original = Buffer.from(key, "hex");
  return (
    candidate.length === original.length && timingSafeEqual(candidate, original)
  );
}
