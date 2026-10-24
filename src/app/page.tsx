import AppShell from '@/components/AppShell';
import { requireUser } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await requireUser('/');
  return <AppShell user={user} />;
}
