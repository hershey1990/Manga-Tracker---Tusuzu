import { UploadIcon } from '../components/ui/icons';
import { requireUserOrRedirect } from '../features/auth/session';
import { VaultUploader } from '../features/import/components/vault-uploader';
import { listImportJobs } from '../features/import/importer';
import { formatDate } from '../lib/text';

const STEPS = [
  {
    step: '01',
    title: 'Genera el JSON',
    body: 'Ejecuta npm run vault:export en tu máquina. El script lee las notas sin tocarlas.',
  },
  {
    step: '02',
    title: 'Súbelo y revisa',
    body: 'Verás cuántas son nuevas, duplicadas o ya están en tu lista antes de guardar nada.',
  },
  {
    step: '03',
    title: 'Aplica la importación',
    body: 'Se crean series y entradas con estado, capítulo, notas y enlace. Todo auditado.',
  },
];

export default async function ImportPage() {
  const user = await requireUserOrRedirect('/import');
  const jobs = await listImportJobs(user.id);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent">
          Migración
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Trae tu vault de Obsidian
        </h1>
        <p className="max-w-2xl text-sm text-muted">
          Tus notas son la fuente, no el destino. Esta importación convierte
          cada archivo Markdown en una serie con progreso y estado, y deja un
          registro de lo que pasó con cada fila.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((item) => (
          <div key={item.step} className="panel p-4">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-accent">
              {item.step}
            </p>
            <p className="mt-1 text-sm font-medium text-ink">{item.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {item.body}
            </p>
          </div>
        ))}
      </div>

      <VaultUploader />

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <UploadIcon className="size-4 text-muted" />
          <h2 className="text-sm font-semibold text-white">
            Historial de importaciones
          </h2>
        </div>

        {jobs.length === 0 ? (
          <p className="panel px-4 py-6 text-center text-xs text-muted">
            Aún no has importado nada.
          </p>
        ) : (
          <div className="panel overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line/70 text-[10px] uppercase tracking-[0.08em] text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Fecha</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                  <th className="px-4 py-2.5 font-medium">Total</th>
                  <th className="px-4 py-2.5 font-medium">Importadas</th>
                  <th className="px-4 py-2.5 font-medium">Omitidas</th>
                  <th className="px-4 py-2.5 font-medium">Fallidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/50">
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="px-4 py-2.5 text-muted">
                      {formatDate(job.createdAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={
                          job.status === 'applied'
                            ? 'text-mint'
                            : job.status === 'failed'
                              ? 'text-rose'
                              : 'text-amber'
                        }
                      >
                        {job.status === 'applied'
                          ? 'Aplicada'
                          : job.status === 'failed'
                            ? 'Fallida'
                            : 'Vista previa'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-ink">{job.total}</td>
                    <td className="px-4 py-2.5 text-ink">{job.imported}</td>
                    <td className="px-4 py-2.5 text-muted">{job.skipped}</td>
                    <td className="px-4 py-2.5 text-muted">{job.failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export const getConfig = async () => {
  return { render: 'dynamic' } as const;
};
