'use server';

import { requireUser } from '../auth/session';
import { enrichUnlinkedBatch } from './enrichment';

/**
 * Any signed-in user can complete metadata for series they have in their own
 * library. The result is shared, but the scope is limited to their entries.
 */
export const enrichMyLibraryBatch = async (limit = 20, cursor?: string) => {
  const user = await requireUser();
  return enrichUnlinkedBatch({ userId: user.id, limit, cursor });
};
