import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/src/index.js";

function fakeEnv() {
  const limits = new Map();
  const voter = { cedula: "0501234567", name: "PERSONA DE PRUEBA", polling_place: "La Matriz", station: "1", campus: "La Matriz", address: "", maps_url: "" };
  return { ALLOWED_ORIGIN: "https://example.github.io", RATE_LIMIT_SECRET: "unit-test-secret-value", TURNSTILE_SECRET_KEY: "turnstile-test-secret", DB: { prepare(sql) {
    return { values: [], bind(...values) { this.values = values; return this; },
      async run() {
        const [ipHash, windowStart] = this.values;
        const old = limits.get(ipHash);
        limits.set(ipHash, { window_start: windowStart, request_count: old?.window_start === windowStart ? old.request_count + 1 : 1 });
        return {};
      },
      async first() {
        if (sql.includes("lookup_limits")) return limits.get(this.values[0]) || null;
        return this.values[0] === voter.cedula ? voter : null;
      }
    };
  } } };
}

const req = (cedula, origin = "https://example.github.io") => new Request("https://api.example.workers.dev/api/lookup", {
  method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "CF-Connecting-IP": "192.0.2.1" }, body: JSON.stringify({ cedula, turnstileToken: "valid-test-token" })
});

async function withTurnstileStub(run) {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true, hostname: "example.github.io", action: "electoral_lookup" }), { status: 200 });
  try { return await run(); } finally { globalThis.fetch = original; }
}

test("returns one record for an allowed exact lookup", async () => {
  const response = await withTurnstileStub(() => worker.fetch(req("0501234567"), fakeEnv()));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).record.station, "1");
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
});

test("rejects a disallowed website origin", async () => {
  const response = await worker.fetch(req("0501234567", "https://other.example"), fakeEnv());
  assert.equal(response.status, 404);
});

test("rejects a token that Turnstile cannot validate", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ success: false }), { status: 200 });
  try {
    const response = await worker.fetch(req("0501234567"), fakeEnv());
    assert.equal(response.status, 403);
  } finally { globalThis.fetch = original; }
});

test("limits repeated lookups per source address", async () => {
  await withTurnstileStub(async () => {
    const env = fakeEnv(); let response;
    for (let i = 0; i < 9; i++) response = await worker.fetch(req("0501234567"), env);
    assert.equal(response.status, 429);
  });
});
