'use client';

import { type FormEvent, useState } from 'react';
import { useRouter } from 'waku';
import { Button } from '../../../components/ui/button';
import { SearchIcon } from '../../../components/ui/icons';
import { Input } from '../../../components/ui/input';
import { cn } from '../../../lib/cn';

const TYPES = [
  { value: 'all', label: 'Todo' },
  { value: 'manga', label: 'Manga' },
  { value: 'anime', label: 'Anime' },
] as const;

export const SearchForm = ({
  initialQuery,
  initialType,
}: {
  initialQuery: string;
  initialType: 'all' | 'manga' | 'anime';
}) => {
  const router = useRouter();
  const [term, setTerm] = useState(initialQuery);
  const [type, setType] = useState(initialType);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const query = term.trim();
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (type !== 'all') params.set('type', type);
    router.push(
      (params.toString()
        ? `/search?${params}`
        : '/search') as `/search?${string}`,
    );
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Título, romaji o nombre original…"
            className="h-11 pl-10 text-base"
            autoFocus
            aria-label="Buscar series"
          />
        </div>
        <Button type="submit" className="h-11 px-6">
          Buscar
        </Button>
      </div>

      <div className="flex items-center gap-1.5">
        {TYPES.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setType(option.value)}
            className={cn(
              'focus-ring rounded-full border px-3 py-1 text-xs transition-colors',
              type === option.value
                ? 'border-accent/40 bg-accent/10 text-[#b9c8ff]'
                : 'border-line bg-surface text-muted hover:text-ink',
            )}
          >
            {option.label}
          </button>
        ))}
        <span className="ml-2 hidden text-[11px] text-muted/70 sm:inline">
          Busca en tu biblioteca y en AniList.
        </span>
      </div>
    </form>
  );
};
