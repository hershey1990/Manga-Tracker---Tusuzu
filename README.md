# Tsuzuku

Tracker personal de manga y anime construido con **Waku + React Server Components + Tailwind CSS**. Nació para reemplazar las notas de Obsidian por una interfaz interactiva: estados, progreso por capítulo/episodio, puntuaciones, notas y búsqueda de metadatos.

## Qué incluye

- Biblioteca privada por usuario con estados, progreso, nota, favoritos y notas.
- Dashboard con estadísticas, actividad reciente y cola de pendientes.
- Búsqueda local por tokens/alias y búsqueda externa en AniList.
- Alta desde AniList que **siempre escribe en tu base**; si ya existe una ficha local equivalente, la enriquece sin duplicar.
- Importación auditada del vault de Obsidian (Markdown → JSON → preview → apply).
- Enriquecimiento por lotes con portada, sinopsis, año, géneros y totales.
- Exportación JSON/CSV.
- Panel de administración: usuarios, desactivación, fusión de duplicados, metadatos y métricas.
- Migración local → Turso y deploy en Vercel.

## Stack

- **Waku 1.0** (React 19, RSC, server actions) sobre Vite.
- **Tailwind CSS 4** con tema oscuro propio.
- **Turso/libSQL** en producción y **SQLite local** (`node:sqlite`) en desarrollo, con el mismo esquema Drizzle.
- **Better Auth** para email + contraseña y sesiones por cookie.
- **AniList GraphQL** para buscar y enriquecer manga/anime, con caché en base de datos.
- **Biome** para lint/format y **Vitest** para tests.
- **Bun** como gestor de paquetes (pnpm/npm siguen siendo compatibles con los scripts).

## Requisitos

- **Bun 1.4+** (recomendado), o **pnpm 10** + **Node 22.15+**.
- No se necesitan binarios nativos: SQLite local usa el módulo integrado de Node.

## Arranque

```bash
bun install
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
# genera un secreto real:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
bun run db:migrate
bun run dev
```

Abre `http://localhost:3000`, crea una cuenta y empieza a añadir series.

> Si el puerto 3000 está ocupado, Waku usa otro. Ajusta `BETTER_AUTH_URL` al mismo origen o Better Auth rechazará el login con `Invalid origin`. En desarrollo se aceptan los puertos 3000–3002.

### Variables de entorno

| Variable             | Uso                                                          |
| -------------------- | ------------------------------------------------------------ |
| `TURSO_DATABASE_URL` | `file:./local.db` en desarrollo; `libsql://…` en producción. |
| `TURSO_AUTH_TOKEN`   | Token de Turso. Solo producción.                             |
| `BETTER_AUTH_SECRET` | Secreto de al menos 32 caracteres. Obligatorio.              |
| `BETTER_AUTH_URL`    | URL pública de la app (para cookies y origen).               |

Se aceptan como alias `TURSO_DATABASE_URL_PROD` y `TURSO_TOKEN`; las variables
`TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` tienen prioridad.

## Calidad

El **typecheck es obligatorio**: ningún cambio se considera terminado si `bun run typecheck` falla. Antes de commitear:

```bash
bun run check      # Biome: lint + formato + imports
bun run typecheck  # tsc estricto
bun run test       # Vitest
bun run build      # build de producción

# todo junto
bun run verify
```

- `bun run check:fix` aplica formato y fixes seguros.
- `bun run typegen` regenera `src/pages.gen.ts` (Waku lo hace al arrancar `dev`; es necesario para typecheck en un clon limpio).
- `biome.json` excluye generados (`src/pages.gen.ts`, `drizzle/`, `dist/`, CSS de Tailwind).
- Con pnpm: `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm verify`.

Las reglas de arquitectura, patrones y “definition of done” para agentes y colaboradores están en [AGENTS.md](./AGENTS.md).

## Migrar el vault de Obsidian

El vault original nunca se modifica. El flujo es exportar → previsualizar → aplicar.

```bash
# Por defecto lee C:\Obsidian Vault\Surface Vault\Mangas\Series
bun run vault:export

# También puedes indicar carpeta y salida:
bun run vault:export -- "D:\ruta\Series" "salida.json"
```

Luego entra en **Importar**, sube `vault-export.json` y revisa el resumen:

- **Nuevas**: se crearán como serie + entrada de biblioteca.
- **Duplicadas**: mismo título repetido dentro del archivo; se omite la segunda.
- **Ya existentes**: ya están en tu biblioteca; no se tocan.

