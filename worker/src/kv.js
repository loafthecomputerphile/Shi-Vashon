// kv.js — the "JSON db": every record is a JSON value under a readable key
// in Cloudflare KV (binding DB, see wrangler.toml).
//
//   user:<email>             { hash, admin, limit? }
//   request:<email>          { email, note, ts }        — pending access request
//   login-fail:<email>       { n, lockUntil }           — failed-login counter
//   login-fail:req:<email>   { n, lockUntil }           — access-request counter
//   usage:<email>:<yyyymmdd> { n }                      — generations today
//
// ponytail: KV is eventually consistent — a concurrent burst can overshoot
// a counter by 1. Accepted for a 4/day limit; move counters to a Durable
// Object only if exactness ever matters.
import { norm } from "./auth.js";

const DAY_TTL = 60 * 60 * 24; // seconds

export async function getUser(env, email) {
  return (await env.DB.get(`user:${norm(email)}`, "json")) ?? null;
}

export async function putUser(env, email, user) {
  await env.DB.put(`user:${norm(email)}`, JSON.stringify(user));
}

export async function deleteUser(env, email) {
  await env.DB.delete(`user:${norm(email)}`);
}

export async function getRequest(env, email) {
  return (await env.DB.get(`request:${norm(email)}`, "json")) ?? null;
}

export async function putRequest(env, email, request) {
  await env.DB.put(`request:${norm(email)}`, JSON.stringify(request));
}

export async function deleteRequest(env, email) {
  await env.DB.delete(`request:${norm(email)}`);
}

// All pending requests (admin page list).
export async function listRequests(env) {
  const list = await env.DB.list({ prefix: "request:" });
  const out = [];
  for (const key of list.keys) {
    const r = await env.DB.get(key.name, "json");
    if (r) out.push(r);
  }
  return out;
}

export async function listUsers(env) {
  const list = await env.DB.list({ prefix: "user:" });
  const out = [];
  for (const key of list.keys) {
    const u = await env.DB.get(key.name, "json");
    if (u) out.push({ email: key.name.slice("user:".length), ...u });
  }
  return out;
}

// Shared shape for login-fail and request-rate counters: n failures and an
// optional lockUntil timestamp. GET+PUT is not atomic (see ponytail note).
async function bumpCounter(env, key, max) {
  const cur = (await env.DB.get(key, "json")) ?? { n: 0, lockUntil: 0 };
  cur.n += 1;
  // Escalating lock: each failure past max adds 5 more minutes.
  if (cur.n > max) cur.lockUntil = Date.now() + (cur.n - max) * 5 * 60_000;
  await env.DB.put(key, JSON.stringify(cur), { expirationTtl: DAY_TTL });
  return cur;
}

// Returns {n, lockUntil} after counting a failed login.
export function bumpLoginFail(env, email) {
  return bumpCounter(env, `login-fail:${norm(email)}`, 5);
}

export async function clearLoginFails(env, email) {
  await env.DB.delete(`login-fail:${norm(email)}`);
}

// Returns {n, lockUntil} after counting an access request (max 3/day).
export function bumpRequestCount(env, email) {
  return bumpCounter(env, `login-fail:req:${norm(email)}`, 3);
}

// UTC-day usage key, e.g. usage:a@b.com:20260131.
function usageKey(email) {
  return `usage:${norm(email)}:${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
}

export async function getUsage(env, email) {
  return ((await env.DB.get(usageKey(email), "json")) ?? { n: 0 }).n;
}

// Counts one generation for today. Returns the new count.
export async function bumpUsage(env, email) {
  const key = usageKey(email);
  const cur = (await env.DB.get(key, "json")) ?? { n: 0 };
  cur.n += 1;
  await env.DB.put(key, JSON.stringify(cur), { expirationTtl: 2 * DAY_TTL });
  return cur.n;
}