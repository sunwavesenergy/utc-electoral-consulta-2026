# Estado de la prueba en Cloudflare

## Completado en la cuenta personal

- Base D1: `utc-electoral-consulta-2026`.
- Esquema creado desde `worker/schema.sql`.
- Importados y verificados **9.264 registros**.
- La consulta de conteo devuelve 9.264; una búsqueda individual devuelve una coincidencia.

El padrón no está en este repositorio ni en el ZIP público. El paquete confidencial de importación debe mantenerse privado. No vuelvas a ejecutar su SQL sobre la base cargada.

## Pendiente para abrir la consulta web

1. Decide el nombre y la URL del repositorio personal de GitHub Pages. No subas `.private/`, el Excel de origen ni el SQL confidencial.
2. Crea un widget Turnstile para el hostname de la página. Copia la sitekey pública a `turnstileSiteKey` en `config.js`.
3. En `wrangler.toml`, cambia `ALLOWED_ORIGIN` por el origen exacto de GitHub Pages (por ejemplo, `https://usuario.github.io`, sin ruta ni barra final). La configuración D1 ya apunta a la base cargada.
4. En Cloudflare, configura los secretos `RATE_LIMIT_SECRET` y `TURNSTILE_SECRET_KEY`. No los guardes en GitHub ni en `config.js`.
5. Despliega el Worker `utc-electoral-lookup` con el binding D1 `DB` ya definido. Copia la URL `workers.dev` a `apiBaseUrl` en `config.js`, sin agregar `/api/lookup`.
6. Publica la interfaz en GitHub Pages y prueba una cédula válida, una inexistente y el límite de consultas.

Las personas que consultan solo necesitan un navegador. Node.js o Wrangler se usan únicamente para la administración y publicación del servicio; no hace falta instalar Python para cargar de nuevo el padrón ya importado.

La base de prueba está en la cuenta personal. No se publicó ni migró nada a la cuenta institucional UTC.