Al aplicar se guardan estado, capítulo, notas y enlace. Cada importación queda auditada en `import_job` / `import_entry` y visible en el historial.

### Completar fichas desde AniList

Al importar, deja marcada la opción **“Buscar portadas y fichas en AniList al terminar”**. Tras crear las series, la app consulta AniList por lotes (8 títulos por petición GraphQL), muestra progreso y permite cancelar. Copia portada, sinopsis, año, géneros y totales a tu tabla `series`.

AniList **no es la base de datos**: solo se consulta al importar o enriquecer. Todas las vistas leen de SQLite/Turso, así que la app sigue funcionando sin AniList y no depende de su API para mostrar tu biblioteca.

También puedes importar y enriquecer desde terminal, sin navegador:

```bash
bun run import:vault-db -- --email=tu@correo.com --file=vault-export.json --enrich
```

Y si ya importaste y solo quieres completar fichas:

```bash
bun run enrich:library -- --email=tu@correo.com
# o sin --email: usa el primer usuario registrado
bun run enrich:library
```

La coincidencia es por **título normalizado exacto** contra título principal, romaji, nativo o sinónimos de AniList. Si el título del vault no coincide, la serie queda sin proveedor y puedes buscarla/crearla manualmente, o reintentar desde **Admin → Metadatos**.

Estados traducidos: `Pendiente`/`Por leer` → `planning`, `Leyendo` → `in_progress`, `Finalizado` → `completed`.

## Mover tus datos a Turso

### Opción A — crear Turso desde tu base local (recomendada)

Copia esquema **y** datos, incluidas tu cuenta y sesiones, en un solo paso:

```bash
bun run db:checkpoint
turso db create tsuzuku --from-file ./local.db
turso db show tsuzuku --url
turso db tokens create tsuzuku
```

Pon esas credenciales en `.env`:

```dotenv
TURSO_DATABASE_URL=libsql://tsuzuku-....turso.io
TURSO_AUTH_TOKEN=...
```

Comprueba que todo sigue ahí:

```bash
bun run dev
```

La copia incluye el diario `_migrations`, así que `bun run db:migrate` es seguro e idempotente si más adelante añadimos columnas o tablas.

### Opción B — sincronizar a una base Turso existente

Para una base ya creada, o para volver a empujar cambios después:

```bash
# 1. Mira qué se va a copiar, sin escribir nada
TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... bun run db:push-turso -- --dry-run

# 2. Aplica migraciones si hace falta y copia todas las tablas
TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... bun run db:push-turso
```

El script copia en orden de claves foráneas (`user` → `series` → `library_entry` → …) con `INSERT OR REPLACE`, así que es idempotente. No borra filas que existan solo en Turso.

Finalmente configura las mismas variables en Vercel y ejecuta el deploy. `BETTER_AUTH_URL` debe ser la URL pública final.

## Arquitectura

Feature-based; las páginas solo coordinan. El detalle de patrones y reglas está en [AGENTS.md](./AGENTS.md).

```
src/
  features/
    auth/        sesión, login, registro, middleware
    dashboard/   vista de inicio y estadísticas
    series/      modelo canónico, queries y tarjetas
    library/     entradas por usuario, filtros, tabla, editor
    search/      AniList, caché, alta manual
    import/      parser Markdown, preview y aplicación
    settings/    exportación JSON/CSV
  components/    UI reutilizable y shell
  lib/           db, textos, utilidades
  pages/         rutas Waku
  middleware/    redirección de rutas privadas
drizzle/         migraciones SQL versionadas
scripts/         migración local y export del vault
tests/           parser, importador, export y utilidades
```

**Regla de autorización:** cada consulta o mutación de datos personales empieza con `requireUser()` y filtra por `userId`. Los layouts no son una frontera de seguridad; el middleware solo mejora la experiencia redirigiendo.

Al añadir una serie desde **Buscar**, el resultado se copia a `series` y se crea tu `library_entry`. Si ya existía una serie local con ese título (por ejemplo, una nota importada de Obsidian), se **enriquece esa misma ficha** en lugar de duplicarla, conservando tu progreso y notas. La ficha muestra “Ficha guardada en tu base · copia local de anilist”.

La búsqueda local usa coincidencia por **tokens y alias**: “100 kanojo” encuentra una serie guardada con su título largo en inglés, y “100 novias” la encuentra por el sinónimo español de AniList. Después de añadir desde AniList, la sección “En tu biblioteca” se refresca automáticamente y la tarjeta queda marcada como “En tu lista” con enlace a la ficha local.

Si tienes fichas antiguas a las que les faltan sinónimos localizados, sincronízalos una vez:

