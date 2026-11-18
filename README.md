# Sistema de Consulta Electoral UTC · Cogobierno 2026–2028

Sitio estático adaptable para GitHub Pages y API privada para Cloudflare Workers + D1. La página no incluye el padrón. El archivo SQL de importación y los Excel deben mantenerse en `.private/`, nunca en GitHub.

## Estructura

- `index.html`, `assets/`, `config.js`: interfaz pública.
- `worker/`: API de consulta individual y esquema D1.
- `tools/import_padron.py`: convierte el padrón Excel en SQL y valida duplicados/numeración.
- `tests/`: pruebas del importador con datos sintéticos.
- `.private/`: datos de consulta y reportes locales, ignorados por Git y excluidos del ZIP.

## Requisitos de publicación

La base D1 de prueba personal ya está creada, con el esquema y los 9.264 registros importados y verificados. La API Worker y la página de GitHub Pages todavía no están publicadas: falta definir el repositorio y su dominio, crear la configuración Turnstile y desplegar el Worker. Esta entrega no toca ninguna cuenta institucional. Turnstile y el límite por IP frenan consultas automatizadas; la cédula por sí sola no confirma identidad, así que para el uso institucional final se recomienda sumar autenticación UTC o un segundo factor.

## Uso sin instalar programas

Las personas que consultan solo necesitan abrir el enlace en el navegador e ingresar su cédula; no instalan Python ni otro programa. Python aparece únicamente en una herramienta opcional para que el equipo técnico regenere el archivo de importación en futuras actualizaciones. Para el padrón recibido, la conversión y validación ya se hicieron en el entorno de preparación; ese SQL privado se mantiene fuera de GitHub y del ZIP.

El personal que consulte solo necesita un navegador; no instala Python ni otro programa. La validación corrigió 49 filas de encabezado que antes se contaban como incompletas; el padrón real tiene 9.264 cédulas únicas y completas. Revisa [el cruce de fuentes](docs/validacion.md) antes de autorizar los 8 docentes que no aparecen y los 53 técnicos docentes excluidos.

## Backend privado Cloudflare

La base personal `utc-electoral-consulta-2026` ya contiene el esquema y los 9.264 registros del paquete confidencial. Se verificó el total y una consulta individual devuelve una coincidencia. No vuelvas a ejecutar el paquete de importación sobre esta base. Sigue [la guía de Cloudflare](docs/PRUEBA_CLOUDFLARE.md) para terminar el despliegue del servicio.

1. Define el nombre y la URL del repositorio personal de GitHub Pages. No subas `.private/`, archivos Excel ni SQL con datos reales.
2. Crea un widget Turnstile asociado al hostname de GitHub Pages. Copia solo la sitekey pública a `turnstileSiteKey` en `config.js`.
3. Configura `ALLOWED_ORIGIN` en `wrangler.toml` con el origen exacto, por ejemplo `https://usuario.github.io` (sin ruta ni barra final, también para un sitio de proyecto). La base D1 existente y su ID ya constan en ese archivo.
4. Guarda `RATE_LIMIT_SECRET` y `TURNSTILE_SECRET_KEY` como secretos del Worker en Cloudflare. No los guardes en el repositorio.
5. Despliega `worker/src/index.js` como Worker `utc-electoral-lookup` con el binding D1 `DB` definido en `wrangler.toml`. Anota la URL pública `workers.dev` y úsala en `config.js` como `apiBaseUrl` (sin `/api/lookup`). La carga de D1 ya está completa; no repitas la importación.
6. Publica la interfaz en GitHub Pages y prueba desde escritorio y teléfono. Las personas que consultan no instalan Python, Node.js ni Wrangler; estas herramientas solo se usan para preparar el servicio.

Cloudflare D1 debe permanecer bajo tu usuario y con acceso restringido. No habilites exportaciones públicas, no pegues los datos en Issues/Actions y no actives trazas con cuerpos de solicitud. El Worker no registra la cédula, valida en servidor el token Turnstile para el hostname y acción esperados, limita cada dirección de origen a 8 consultas por ventana de cinco minutos y solo responde a una cédula por solicitud. La verificación anti-bots no sustituye autenticación UTC ni controles institucionales contra abuso.

## GitHub Pages personal

1. Crea un repositorio personal y copia el contenido del proyecto sin `.private/` ni archivos Excel. Con GitHub Free, Pages requiere repositorio público; con ciertos planes pagados también admite repositorios privados. En ambos casos el sitio publicado es accesible públicamente. No subas datos reales al repositorio y publica solo cuando el backend esté protegido y exista autorización para poner la página en línea.
2. Edita `config.js` con la URL del Worker personal. Verifica que no incluya cédulas ni llaves privadas.
3. Sube la rama `main` a GitHub y activa **Settings → Pages → GitHub Actions**. El flujo `.github/workflows/pages.yml` publica la interfaz.
4. Configura en Cloudflare el origen CORS exacto que Pages muestra. Comprueba desde un teléfono y escritorio, y revisa que la pestaña Network no descargue datos de padrón.

## Pruebas

```powershell
python -m unittest discover -s tests -v
npm run test:worker
```

Antes de publicar, prueba: cédula con menos/más de 10 dígitos; una cédula de prueba válida; una inexistente; entrada repetida hasta obtener HTTP 429; origen no permitido; y que las respuestas incluyan solo el registro solicitado. Usa datos ficticios hasta recibir autorización para usar el padrón real.

## Migración futura a UTC

Cuando la UTC autorice explícitamente el cambio, crea los repositorios y el D1 institucional desde una cuenta/dispositivo autorizado. Copia el código y la configuración sin copiar `.private/` ni secretos. Revisa el acceso al nuevo Worker, carga el padrón vigente por el mismo procedimiento en un canal autorizado y actualiza `config.js` y `ALLOWED_ORIGIN`. Ejecuta de nuevo las pruebas de privacidad y la lista de verificación de publicación. No se requiere ninguna transferencia automática desde GitHub personal.

## Fuente y límites de la versión

El padrón fuente identifica recinto, número de junta, apellidos, nombre y cédula. El archivo de juntas se usa solo para validar la numeración; la ficha no expone designaciones, correos ni cédulas de integrantes de junta. Las direcciones exactas no se pudieron validar, así que “Cómo llegar” permanece desactivado. Confirma también el calendario del proceso con la UTC antes de anunciarlo.

