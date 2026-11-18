import { Avatar } from '../components/ui/cover';
import { DownloadIcon, SparkIcon } from '../components/ui/icons';
import { requireUserOrRedirect } from '../features/auth/session';
import { getLibraryStats } from '../features/library/queries';

export default async function SettingsPage() {
  const user = await requireUserOrRedirect('/settings');
  const stats = await getLibraryStats(user.id);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Ajustes
        </h1>
        <p className="text-sm text-muted">
          Tu cuenta y tus datos. Sin sorpresas.
        </p>
      </header>

      <section className="panel space-y-4 p-5">
        <h2 className="text-sm font-semibold text-white">Cuenta</h2>
        <div className="flex items-center gap-3">
          <Avatar
            name={user.name ?? user.email}
            src={user.image}
            className="size-11 text-sm"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">
              {user.name ?? 'Sin nombre'}
            </p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-muted">
          Tu lista es privada: cada cuenta ve solo sus entradas. Las series
          canónicas se comparten para evitar duplicar metadatos, pero el
          progreso, las notas y las puntuaciones son tuyos.
        </p>
      </section>

      <section className="panel space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Exportar biblioteca
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              JSON para respaldo o CSV para hojas de cálculo. Incluye estado,
              progreso, nota, notas y enlaces.
            </p>
          </div>
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-surface-raised text-accent">
            <DownloadIcon className="size-4" />
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href="/api/export?format=json"
            className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-void hover:bg-[#87a1ff]"
          >
            Descargar JSON
          </a>
          <a
            href="/api/export?format=csv"
            className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-surface-raised px-4 text-sm text-ink hover:border-[#323a52]"
          >
            Descargar CSV
          </a>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-line/70 pt-4 text-xs sm:grid-cols-4">
          <div>
            <p className="text-muted">Series</p>
            <p className="text-base font-semibold text-white">{stats.total}</p>
          </div>
          <div>
            <p className="text-muted">Manga</p>
            <p className="text-base font-semibold text-white">
              {stats.byType.manga}
            </p>
          </div>
          <div>
            <p className="text-muted">Anime</p>
            <p className="text-base font-semibold text-white">
              {stats.byType.anime}
            </p>
          </div>
          <div>
            <p className="text-muted">Progreso total</p>
            <p className="text-base font-semibold text-white">
              {stats.unitsRead}
            </p>
          </div>
        </div>
      </section>

      <section className="panel space-y-3 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <SparkIcon className="size-4 text-accent" />
          Datos y proveedores
        </h2>
        <p className="text-xs leading-relaxed text-muted">
          Los metadatos se consultan a AniList cuando buscas una serie nueva y
          se guardan en tu base de datos. Turso/libSQL hospeda la base en
          producción y SQLite local en desarrollo. La app no modifica tu vault
          de Obsidian: solo lee el JSON que generas.
        </p>
      </section>
    </div>
  );
}

export const getConfig = async () => {
  return { render: 'dynamic' } as const;
};
