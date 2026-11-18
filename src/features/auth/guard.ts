import { eq } from 'drizzle-orm';
import { db } from '../../lib/db/client';
import { user } from '../../lib/db/schema';
import { getAuth } from './server';

/**
 * Reads a session from headers and rejects it when the account is disabled.
 * Middleware and API routes must use this instead of auth.api.getSession.
 */
export const getSessionForHeaders = async (headers: Headers) => {
  const session = await getAuth().api.getSession({ headers });
  if (!session) return null;

  const [row] = await db
    .select({ disabled: user.disabled })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  if (!row || row.disabled) {
    return null;
  }
  return session;
};
