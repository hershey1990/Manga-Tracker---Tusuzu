'use server';

import { requestRefresh } from 'waku/router/server';
import { requireUser } from '../auth/session';
import {
  deleteUserAccount,
  enrichUnlinkedSeries,
  mergeSeriesGroup,
  refreshSeriesMetadata,
  revokeUserSessions,
  setUserDisabled,
} from './service';

const actorId = async () => (await requireUser()).id;

export const adminSetUserDisabled = async (
  targetId: string,
  disabled: boolean,
) => {
  const result = await setUserDisabled(await actorId(), targetId, disabled);
  requestRefresh();
  return result;
};

export const adminRevokeSessions = async (targetId: string) => {
  await revokeUserSessions(await actorId(), targetId);
  requestRefresh();
  return { ok: true };
};

export const adminDeleteUser = async (targetId: string) => {
  await deleteUserAccount(await actorId(), targetId);
  requestRefresh();
  return { ok: true };
};

export const adminMergeSeries = async (
  targetId: string,
  sourceIds: string[],
) => {
  const result = await mergeSeriesGroup(await actorId(), targetId, sourceIds);
  requestRefresh();
  return result;
};

export const adminRefreshMetadata = async (limit = 20) => {
  const result = await refreshSeriesMetadata(await actorId(), limit);
  requestRefresh();
  return result;
};

export const adminEnrichUnlinked = async (limit = 20) => {
  const result = await enrichUnlinkedSeries(await actorId(), limit);
  requestRefresh();
  return result;
};
