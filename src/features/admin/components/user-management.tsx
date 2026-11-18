'use client';

import { useState, useTransition } from 'react';
import { Button } from '../../../components/ui/button';
import { useFlash } from '../../../lib/flash';
import {
  adminDeleteUser,
  adminRevokeSessions,
  adminSetUserDisabled,
} from '../actions';

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  disabled: boolean;
  entries: number;
  sessions: number;
  isCurrent: boolean;
  isAdmin: boolean;
};

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(iso));

export const UserManagement = ({ users }: { users: AdminUserRow[] }) => {
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useFlash('admin:users');
  const [error, setError] = useState<string | null>(null);

  const run = (
    id: string,
    action: () => Promise<unknown>,
    successMessage: string,
    confirmText?: string,
  ) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setMessage(null);
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      try {
        await action();
        setMessage(successMessage);
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : 'No se pudo completar.',
        );
      } finally {
        setBusyId(null);
      }
    });
  };

  return (
    <div className="space-y-3">
      {message ? <p className="text-xs text-mint">{message}</p> : null}
      {error ? <p className="text-xs text-rose">{error}</p> : null}

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead className="border-b border-line/70 text-[10px] uppercase tracking-[0.08em] text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Alta</th>
                <th className="px-4 py-3 font-medium">Series</th>
                <th className="px-4 py-3 font-medium">Sesiones</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/50">
              {users.map((row) => (
                <tr key={row.id} className="hover:bg-surface-raised/40">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">
                      {row.name}
                      {row.isAdmin ? (
                        <span className="ml-2 rounded-full border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-accent">
                          admin
                        </span>
                      ) : null}
                      {row.isCurrent ? (
                        <span className="ml-1 text-[10px] text-muted">
                          (tú)
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-muted">{row.email}</p>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {formatDate(row.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-ink">{row.entries}</td>
                  <td className="px-4 py-3 text-muted">{row.sessions}</td>
                  <td className="px-4 py-3">
                    <span className={row.disabled ? 'text-rose' : 'text-mint'}>
                      {row.disabled ? 'Desactivada' : 'Activa'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={pending || row.isCurrent || busyId === row.id}
                        onClick={() =>
                          run(
                            row.id,
                            () => adminSetUserDisabled(row.id, !row.disabled),
                            row.disabled
                              ? 'Cuenta reactivada.'
                              : 'Cuenta desactivada. Sus sesiones se cerraron.',
                          )
                        }
                      >
                        {row.disabled ? 'Activar' : 'Desactivar'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending || busyId === row.id}
                        onClick={() =>
                          run(
                            row.id,
                            () => adminRevokeSessions(row.id),
                            'Sesiones cerradas.',
                          )
                        }
                      >
                        Cerrar sesiones
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={pending || row.isCurrent || busyId === row.id}
                        onClick={() =>
                          run(
                            row.id,
                            () => adminDeleteUser(row.id),
                            'Cuenta eliminada.',
                            `¿Eliminar la cuenta ${row.email} y todos sus datos? Esta acción no se puede deshacer.`,
                          )
                        }
                      >
                        Eliminar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[11px] text-muted">
        Desactivar una cuenta cierra sus sesiones y bloquea nuevos inicios de
        sesión. Eliminar borra en cascada su biblioteca, sesiones y cuentas
        vinculadas.
      </p>
    </div>
  );
};
