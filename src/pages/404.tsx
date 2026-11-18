import { Link } from 'waku';

export default function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-4 py-24 text-center">
      <p className="text-6xl font-bold tracking-tight text-line">404</p>
      <h1 className="text-xl font-semibold text-white">
        Esta página no existe
      </h1>
      <p className="text-sm text-muted">
        Puede que la serie se haya eliminado o que el enlace esté mal.
      </p>
      <div className="flex gap-2">
        <Link
          to="/"
          className="focus-ring inline-flex h-9 items-center rounded-lg bg-accent px-4 text-xs font-semibold text-void hover:bg-[#87a1ff]"
        >
          Ir al panel
        </Link>
        <Link
          to="/library"
          className="focus-ring inline-flex h-9 items-center rounded-lg border border-line bg-surface-raised px-4 text-xs text-ink hover:border-[#323a52]"
        >
          Ver biblioteca
        </Link>
      </div>
    </div>
  );
}

export const getConfig = async () => {
  return { render: 'static' } as const;
};
