import { Link } from 'waku';
import {
  BookIcon,
  CheckIcon,
  ChevronRightIcon,
  LibraryIcon,
  PlayIcon,
  PlusIcon,
  SparkIcon,
  StarIcon,
} from '../../components/ui/icons';
import {
  EmptyState,
  SectionHeader,
  StatCard,
} from '../../components/ui/stat-card';
import { formatDate } from '../../lib/text';
import {
  getEntriesByStatus,
  getLibraryStats,
  getRecentEntries,
} from '../library/queries';
import { QueueRow, SeriesCard } from '../series/components/series-card';
import { STATUS_META } from '../series/schema';

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 6) return 'Buenas noches';
  if (hour < 13) return 'Buenos días';
  if (hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
};

export const DashboardView = async ({
  userId,
  name,
}: {
  userId: string;
  name: string;
}) => {
  const [stats, inProgress, planning, recent] = await Promise.all([
    getLibraryStats(userId),
    getEntriesByStatus(userId, 'in_progress', 6),
    getEntriesByStatus(userId, 'planning', 7),
    getRecentEntries(userId, 5),
  ]);

  const displayName = name.split(/\s+/)[0] ?? name;

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent">
            {greeting()}, {displayName}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Tu estantería
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            {stats.total > 0
              ? `${stats.byStatus.in_progress} en curso · ${stats.byStatus.planning} en cola · ${stats.unitsRead} unidades de progreso`
              : 'Aún no hay nada por aquí. Empecemos con una serie.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/search"
            className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-void transition-colors hover:bg-[#87a1ff]"
          >
            <PlusIcon className="size-4" />
            Añadir serie
          </Link>
          <Link
            to="/import"
            className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-surface-raised px-4 text-sm text-ink transition-colors hover:border-[#323a52]"
          >
            <SparkIcon className="size-4" />
            Importar
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Biblioteca"
          value={stats.total}
          detail={`${stats.byType.manga} manga · ${stats.byType.anime} anime`}
          icon={<LibraryIcon className="size-4" />}
          tone="accent"
        />
        <StatCard
          label="En curso"
          value={stats.byStatus.in_progress}
          detail="Leyendo o viendo ahora"
          icon={<PlayIcon className="size-4" />}
          tone="mint"
        />
        <StatCard
          label="Completados"
          value={stats.byStatus.completed}
          detail={
            stats.meanScore != null
              ? `Nota media ${stats.meanScore.toFixed(1)}/10`
              : 'Sin puntuaciones aún'
          }
          icon={<CheckIcon className="size-4" />}
          tone="amber"
        />
        <StatCard
          label="Favoritos"
          value={stats.favorites}
          detail={`${stats.byStatus.planning} pendientes en la cola`}
          icon={<StarIcon className="size-4" filled />}
          tone="rose"
        />
      </div>

      {stats.total === 0 ? (
        <EmptyState
          icon={<BookIcon className="size-5" />}
          title="Tu biblioteca está esperando"
          description="Busca un manga o anime para añadirlo. Si vienes de Obsidian, puedes traer todo tu vault en un paso."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link
                to="/search"
                className="focus-ring inline-flex h-9 items-center rounded-lg bg-accent px-3 text-xs font-semibold text-void hover:bg-[#87a1ff]"
              >
                Buscar series
              </Link>
              <Link
                to="/import"
                className="focus-ring inline-flex h-9 items-center rounded-lg border border-line bg-surface-raised px-3 text-xs text-ink hover:border-[#323a52]"
              >
                Importar vault
              </Link>
            </div>
          }
        />
      ) : (
        <>
          <section className="space-y-4">
            <SectionHeader
              title="Continúa donde lo dejaste"
              subtitle="Lo que tienes abierto ahora mismo"
              action={
                <Link
                  to="/library?status=in_progress"
                  className="focus-ring inline-flex items-center gap-1 text-xs text-muted hover:text-ink"
                >
                  Ver todo <ChevronRightIcon className="size-3.5" />
                </Link>
              }
            />
            {inProgress.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
                {inProgress.map((item) => (
                  <SeriesCard key={item.entryId} item={item} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Nada en curso"
                description="Marca una serie como Leyendo o Viendo para verla aquí."
                className="py-8"
              />
            )}
          </section>

          <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
            <section className="space-y-3">
              <SectionHeader
                title="Actividad reciente"
                subtitle="Últimos cambios en tu lista"
              />
              <div className="panel divide-y divide-line/60">
                {recent.map((item) => (
                  <Link
                    key={item.entryId}
                    to={`/series/${item.seriesId}`}
                    className="focus-ring flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-raised/60"
                  >
                    <span
                      className={`size-2 shrink-0 rounded-full ${STATUS_META[item.status].dot}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-muted">
                        {item.type === 'anime' ? 'Anime' : 'Manga'} ·{' '}
                        {STATUS_META[item.status].label(item.type)}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted/80">
                      {formatDate(item.updatedAt)}
                    </span>
                  </Link>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <SectionHeader
                title="En la cola"
                subtitle="Pendientes por empezar"
                action={
                  <Link
                    to="/library?status=planning"
                    className="focus-ring inline-flex items-center gap-1 text-xs text-muted hover:text-ink"
                  >
                    Ver todo <ChevronRightIcon className="size-3.5" />
                  </Link>
                }
              />
              <div className="panel p-2">
                {planning.length > 0 ? (
                  planning.map((item) => (
                    <QueueRow key={item.entryId} item={item} />
                  ))
                ) : (
                  <p className="px-3 py-6 text-center text-xs text-muted">
                    La cola está vacía.
                  </p>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
};
