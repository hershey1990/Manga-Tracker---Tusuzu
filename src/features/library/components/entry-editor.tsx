'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'waku';
import { Button } from '../../../components/ui/button';
import { StarIcon } from '../../../components/ui/icons';
import { Field, Input, Select, Textarea } from '../../../components/ui/input';
import { cn } from '../../../lib/cn';
import {
  type LibraryStatus,
  libraryStatusSchema,
  STATUS_META,
} from '../../series/schema';
import { addToLibrary, removeEntry, updateEntry } from '../actions';
import type { LibraryItem } from '../queries';

export const AddToLibraryButton = ({ seriesId }: { seriesId: string }) => {
  const [status, setStatus] = useState<LibraryStatus>('planning');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    setError(null);
    startTransition(async () => {
      try {
        await addToLibrary(seriesId, status);
      } catch {
        setError('No se pudo añadir. Inténtalo de nuevo.');
      }
    });
  };

  return (
    <div className="panel space-y-3 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted">
        Añadir a tu biblioteca
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value as LibraryStatus)}
          aria-label="Estado inicial"
        >
          {libraryStatusSchema.options.map((option) => (
            <option key={option} value={option}>
              {STATUS_META[option].short}
            </option>
          ))}
        </Select>
        <Button onClick={add} disabled={pending} className="sm:w-auto">
          {pending ? 'Añadiendo…' : 'Añadir a la biblioteca'}
        </Button>
      </div>
      {error ? <p className="text-xs text-rose">{error}</p> : null}
    </div>
  );
};

export const EntryEditor = ({
  entry,
  unit,
}: {
  entry: LibraryItem;
  unit: string;
}) => {
  const router = useRouter();
  const [status, setStatus] = useState<LibraryStatus>(entry.status);
  const [progress, setProgress] = useState(entry.progress);
  const [total, setTotal] = useState(entry.totalUnits?.toString() ?? '');
  const [score, setScore] = useState(entry.score?.toString() ?? '');
  const [notes, setNotes] = useState(entry.notes ?? '');
  const [favorite, setFavorite] = useState(entry.isFavorite);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    status !== entry.status ||
    progress !== entry.progress ||
    (total || '') !== (entry.totalUnits?.toString() ?? '') ||
    (score || '') !== (entry.score?.toString() ?? '') ||
    notes !== (entry.notes ?? '') ||
    favorite !== entry.isFavorite;

  const save = () => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await updateEntry({
          entryId: entry.entryId,
          status,
          progress,
          totalUnits: total === '' ? null : Number(total),
          score: score === '' ? null : Number(score),
          notes: notes.trim() === '' ? null : notes,
          isFavorite: favorite,
        });
        setMessage('Guardado');
      } catch {
        setError('No se pudo guardar.');
      }
    });
  };

  const remove = () => {
    if (
      !window.confirm(
        '¿Quitar esta serie de tu biblioteca? La serie seguirá existiendo para otros usuarios.',
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await removeEntry(entry.entryId);
        router.push('/library');
      } catch {
        setError('No se pudo quitar la serie.');
      }
    });
  };

  const step = (delta: number) => {
    setProgress((current) => Math.max(0, current + delta));
    setMessage(null);
  };

  return (
    <div className="panel space-y-5 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted">
          Tu progreso
        </p>
        <button
          type="button"
          onClick={() => setFavorite((value) => !value)}
          className={cn(
            'focus-ring inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
            favorite
              ? 'border-amber/40 bg-amber/10 text-amber'
              : 'border-line bg-surface text-muted hover:text-ink',
          )}
        >
          <StarIcon className="size-3.5" filled={favorite} />
          {favorite ? 'Favorito' : 'Marcar favorito'}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Estado" htmlFor="entry-status">
          <Select
            id="entry-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as LibraryStatus)}
          >
            {libraryStatusSchema.options.map((option) => (
              <option key={option} value={option}>
                {STATUS_META[option].label(entry.type)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Nota" htmlFor="entry-score">
          <Select
            id="entry-score"
            value={score}
            onChange={(event) => setScore(event.target.value)}
          >
            <option value="">Sin nota</option>
            {Array.from({ length: 11 }, (_, index) => 10 - index).map(
              (value) => (
                <option key={value} value={value}>
                  {value} / 10
                </option>
              ),
            )}
          </Select>
        </Field>

        <Field label={`Progreso (${unit})`} htmlFor="entry-progress">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              onClick={() => step(-1)}
              disabled={progress === 0}
              aria-label={`Restar un ${unit.slice(0, -1)}`}
            >
              −
            </Button>
            <Input
              id="entry-progress"
              type="number"
              min={0}
              value={progress}
              onChange={(event) =>
                setProgress(Math.max(0, Number(event.target.value) || 0))
              }
              className="text-center"
            />
            <Button
              variant="secondary"
              size="icon"
              onClick={() => step(1)}
              aria-label={`Sumar un ${unit.slice(0, -1)}`}
            >
              +
            </Button>
          </div>
        </Field>

        <Field
          label={`Total de ${unit}`}
          htmlFor="entry-total"
          hint="Opcional. Sobrescribe el total conocido."
        >
          <Input
            id="entry-total"
            type="number"
            min={0}
            value={total}
            onChange={(event) => setTotal(event.target.value)}
            placeholder="Sin límite"
          />
        </Field>
      </div>

      <Field label="Notas" htmlFor="entry-notes">
        <Textarea
          id="entry-notes"
          rows={4}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Dónde lo lees, qué capítulo te marcó, a quién se lo recomendarías…"
          maxLength={5000}
        />
      </Field>

      {error ? <p className="text-xs text-rose">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-line/70 pt-4">
        <Button onClick={save} disabled={!dirty || pending}>
          {pending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
        <span
          className={cn(
            'text-xs',
            message ? 'text-mint' : dirty ? 'text-amber' : 'text-muted',
          )}
        >
          {message ?? (dirty ? 'Cambios sin guardar' : 'Todo guardado')}
        </span>
        <Button
          variant="danger"
          size="sm"
          className="ml-auto"
          onClick={remove}
          disabled={pending}
        >
          Quitar de la biblioteca
        </Button>
      </div>
    </div>
  );
};
