import { getSessionForHeaders } from '../../../features/auth/guard';
import { listEntriesForExport } from '../../../features/library/queries';
import { toCsv, toJsonExport } from '../../../features/settings/export';

export async function GET(request: Request) {
  const session = await getSessionForHeaders(request.headers);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get('format') === 'csv' ? 'csv' : 'json';
  const items = await listEntriesForExport(session.user.id);

  if (format === 'csv') {
    return new Response(`\uFEFF${toCsv(items)}`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="tsuzuku-export.csv"',
        'Cache-Control': 'no-store',
      },
    });
  }

  return Response.json(toJsonExport(items), {
    headers: {
      'Content-Disposition': 'attachment; filename="tsuzuku-export.json"',
      'Cache-Control': 'no-store',
    },
  });
}
