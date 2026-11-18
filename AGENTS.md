# AGENTS.md — Tsuzuku

Guía operativa para agentes y colaboradores. Léela antes de cambiar código.

## Resumen

Tsuzuku es un tracker personal de manga/anime: Waku 1.0 (React Server Components),
Tailwind 4, Drizzle sobre SQLite local o Turso, Better Auth y AniList como fuente
de metadatos **solo en escritura**. La app siempre lee de su propia base.

## Comandos

Usa **Bun** como gestor principal. Si no está disponible, usa **pnpm**; evita
generar `package-lock.json`.

```bash
bun install
bun run dev
bun run check       # Biome: lint + formato + imports
bun run check:fix   # aplica fixes seguros
bun run typecheck   # OBLIGATORIO (incluye typegen de Waku)
bun run typegen     # rutas tipadas (si clonas sin arrancar dev)
bun run test        # Vitest
bun run build
bun run verify      # check + typecheck + tests + build
```

Equivalentes con pnpm: `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm verify`.
`bun.lock` es la fuente de verdad del lockfile. `bun run typegen` regenera
`src/pages.gen.ts`, que no se commitea.

### Definition of done

Un cambio no está terminado hasta que pasan:

1. `bun run check`
2. `bun run typecheck`
3. `bun run test`
4. `bun run build`

Añade tests cuando el cambio introduce o corrige comportamiento. No commitees
`.env`, `local.db*`, `vault-export.json`, `dist/` ni `node_modules/`.

## Arquitectura

Organización feature-based; las páginas solo coordinan.

```
src/
  features/
    auth/       sesión, login/registro, guard, middleware
    dashboard/  vista de inicio y métricas
    series/     modelo canónico, queries, enriquecimiento, tarjetas
    library/    entradas por usuario, filtros, tabla, editor
    search/     AniList, caché, alta desde proveedor, alta manual
    import/     parser Markdown, preview, apply, UI de importación
    admin/      servicio, acciones y UI de administración
    settings/   exportación JSON/CSV
  components/   UI reutilizable (ui/) y shell
  lib/          db, textos, flash, utilidades
  pages/        rutas Waku (+ _api, _root, _layout)
  middleware/   redirección de rutas privadas
drizzle/        migraciones SQL versionadas
scripts/        migración, importación, enriquecimiento, Turso
tests/          Vitest (parser, import, admin, búsqueda, migraciones)
```

Reglas de dependencia:

- `pages` → `features` → `lib`/`components`. Evita que dos features se importen
  en ciclo; si comparten dominio, muévelo a `series/` o `lib/`.
- Componentes con hooks/eventos llevan `'use client'`; el resto son server
  components.
- La DB (`src/lib/db/client.ts`) solo se importa en servidor, server actions o
  scripts. Nunca desde un componente cliente.

## Waku y RSC

- Cada página declara `getConfig()` con `render: 'static' | 'dynamic'`. Toda
  página que lea sesión, query o datos frescos debe ser `dynamic`.
- Los layouts no son una frontera de autorización: Waku renderiza layout y page
  como slots independientes. La seguridad va en la capa de datos.
- Las server actions (`'use server'`) deben devolver valores serializables y
  validar toda entrada del cliente.
- `requestRefresh()` re-renderiza la ruta; puede remontar componentes. Para
  mensajes que deben sobrevivir al refresh usa `useFlash` (`src/lib/flash.ts`).
- `src/pages.gen.ts` es generado por Waku; no editarlo.

## Autenticación y autorización

- Better Auth con email/contraseña y cookies. `src/features/auth/server.ts`
  construye la instancia de forma lazy.
- `getSessionForHeaders()` es la única lectura de sesión válida: además de la
  cookie, rechaza usuarios con `disabled`.
- Toda consulta/mutación de datos personales empieza con `requireUser()` y
  filtra por `userId` (o `requireAdmin` en admin).
- El middleware solo redirige; no es una barrera de seguridad.
- El primer usuario registrado es admin (`getAdminUserId`). No puede
  desactivarse ni eliminarse a sí mismo.

## Base de datos

- Esquema: `src/lib/db/schema.ts`. Tipos derivados con `$inferSelect`.
- Drivers:
  - Local: `file:./local.db` → `node:sqlite` + `drizzle-orm/sqlite-proxy`.
  - Producción: `libsql://`/`https://` → `@libsql/client/web` + `drizzle-orm/libsql`.
  - Sin binarios nativos; no añadas `better-sqlite3`.
- Migraciones: edita el esquema → `bun run db:generate` → `bun run db:migrate` →
  commitea el SQL de `drizzle/`. El diario `_migrations` es compartido por local
  y Turso.
- Transacciones y consultas con Drizzle; no concatenes SQL con input de usuario.

Tablas clave:

- `user`, `session`, `account`, `verification`: Better Auth (+ `user.disabled`).
- `series`: metadatos canónicos compartidos (`title`, `title_romaji`,
  `title_native`, `normalized_title`, portada, año, total, géneros, proveedor).
