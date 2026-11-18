import { requireUserOrRedirect } from '../features/auth/session';
import { DashboardView } from '../features/dashboard/dashboard-view';

export default async function HomePage() {
  const user = await requireUserOrRedirect('/');

  return (
    <>
      <title>Tu estantería · Tsuzuku</title>
      <DashboardView userId={user.id} name={user.name ?? user.email} />
    </>
  );
}

export const getConfig = async () => {
  return { render: 'dynamic' } as const;
};
