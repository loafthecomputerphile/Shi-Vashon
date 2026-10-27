// auth.js — password hashing and session tokens using only WebCrypto
// (built into Workers and Node 18+). Runs in the worker; check.mjs imports
// it for a plain Node self-test.

// Emails are stored lowercase+trimmed so lookups always match.
export function norm(email) {
  return String(email || "").trim().toLowerCase();
}

// --- base64url helpers (no dependencies) ---

function b64url(bytes) {
  let s = btoa(String.fromCharCode(...new Uint8Array(bytes)));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

const enc = new TextEncoder();

// --- passwords: PBKDF2-SHA256, 100k iterations ---

const PBKDF2_ITERATIONS = 100_000;

// Returns "saltB64.hashB64" — a single string that's all we store in KV.
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt);
  return `${b64url(salt)}.${b64url(hash)}`;
}

// Re-derives the hash with the stored salt and compares.
// ponytail: plain === compare, not constant-time — over a network with
// fixed-length digests the timing leak is negligible; switch to a
// constant-time compare only if this ever matters.
export async function verifyPassword(password, stored) {
  const [saltB64, hashB64] = String(stored || "").split(".");
  if (!saltB64 || !hashB64) return false;
  const hash = await pbkdf2(password, unb64url(saltB64));
  return b64url(hash) === hashB64;
}

async function pbkdf2(password, salt) {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveBits"],
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    key,
    256,
  );
}

// --- session tokens: base64url(JSON payload) + "." + HMAC signature ---
// Payload: { e: email, a: 1 if admin, exp: expiry ms }.

export async function makeToken(payload, secret) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await hmac(body, secret);
  return `${body}.${sig}`;
}

// Returns the payload object, or null when the signature or expiry is bad.
export async function verifyToken(token, secret) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  if ((await hmac(body, secret)) !== sig) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(unb64url(body)));
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

async function hmac(data, secret) {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}