import { getRequest, requestRedirect } from 'waku/router/server';
import { getSessionForHeaders } from './guard';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null | undefined;
};

export const getSession = async () => {
  return getSessionForHeaders(getRequest().headers);
};

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
  }
}

/**
 * Authorization lives in the data layer: every query and mutation that touches
 * personal data calls this instead of relying on layouts or middleware.
 */
export const requireUser = async (): Promise<SessionUser> => {
  const session = await getSession();
  if (!session) {
    throw new UnauthorizedError();
  }
  return session.user;
};

export const requireUserOrRedirect = async (
  callbackUrl: string,
): Promise<SessionUser> => {
  const session = await getSession();
  if (!session) {
    requestRedirect(
      `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` as never,
    );
    throw new UnauthorizedError();
  }
  return session.user;
};
