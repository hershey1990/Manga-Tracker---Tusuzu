import { LoginForm } from '../features/auth/components/auth-forms';

export default function LoginPage() {
  return (
    <>
      <title>Entrar · Tsuzuku</title>
      <LoginForm />
    </>
  );
}

export const getConfig = async () => {
  return { render: 'static' } as const;
};