- `series_alias`: alias y sinónimos, únicos por `(series_id, normalized_alias)`;
  `normalized_alias` está indexado y alimenta la búsqueda local.
- `library_entry`: estado, progreso, nota, favorito y notas por usuario; único por
  `(user_id, series_id)`.
- `import_job` / `import_entry`: auditoría de importaciones.
- `provider_cache`: respuestas de AniList con TTL de 24 h.

## Búsqueda, AniList y aliases

- AniList se consulta **solo al escribir**: búsqueda, alta, enriquecimiento y
  sincronización de alias. Nunca en render.
- Al añadir un resultado: si existe `provider + id`, se reutiliza; si existe una
  serie local equivalente (título/alias/sinónimos), se enriquece esa fila; si no,
  se crea. Nunca dupliques entradas.
- Coincidencia: título normalizado exacto contra principal, romaji, nativo y
  sinónimos. Fallbacks: título normalizado y apóstrofos (`Darwin-s` →
  `Darwin's`). No aceptes coincidencias difusas sin revisión.
- Rate limits: búsquedas en lotes GraphQL de 8 con 2 s entre lotes; ids también
  en lotes de 8. Reintenta 429/5xx con `Retry-After`. Mantén las acciones de
  servidor por debajo de ~8 s (límite típico de Vercel).
- La búsqueda local usa tokens (todas las palabras deben aparecer en título o
  alias) y se refresca tras un alta.

## Importación del vault

Flujo: `vault:export` (Markdown → JSON) → preview (job + entradas) → apply
(series + library_entry) → enriquecimiento opcional por lotes.

- El vault original nunca se modifica.
- `Pendiente`/`Por leer` → `planning`; `Leyendo` → `in_progress`;
  `Finalizado` → `completed`.
- Idiomas: la UI está en español; identificadores y código en inglés.
- Añade tests de parser/importador para cualquier cambio de mapeo.

## Administración

`/admin` es solo para el primer usuario. Incluye usuarios (desactivar, revocar
sesiones, eliminar), duplicados (elegir destino y fusionar), metadatos
(enriquecer/refrescar) y métricas globales. Toda acción pasa por `assertAdmin` y
`requireUser`; las destructivas piden confirmación.

## Convenciones de código

- TypeScript estricto; sin `any` salvo justificación. Valida límites con Zod.
- Nombres de archivos `kebab-case`; componentes `PascalCase`; funciones
  `camelCase`; constantes `UPPER_SNAKE_CASE`.
- UI: usa tokens de `src/styles.css` (`bg-surface`, `text-muted`, `bg-accent`…).
  No introduzcas colores arbitrarios sin motivo.
- Comentarios solo cuando explican una decisión no obvia.
- Fechas: `Intl.DateTimeFormat('es')`; persistencia en timestamps de SQLite.
- No cambies la API pública de una feature sin actualizar sus tests y README.

## Seguridad

- Nunca commitees secretos ni datos personales (vault, export, DB local).
- No confíes en ids/títulos enviados por el cliente: revalida y reconsulta el
  proveedor por id antes de escribir.
- Todas las queries personales deben incluir `userId`; las de admin, `isAdmin`.
- Mantén `BETTER_AUTH_URL` alineado con el origen real en producción.

## Gotchas

- `node:sqlite` es experimental y solo para local/tests.
- Las páginas estáticas no pueden leer sesión; usa `dynamic` o slices.
- El adaptador de Vercel empaqueta el server; evita dependencias nativas.
- `requestRefresh` puede perder estado local: usa flash o recarga explícita.
- Biome ignora CSS porque Tailwind 4 usa at-rules que su parser no soporta.
- `bun test` ejecuta el runner de Bun; usa `bun run test` para Vitest.

## Recetas

- **Nueva feature:** crea `src/features/<name>/{schema,queries,actions,components}`;
  añade página que solo coordine; autoriza en la capa de datos; tests.
- **Nueva tabla:** edita `schema.ts`, genera/aplica migración, añade queries y
  tests con DB temporal (`scripts/local-migrate.ts`).
- **Nuevo proveedor:** implementa un módulo en `search/` que devuelva
  `ProviderSeries`; guarda siempre en `series` y `series_alias`; no lo llames en
  render.
- **Nueva ruta API:** `src/pages/_api/api/<name>.ts` exportando `GET`/`POST`;
  valida sesión con `getSessionForHeaders`.

## Deploy

- Vercel detecta Waku (`VERCEL=1`) y usa el runtime `nodejs22.x`.
- Variables: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `BETTER_AUTH_SECRET`,
  `BETTER_AUTH_URL`. También se aceptan `TURSO_DATABASE_URL_PROD` y
  `TURSO_TOKEN` como fallback. Para migrar Turso con el `.env` híbrido:
  `bun run db:migrate:turso`.
- Migraciones contra Turso: `bun run db:migrate` con esas variables.
- Tras cambios de esquema, aplica migraciones antes del deploy.
