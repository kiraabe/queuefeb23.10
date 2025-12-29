import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

export type JwtPayload = {
  id: string;
  username: string;
  role: string;
  windowId?: number | null;
  iat: number;
  exp: number;
};

function base64url(input: Buffer | string) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return b
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function signToken(
  payload: Omit<JwtPayload, "iat" | "exp">,
  ttlSeconds: number,
  secret: string,
): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + ttlSeconds,
  } as JwtPayload;
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(body));
  const data = `${headerB64}.${payloadB64}`;
  const sig = createHmac("sha256", secret).update(data).digest();
  return `${data}.${base64url(sig)}`;
}

export function verifyToken(token: string, secret: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  const data = `${headerB64}.${payloadB64}`;
  const expected = createHmac("sha256", secret).update(data).digest();
  const provided = Buffer.from(
    sigB64.replace(/-/g, "+").replace(/_/g, "/"),
    "base64",
  );
  if (
    expected.length !== provided.length ||
    !timingSafeEqual(expected, provided)
  )
    return null;
  try {
    const json = Buffer.from(payloadB64, "base64").toString("utf8");
    const payload = JSON.parse(json) as JwtPayload;
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("base64")}:${key.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [method, saltB64, hashB64] = stored.split(":");
  if (method !== "scrypt") return false;
  try {
    const salt = Buffer.from(saltB64, "base64");
    const key = scryptSync(password, salt, 64);
    const expected = Buffer.from(hashB64, "base64");
    return key.length === expected.length && timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

export function parseCookies(header?: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  const parts = header.split(/;\s*/);
  for (const p of parts) {
    const idx = p.indexOf("=");
    if (idx === -1) continue;
    const k = decodeURIComponent(p.slice(0, idx).trim());
    const v = decodeURIComponent(p.slice(idx + 1).trim());
    out[k] = v;
  }
  return out;
}
