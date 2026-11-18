import { isAdmin } from '../../../../features/admin/service';
import { getSessionForHeaders } from '../../../../features/auth/guard';

export async function GET(request: Request) {
  const session = await getSessionForHeaders(request.headers);
  const admin = session ? await isAdmin(session.user.id) : false;
  return Response.json({ admin }, { headers: { 'Cache-Control': 'no-store' } });
}
