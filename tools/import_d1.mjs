import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const [sqlPath] = process.argv.slice(2);
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;

if (!sqlPath || !accountId || !databaseId || !token) {
  console.error("Uso: node tools/import_d1.mjs <archivo-sql>");
  console.error("Configura CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID y CLOUDFLARE_API_TOKEN en la sesión.");
  process.exit(2);
}

const sql = await readFile(sqlPath);
const etag = createHash("md5").update(sql).digest("hex");
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/import`;
const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

async function api(actionBody) {
  const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(actionBody) });
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(`Cloudflare API respondió HTTP ${response.status}: ${JSON.stringify(result.errors ?? result)}`);
  }
  return result.result;
}

const upload = await api({ action: "init", etag });
if (!upload.upload_url || !upload.filename) throw new Error("Cloudflare no devolvió la URL temporal de carga.");

const uploadResponse = await fetch(upload.upload_url, { method: "PUT", body: sql });
const uploadedEtag = (uploadResponse.headers.get("ETag") ?? "").replaceAll('"', "");
if (!uploadResponse.ok || uploadedEtag !== etag) throw new Error("Falló la carga temporal o no coincide su verificación.");

const started = await api({ action: "ingest", etag, filename: upload.filename });
if (!started.at_bookmark) throw new Error("Cloudflare no confirmó el inicio de importación.");

for (;;) {
  const status = await api({ action: "poll", current_bookmark: started.at_bookmark });
  if (status.success) {
    console.log("Importación de D1 completada.");
    break;
  }
  if (status.error && status.error !== "Not currently importing anything.") {
    throw new Error(`Cloudflare no pudo completar la importación: ${status.error}`);
  }
  if (status.error === "Not currently importing anything.") {
    console.log("Cloudflare terminó el proceso de importación.");
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 1200));
}
