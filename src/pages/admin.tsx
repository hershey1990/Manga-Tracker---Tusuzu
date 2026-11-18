import { requestNotFound } from 'waku/router/server';
import {
  DatabaseIcon,
  ImageIcon,
  LibraryIcon,
  ShieldIcon,
  UsersIcon,
} from '../components/ui/icons';
import { StatCard } from '../components/ui/stat-card';
import { DuplicateManager } from '../features/admin/components/duplicate-manager';
import { MetadataTools } from '../features/admin/components/metadata-tools';
import { UserManagement } from '../features/admin/components/user-management';
import {
  findDuplicateGroups,
  getAdminStats,
  isAdmin,
  listAdminUsers,
} from '../features/admin/service';
import { requireUserOrRedirect } from '../features/auth/session';
import { STATUS_META } from '../features/series/schema';

export default async function AdminPage() {
  const user = await requireUserOrRedirect('/admin');

  if (!(await isAdmin(user.id))) {
    requestNotFound();
    return null;
  }

  const [stats, users, duplicates] = await Promise.all([
    getAdminStats(),
    listAdminUsers(user.id),
    findDuplicateGroups(),
  ]);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.1em] text-accent">
          <ShieldIcon className="size-3.5" />
          Administración
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Control de la instancia
        </h1>
        <p className="max-w-2xl text-sm text-muted">
          Eres el primer usuario registrado. Desde aquí puedes gestionar
          cuentas, limpiar duplicados y completar metadatos. Las acciones
          destructivas piden confirmación.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Usuarios"
          value={stats.users}
          detail={`${stats.disabledUsers} ${stats.disabledUsers === 1 ? 'desactivado' : 'desactivados'} · ${stats.activeSessions} sesiones activas`}
          icon={<UsersIcon className="size-4" />}
          tone="accent"
        />
        <StatCard
          label="Series"
          value={stats.series}
          detail={`${stats.unlinked} sin proveedor · ${stats.missingCovers} sin portada`}
          icon={<LibraryIcon className="size-4" />}
          tone="mint"
        />
        <StatCard
          label="Entradas"
          value={stats.entries}
          detail={`${stats.favorites} favoritos · ${stats.units} unidades`}
          icon={<DatabaseIcon className="size-4" />}
          tone="amber"
        />
        <StatCard
          label="Importaciones"
          value={stats.imports}
          detail={Object.entries(stats.byStatus)
            .filter(([, value]) => value > 0)
            .map(
              ([status, value]) =>
                `${value} ${STATUS_META[status as keyof typeof STATUS_META].short.toLowerCase()}`,
            )
            .join(' · ')}
          icon={<ImageIcon className="size-4" />}
          tone="rose"
        />
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-white">
            Usuarios
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Desactiva cuentas, cierra sus sesiones o elimínalas definitivamente.
          </p>
        </div>
        <UserManagement
          users={users.map((row) => ({
            ...row,
            createdAt: row.createdAt.toISOString(),
          }))}
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-white">
            Duplicados
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Series con el mismo título normalizado. Elige la que conservará los
            metadatos; las entradas de las demás se mueven o combinan.
          </p>
        </div>
        <DuplicateManager groups={duplicates} />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-white">
            Metadatos
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Completar portadas y sinopsis desde AniList.
          </p>
        </div>
        <MetadataTools
          missingCovers={stats.missingCovers}
          unlinked={stats.unlinked}
        />
      </section>
    </div>
  );
}

export const getConfig = async () => {
  return { render: 'dynamic' } as const;
};
