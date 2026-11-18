'use client';

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Link, useRouter } from 'waku';
import { authClient } from '../features/auth/client';
import { cn } from '../lib/cn';
import { Avatar } from './ui/cover';
import {
  HomeIcon,
  LibraryIcon,
  LogOutIcon,
  SearchIcon,
  SettingsIcon,
  ShieldIcon,
  UploadIcon,
} from './ui/icons';

const NAV = [
  { href: '/', label: 'Panel', icon: HomeIcon },
  { href: '/library', label: 'Biblioteca', icon: LibraryIcon },
  { href: '/search', label: 'Buscar', icon: SearchIcon },
  { href: '/import', label: 'Importar', icon: UploadIcon },
  { href: '/settings', label: 'Ajustes', icon: SettingsIcon },
] as const;

const ADMIN_NAV = { href: '/admin', label: 'Admin', icon: ShieldIcon } as const;

const Brand = () => (
  <Link to="/" className="focus-ring flex items-center gap-2.5 rounded-lg">
    <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-accent to-[#8f6cff] text-sm font-bold text-void shadow-[0_0_28px_-6px_rgba(108,140,255,0.8)]">
      続
    </span>
    <span className="text-[15px] font-semibold tracking-tight text-ink">
      Tsuzuku
    </span>
  </Link>
);

export const AppShell = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [term, setTerm] = useState('');
  const [isAdminUser, setIsAdminUser] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!session?.user) {
      setIsAdminUser(false);
      return;
    }
    let cancelled = false;
    void fetch('/api/admin/status')
      .then((response) => (response.ok ? response.json() : { admin: false }))
      .then((data: { admin?: boolean }) => {
        if (!cancelled) setIsAdminUser(Boolean(data.admin));
      })
      .catch(() => {
        if (!cancelled) setIsAdminUser(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user]);

  const nav = isAdminUser ? ([...NAV, ADMIN_NAV] as const) : NAV;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const isActive = (href: string) =>
    href === '/' ? router.path === '/' : router.path.startsWith(href);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const query = term.trim();
    if (query) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
    }
  };

  const signOut = async () => {
    await authClient.signOut();
    router.push('/login');
  };

  const isAuthRoute = router.path === '/login' || router.path === '/register';

  if (isAuthRoute) {
    return <div className="min-h-svh">{children}</div>;
  }

  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[236px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-svh flex-col border-r border-line/70 bg-surface/40 px-4 py-6 backdrop-blur-xl lg:flex">
        <Brand />

        <nav className="mt-9 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'focus-ring flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-accent/10 font-medium text-white'
                    : 'text-muted hover:bg-surface-raised hover:text-ink',
                )}
              >
                <Icon className={cn('size-[18px]', active && 'text-accent')} />
                {item.label}
                {active ? (
                  <span className="ml-auto size-1.5 rounded-full bg-accent" />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3">
          <div className="rounded-xl border border-line/80 bg-surface-raised/60 p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
              Atajo
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted/90">
              Pulsa{' '}
              <kbd className="rounded border border-line bg-surface px-1 text-[10px] text-ink">
                /
              </kbd>{' '}
              para buscar.
            </p>
          </div>

          <div className="flex items-center gap-2.5 rounded-xl border border-line/70 bg-surface-raised/50 p-2.5">
            {isPending ? (
              <div className="h-8 flex-1 animate-pulse rounded bg-line" />
            ) : session ? (
              <>
                <Avatar
                  name={session.user.name ?? session.user.email}
                  src={session.user.image}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-ink">
                    {session.user.name ?? 'Sin nombre'}
                  </p>
                  <p className="truncate text-[11px] text-muted">
                    {session.user.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={signOut}
                  className="focus-ring rounded-md p-1.5 text-muted transition-colors hover:bg-surface-hover hover:text-ink"
                  aria-label="Cerrar sesión"
                  title="Cerrar sesión"
                >
                  <LogOutIcon />
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="focus-ring flex-1 rounded-md px-2 py-1 text-xs text-muted hover:text-ink"
              >
                Iniciar sesión
              </Link>
            )}
          </div>
        </div>
      </aside>

      <div className="flex min-h-svh flex-col">
        <header className="sticky top-0 z-20 border-b border-line/60 bg-void/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-3 px-4 lg:px-8">
            <div className="lg:hidden">
              <Brand />
            </div>

            <form
              onSubmit={submitSearch}
              className="relative ml-auto hidden w-full max-w-sm sm:block lg:ml-0"
            >
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                ref={searchRef}
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Buscar en tu biblioteca…"
                className="focus-ring h-9 w-full rounded-lg border border-line bg-surface/80 pl-9 pr-3 text-sm text-ink placeholder:text-muted/60 transition-colors hover:border-[#2f364a] focus:border-accent/60"
                aria-label="Buscar en tu biblioteca"
              />
            </form>

            <div className="ml-auto flex items-center gap-2">
              <Link
                to="/search"
                className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-surface-raised px-3 text-xs font-medium text-ink transition-colors hover:border-[#323a52]"
              >
                <SearchIcon className="size-4" />
                <span className="hidden sm:inline">Descubrir</span>
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-24 pt-6 sm:pb-10 lg:px-8 lg:pt-8">
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <div
          className={cn(
            'grid',
            nav.length === 6 ? 'grid-cols-6' : 'grid-cols-5',
          )}
        >
          {nav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'focus-ring flex flex-col items-center gap-1 py-2.5 text-[10px] transition-colors',
                  active ? 'text-accent' : 'text-muted hover:text-ink',
                )}
              >
                <Icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
