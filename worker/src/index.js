const json = (body, status, origin) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
    "Pragma": "no-cache",
    "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  }
});

async function hash(value, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = env.ALLOWED_ORIGIN || "";
    if (request.method === "OPTIONS") {
      if (origin !== allowed) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: {
        "Access-Control-Allow-Origin": allowed,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "600",
        "Vary": "Origin"
      } });
    }
    if (origin !== allowed || request.method !== "POST" || new URL(request.url).pathname !== "/api/lookup") {
      return json({ error: "not_found" }, 404, allowed);
    }
    const length = Number(request.headers.get("Content-Length") || 0);
    if (length > 1024) return json({ error: "invalid_request" }, 400, allowed);
    let payload;
    try { payload = await request.json(); } catch { return json({ error: "invalid_request" }, 400, allowed); }
    const cedula = typeof payload?.cedula === "string" ? payload.cedula.replace(/\D/g, "") : "";
    const turnstileToken = typeof payload?.turnstileToken === "string" ? payload.turnstileToken : "";
    if (!/^\d{10}$/.test(cedula)) return json({ error: "invalid_cedula" }, 400, allowed);
    if (!turnstileToken || turnstileToken.length > 2048) return json({ error: "verification_required" }, 403, allowed);

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (!env.RATE_LIMIT_SECRET) return json({ error: "service_unavailable" }, 503, allowed);
    const ipHash = await hash(ip, env.RATE_LIMIT_SECRET);
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - (now % 300);
    await env.DB.prepare(`INSERT INTO lookup_limits(ip_hash,window_start,request_count)
      VALUES(?,?,1) ON CONFLICT(ip_hash) DO UPDATE SET
      request_count=CASE WHEN window_start=excluded.window_start THEN request_count+1 ELSE 1 END,
      window_start=excluded.window_start`).bind(ipHash, windowStart).run();
    const limit = await env.DB.prepare("SELECT request_count FROM lookup_limits WHERE ip_hash=?").bind(ipHash).first();
    if ((limit?.request_count || 0) > 8) return json({ error: "rate_limited" }, 429, allowed);

    if (!env.TURNSTILE_SECRET_KEY) return json({ error: "service_unavailable" }, 503, allowed);
    const form = new FormData();
    form.set("secret", env.TURNSTILE_SECRET_KEY);
    form.set("response", turnstileToken);
    form.set("remoteip", ip);
    let verification;
    try {
      const verifyResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
      verification = await verifyResponse.json();
    } catch {
      return json({ error: "verification_unavailable" }, 503, allowed);
    }
    const expectedHost = new URL(allowed).hostname;
    if (!verification?.success || verification.hostname !== expectedHost || verification.action !== "electoral_lookup") {
      return json({ error: "verification_failed" }, 403, allowed);
    }

    const row = await env.DB.prepare(`SELECT cedula,name,polling_place,station,campus,address,maps_url
      FROM voters WHERE cedula=? LIMIT 1`).bind(cedula).first();
    if (!row) return json({ error: "not_found" }, 404, allowed);
    return json({ record: {
      cedula: row.cedula, name: row.name, pollingPlace: row.polling_place,
      station: row.station, campus: row.campus, address: row.address,
      mapsUrl: row.maps_url
    } }, 200, allowed);
  }
};

export { hash };
