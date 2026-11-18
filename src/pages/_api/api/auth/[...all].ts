import { getAuth } from '../../../../features/auth/server';

const handler = (request: Request) => getAuth().handler(request);

export const GET = handler;
export const POST = handler;
