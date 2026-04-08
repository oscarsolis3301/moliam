import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fetch = (await import('node-fetch')).default;
const key = "moliam2026";

console.log("=== Test 1: Seed endpoint ===");
try {
  const res = await fetch('https://moliam-staging.pages.dev/api/admin/seed', {
    method: 'POST',
    headers: { 'X-Seed-Key': key }
  });
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Response:", text.slice(0, 200));
} catch(e) {
  console.log("Error:", e.message);
}

console.log("\n=== Test 2: Login ===");
try {
  const loginRes = await fetch('https://moliam-staging.pages.dev/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: "admin@moliam.com", password: "Password123!" })
  });
  console.log("Login Status:", loginRes.status);
} catch(e) {
  console.log("Error:", e.message);
}

console.log("\nDone testing");
