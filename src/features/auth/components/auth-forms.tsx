'use client';

import { type FormEvent, type ReactNode, useState } from 'react';
import { Link, useRouter } from 'waku';
import { Button } from '../../../components/ui/button';
import { SparkIcon } from '../../../components/ui/icons';
import { Field, Input } from '../../../components/ui/input';
import { authClient } from '../client';

const safeCallback = (raw: string | null): string => {
  if (typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//')) {
    return raw;
  }
  return '/';
};

const AuthLayout = ({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) => (
  <div className="grid min-h-svh lg:grid-cols-[1.05fr_1fr]">
    <div className="relative hidden flex-col justify-between overflow-hidden border-r border-line/60 p-12 lg:flex">
      <div className="pointer-events-none absolute -left-24 top-1/3 size-[420px] rounded-full bg-accent/20 blur-[120px]" />
      <div className="pointer-events-none absolute -right-16 bottom-0 size-[320px] rounded-full bg-[#8f6cff]/15 blur-[110px]" />

      <div className="relative flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-accent to-[#8f6cff] text-lg font-bold text-void">
          続
        </span>
        <span className="text-lg font-semibold tracking-tight">Tsuzuku</span>
      </div>

      <div className="relative max-w-md space-y-6">
        <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-white">
          Tu biblioteca de manga y anime,
          <span className="bg-gradient-to-r from-accent to-[#b49aff] bg-clip-text text-transparent">
            {' '}
            en un solo lugar.
          </span>
        </h1>
        <p className="text-sm leading-relaxed text-muted">
          Sigue capítulos, episodios y puntuaciones. Sin hojas de cálculo, sin
          notas sueltas: una vista que se siente como tuya.
        </p>
        <div className="flex flex-wrap gap-2 text-[11px] text-muted">
          {[
            'Progreso por capítulo',
            'Puntuaciones',
            'Importación desde Obsidian',
            'Tus amigos, cada uno con su lista',
          ].map((item) => (
            <span
              key={item}
              className="rounded-full border border-line bg-surface/60 px-2.5 py-1"
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      <p className="relative text-[11px] text-muted/60">
        Hecho para lectores que acumulan pendientes.
      </p>
    </div>

    <div className="flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5 lg:hidden">
          <span className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-accent to-[#8f6cff] text-sm font-bold text-void">
            続
          </span>
          <span className="text-base font-semibold tracking-tight">
            Tsuzuku
          </span>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            {title}
          </h2>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>

        <div className="mt-7">{children}</div>
        <div className="mt-6 text-center text-sm text-muted">{footer}</div>
      </div>
    </div>
  </div>
);

const ErrorBox = ({ message }: { message: string | null }) =>
  message ? (
    <p
      role="alert"
      className="rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 text-xs text-[#f7b0c4]"
    >
      {message}
    </p>
  ) : null;

const Spinner = () => (
  <span className="size-3.5 animate-spin rounded-full border-2 border-void/30 border-t-void" />
);

export const LoginForm = () => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const callback = safeCallback(
    new URLSearchParams(router.query).get('callbackUrl'),
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const { error: authError } = await authClient.signIn.email({
        email,
        password,
      });
      if (authError) {
        setError(
          authError.message?.includes('Invalid')
            ? 'Correo o contraseña incorrectos.'
            : (authError.message ?? 'No se pudo iniciar sesión.'),
        );
        return;
      }
      router.push(callback as never);
    } catch {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthLayout
      title="Bienvenido de vuelta"
      subtitle="Entra para continuar donde lo dejaste."
      footer={
        <>
          ¿No tienes cuenta?{' '}
          <Link
            to="/register"
            className="font-medium text-accent hover:underline"
          >
            Crear una
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <ErrorBox message={error} />
        <Field label="Correo" htmlFor="login-email">
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tu@correo.com"
          />
        </Field>
        <Field label="Contraseña" htmlFor="login-password">
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
          />
        </Field>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? <Spinner /> : <SparkIcon className="size-4" />}
          Entrar
        </Button>
      </form>
    </AuthLayout>
  );
};

export const RegisterForm = () => {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const { error: authError } = await authClient.signUp.email({
        name,
        email,
        password,
      });
      if (authError) {
        setError(
          authError.message?.includes('exists')
            ? 'Ya existe una cuenta con ese correo.'
            : (authError.message ?? 'No se pudo crear la cuenta.'),
        );
        return;
      }
      router.push('/');
    } catch {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthLayout
      title="Crea tu cuenta"
      subtitle="Tu lista, tus puntuaciones, tu ritmo."
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Iniciar sesión
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <ErrorBox message={error} />
        <Field label="Nombre" htmlFor="register-name">
          <Input
            id="register-name"
            autoComplete="name"
            required
            minLength={2}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Cómo te llamas"
          />
        </Field>
        <Field label="Correo" htmlFor="register-email">
          <Input
            id="register-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tu@correo.com"
          />
        </Field>
        <Field
          label="Contraseña"
          htmlFor="register-password"
          hint="Mínimo 8 caracteres."
        >
          <Input
            id="register-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
          />
        </Field>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? <Spinner /> : <SparkIcon className="size-4" />}
          Crear cuenta
        </Button>
      </form>
    </AuthLayout>
  );
};
