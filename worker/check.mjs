// check.mjs — self-test for auth.js, run with `npm run check` (plain Node,
// no framework). Fails loudly (non-zero exit) if anything breaks.
import {
  norm, hashPassword, verifyPassword, makeToken, verifyToken,
} from "./src/auth.js";

let failures = 0;
function check(name, ok) {
  if (!ok) {
    failures++;
    console.error(`FAIL ${name}`);
  } else {
    console.log(`ok   ${name}`);
  }
}

const secret = "test-secret";

// email normalisation
check("norm trims + lowercases", norm("  A@B.com ") === "a@b.com");
check("norm handles null", norm(null) === "");

// password roundtrip
const stored = await hashPassword("hunter2");
check("verify right password", await verifyPassword("hunter2", stored));
check("verify wrong password fails", !(await verifyPassword("hunter3", stored)));
check("verify garbage stored hash fails", !(await verifyPassword("x", "not-a-hash")));

// token roundtrip
const token = await makeToken({ e: "a@b.com", a: 1, exp: Date.now() + 60_000 }, secret);
const payload = await verifyToken(token, secret);
check("token roundtrip", payload !== null && payload.e === "a@b.com" && payload.a === 1);

// tampered token rejected
const tampered = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
check("tampered token rejected", (await verifyToken(tampered, secret)) === null);

// expired token rejected
const expired = await makeToken({ e: "a@b.com", exp: Date.now() - 1000 }, secret);
check("expired token rejected", (await verifyToken(expired, secret)) === null);

// wrong secret rejected
check("wrong secret rejected", (await verifyToken(token, "other")) === null);

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");