```bash
bun run sync:aliases
```

Hace consultas por lotes de ids y guarda título principal, romaji, nativo y sinónimos en `series_alias`. Las altas nuevas ya los guardan automáticamente.

## Administración

El **primer usuario registrado** es el administrador. Aparece una entrada **Admin** en la navegación y `/admin` responde 404 para el resto. Si ese usuario se elimina, el siguiente más antiguo hereda el rol.

Desde el panel puedes:

- **Usuarios:** ver altas, series y sesiones activas; desactivar (cierra sesiones y bloquea el login), reactivar, revocar sesiones o eliminar la cuenta y sus datos en cascada. Nunca puedes desactivar/eliminar tu propia cuenta.
- **Duplicados:** agrupa series por título normalizado. Eliges la que conserva los metadatos y el resto se fusiona: las entradas de cada usuario se mueven o combinan (progreso máximo, mejor estado, nota, favorito y notas unidas), y se migran alias e historial de importación.
- **Metadatos:** enriquece series importadas sin proveedor buscando coincidencia exacta en AniList (10 por clic), o refresca portada/sinopsis de series ya vinculadas.

La desactivación se guarda en `user.disabled`; el hook de sesión de Better Auth y `getSessionForHeaders()` la respetan, así que una cuenta desactivada no puede volver a entrar ni conservar sesiones.

> Si tu base Turso se creó antes de esta función, ejecuta `bun run db:migrate` con las credenciales de Turso para añadir la columna `disabled`.

### Modelo de datos

- `user`, `session`, `account`, `verification`: Better Auth.
- `series`: metadatos canónicos compartidos (título, portada, año, total, géneros, proveedor).
- `library_entry`: estado, progreso, nota, favorito y notas **por usuario**. Único por `(user_id, series_id)`.
- `series_alias`: títulos alternativos para búsquedas locales.
- `import_job` / `import_entry`: auditoría de migraciones.
- `provider_cache`: respuestas de AniList con TTL.

## Scripts

| Comando                       | Qué hace                                                       |
| ----------------------------- | -------------------------------------------------------------- |
| `bun run dev`                 | Servidor de desarrollo.                                        |
| `bun run build` / `bun start` | Build y servidor de producción.                                |
| `bun run check`               | Biome (lint + formato).                                        |
| `bun run check:fix`           | Aplica formato y fixes seguros.                                |
| `bun run format`              | Solo formato.                                                  |
| `bun run typecheck`           | TypeScript estricto (obligatorio).                             |
| `bun run typegen`             | Regenera las rutas tipadas de Waku.                            |
| `bun run test`                | Vitest (42 tests).                                             |
| `bun run verify`              | check + typecheck + tests + build.                             |
| `bun run db:generate`         | Genera migración tras cambiar `src/lib/db/schema.ts`.          |
| `bun run db:migrate`          | Aplica migraciones (local o Turso según env).                  |
| `bun run db:checkpoint`       | Consolida el WAL antes de copiar `local.db`.                   |
| `bun run db:push-turso`       | Copia todas las tablas locales a Turso.                        |
| `bun run enrich:library`      | Copia fichas de AniList a tu biblioteca por lotes.             |
| `bun run sync:aliases`        | Sincroniza sinónimos localizados para la búsqueda local.       |
| `bun run import:vault-db`     | Importa el JSON del vault en la base, con `--enrich` opcional. |
| `bun run vault:export`        | Convierte las notas Markdown en JSON.                          |

## Deploy en Vercel + Turso

1. Crea una base en Turso y guarda la URL y el token (o usa la sección anterior para copiar tu `local.db`).
2. Si la base está vacía, aplica las migraciones apuntando a Turso:

   ```bash
   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... bun run db:migrate
   ```
3. Importa el repo en Vercel. Waku detecta Vercel automáticamente (`VERCEL=1`) y genera `.vercel/output`.
4. Configura en Vercel:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `BETTER_AUTH_SECRET`
   - `BETTER_AUTH_URL` = URL final del deploy (sin slash)
5. Deploy. El runtime es Node (`nodejs22.x`), compatible con `@libsql/client/web`.

## Límites conocidos

- `node:sqlite` es experimental; se usa solo en desarrollo y tests.
- No hay recuperación de contraseña ni verificación de email todavía.
- La búsqueda externa depende de AniList; si la API falla, la app muestra el error y permite crear la serie manualmente.
- Los totales de series en publicación pueden venir vacíos; el editor permite sobrescribirlos.
- Compartir listas públicamente no está implementado: cada cuenta ve solo la suya.
