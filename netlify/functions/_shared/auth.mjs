import crypto from "node:crypto";
import { db, json } from "./db.mjs";

const SESSION_HOURS = 12;

export function normalizeLogin(v) {
  return String(v ?? "").trim().toUpperCase();
}
export function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString("hex");
}
export function makePassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  return { salt, hash: hashPassword(password, salt) };
}
export function verifyPassword(password, salt, expected) {
  const actual = hashPassword(password, salt);
  try {
    return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}
export function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_HOURS * 3600_000);
  await db().query(
    "INSERT INTO paes_sessions(user_id, token_hash, expires_at) VALUES($1,$2,$3)",
    [userId, tokenHash(token), expires]
  );
  return token;
}
export async function auth(req) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  const { rows } = await db().query(
    `SELECT u.id,u.name,u.login,u.role,s.expires_at
     FROM paes_sessions s JOIN paes_users u ON u.id=s.user_id
     WHERE s.token_hash=$1 AND s.expires_at>now()`,
    [tokenHash(token)]
  );
  return rows[0] || null;
}
export async function requireAuth(req) {
  const user = await auth(req);
  if (!user) return { error: json({ error: "Sessão inválida ou expirada." }, 401) };
  return { user };
}
export function canEdit(user) {
  return user && ["developer","bordo","pmb"].includes(user.role);
}
export function isDeveloper(user) {
  return user?.role === "developer";
}
