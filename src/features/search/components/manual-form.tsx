'use client';

import { type FormEvent, useState, useTransition } from 'react';
import { useRouter } from 'waku';
import { Button } from '../../../components/ui/button';
import { Field, Input, Select, Textarea } from '../../../components/ui/input';
import { createManualSeries } from '../../series/actions';
import type { ManualSeriesInput } from '../../series/schema';

export const ManualSeriesForm = ({ title }: { title: string }) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    type: 'manga',
    title,
    titleRomaji: '',
    titleNative: '',
    coverImage: '',
    year: '',
    totalUnits: '',
    sourceUrl: '',
    description: '',
  });

  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const payload: ManualSeriesInput = {
      type: form.type as ManualSeriesInput['type'],
      title: form.title.trim(),
      ...(form.titleRomaji.trim()
        ? { titleRomaji: form.titleRomaji.trim() }
        : {}),
      ...(form.titleNative.trim()
        ? { titleNative: form.titleNative.trim() }
        : {}),
      ...(form.coverImage.trim() ? { coverImage: form.coverImage.trim() } : {}),
      ...(form.year ? { year: Number(form.year) } : {}),
      ...(form.totalUnits ? { totalUnits: Number(form.totalUnits) } : {}),
      ...(form.sourceUrl.trim() ? { sourceUrl: form.sourceUrl.trim() } : {}),
      ...(form.description.trim()
        ? { description: form.description.trim() }
        : {}),
    };

    startTransition(async () => {
      try {
        const result = await createManualSeries(payload);
        router.push(`/series/${result.seriesId}`);
      } catch {
        setError(
          'No se pudo crear la serie. Revisa el título y los campos numéricos.',
        );
      }
    });
  };

  return (
    <section className="panel">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="focus-ring flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left"
      >
        <div>
          <p className="text-sm font-medium text-ink">
            Crear serie manualmente
          </p>
          <p className="text-xs text-muted">
            Para lo que no está en AniList o no quieres enlazar.
          </p>
        </div>
        <span className="text-xs text-muted">{open ? 'Cerrar' : 'Abrir'}</span>
      </button>

      {open ? (
        <form
          onSubmit={submit}
          className="grid gap-4 border-t border-line/70 p-4 sm:grid-cols-2"
        >
          <Field label="Tipo" htmlFor="manual-type">
            <Select
              id="manual-type"
              value={form.type}
              onChange={(event) => set('type', event.target.value)}
            >
              <option value="manga">Manga</option>
              <option value="anime">Anime</option>
            </Select>
          </Field>

          <Field label="Título" htmlFor="manual-title">
            <Input
              id="manual-title"
              required
              value={form.title}
              onChange={(event) => set('title', event.target.value)}
              placeholder="Título principal"
            />
          </Field>

          <Field label="Título romaji" htmlFor="manual-romaji">
            <Input
              id="manual-romaji"
              value={form.titleRomaji}
              onChange={(event) => set('titleRomaji', event.target.value)}
              placeholder="Opcional"
            />
          </Field>

          <Field label="Título original" htmlFor="manual-native">
            <Input
              id="manual-native"
              value={form.titleNative}
              onChange={(event) => set('titleNative', event.target.value)}
              placeholder="Opcional"
            />
          </Field>

          <Field label="Año" htmlFor="manual-year">
            <Input
              id="manual-year"
              type="number"
              min={1900}
              max={2100}
              value={form.year}
              onChange={(event) => set('year', event.target.value)}
              placeholder="2024"
            />
          </Field>

          <Field label="Total de capítulos / episodios" htmlFor="manual-total">
            <Input
              id="manual-total"
              type="number"
              min={0}
              value={form.totalUnits}
              onChange={(event) => set('totalUnits', event.target.value)}
              placeholder="Opcional"
            />
          </Field>

          <Field label="Portada (URL)" htmlFor="manual-cover">
            <Input
              id="manual-cover"
              type="url"
              value={form.coverImage}
              onChange={(event) => set('coverImage', event.target.value)}
              placeholder="https://…"
            />
          </Field>

          <Field label="Enlace" htmlFor="manual-url">
            <Input
              id="manual-url"
              type="url"
              value={form.sourceUrl}
              onChange={(event) => set('sourceUrl', event.target.value)}
              placeholder="https://…"
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Sinopsis" htmlFor="manual-description">
              <Textarea
                id="manual-description"
                rows={3}
                value={form.description}
                onChange={(event) => set('description', event.target.value)}
                placeholder="Opcional"
              />
            </Field>
          </div>

          {error ? (
            <p className="text-xs text-rose sm:col-span-2">{error}</p>
          ) : null}

          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending || !form.title.trim()}>
              {pending ? 'Creando…' : 'Crear y añadir'}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
};
