import { RegisterForm } from '../features/auth/components/auth-forms';

export default function RegisterPage() {
  return (
    <>
      <title>Crear cuenta · Tsuzuku</title>
      <RegisterForm />
    </>
  );
}

export const getConfig = async () => {
  return { render: 'static' } as const;
};
