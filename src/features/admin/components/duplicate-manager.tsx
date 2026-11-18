'use client';

import { useState, useTransition } from 'react';
import { Button } from '../../../components/ui/button';
import { Cover } from '../../../components/ui/cover';
import { useFlash } from '../../../lib/flash';
import { adminMergeSeries } from '../actions';
import type { DuplicateGroup } from '../service';

export const DuplicateManager = ({ groups }: { groups: DuplicateGroup[] }) => {
  const [targets, setTargets] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      groups.map((group) => [
        group.key,
        [...group.items].sort(
          (a, b) =>
            Number(Boolean(b.provider)) - Number(Boolean(a.provider)) ||
            b.entries - a.entries,
        )[0]?.id ?? group.items[0]!.id,
      ]),
    ),
  );
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useFlash('admin:duplicates');
  const [error, setError] = useState<string | null>(null);

  if (groups.length === 0) {
    return (
      <p className="panel px-4 py-8 text-center text-xs text-muted">
        No hay series duplicadas por título. Buena señal.
      </p>
    );
  }

  const merge = (group: DuplicateGroup) => {
    const targetId = targets[group.key];
    if (!targetId) return;
    const sources = group.items
      .filter((item) => item.id !== targetId)
      .map((item) => item.id);

    if (
      !window.confirm(
        `Se fusionarán ${sources.length} series en la seleccionada. Las entradas de los usuarios se combinarán. ¿Continuar?`,
      )
    ) {
      return;
    }

    setMessage(null);
    setError(null);
    setBusyKey(group.key);
    startTransition(async () => {
      try {
        const result = await adminMergeSeries(targetId, sources);
        setMessage(
          `Fusionadas ${result.mergedSources} series · ${result.movedEntries} entradas movidas · ${result.mergedEntries} combinadas.`,
        );
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : 'No se pudo fusionar.',
        );
      } finally {
        setBusyKey(null);
      }
    });
  };

  return (
    <div className="space-y-3">
      {message ? <p className="text-xs text-mint">{message}</p> : null}
      {error ? <p className="text-xs text-rose">{error}</p> : null}

      {groups.map((group) => (
        <div key={group.key} className="panel space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-ink">{group.title}</p>
              <p className="text-[11px] text-muted">
                {group.type === 'anime' ? 'Anime' : 'Manga'} ·{' '}
                {group.items.length} series
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => merge(group)}
              disabled={pending && busyKey === group.key}
            >
              {pending && busyKey === group.key
                ? 'Fusionando…'
                : 'Fusionar en la seleccionada'}
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {group.items.map((item) => {
              const selected = targets[group.key] === item.id;
              return (
                <label
                  key={item.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 transition-colors ${
                    selected
                      ? 'border-accent/40 bg-accent/5'
                      : 'border-line bg-surface hover:border-[#323a52]'
                  }`}
                >
                  <input
                    type="radio"
                    name={group.key}
                    checked={selected}
                    onChange={() =>
                      setTargets((current) => ({
                        ...current,
                        [group.key]: item.id,
                      }))
                    }
                    className="accent-[var(--color-accent)]"
                  />
                  <div className="w-8 shrink-0">
                    <Cover
                      src={item.coverImage}
                      title={item.title}
                      type={group.type}
                      sizes="40px"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-ink">
                      {item.title}
                    </p>
                    <p className="text-[10px] text-muted">
                      {item.year ?? '—'} · {item.entries}{' '}
                      {item.entries === 1 ? 'entrada' : 'entradas'}
                      {item.provider ? ` · ${item.provider}` : ' · manual'}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
