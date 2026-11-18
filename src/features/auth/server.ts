import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { eq } from 'drizzle-orm';
import { db } from '../../lib/db/client';
import { account, session, user, verification } from '../../lib/db/schema';

const createAuth = () => {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'BETTER_AUTH_SECRET must be set to at least 32 random characters.',
    );
  }

  const baseURL = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';
  // Vite may pick another port when 3000 is busy; only relax origins in dev.
  const trustedOrigins =
    process.env.NODE_ENV === 'production'
      ? [baseURL]
      : [
          baseURL,
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:3002',
        ];

  return betterAuth({
    secret,
    baseURL,
    trustedOrigins,
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      autoSignIn: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    databaseHooks: {
      session: {
        create: {
          before: async (newSession) => {
            const [row] = await db
              .select({ disabled: user.disabled })
              .from(user)
              .where(eq(user.id, newSession.userId))
              .limit(1);
            if (row?.disabled) {
              throw new APIError('FORBIDDEN', {
                message: 'Esta cuenta está desactivada.',
              });
            }
            return { data: newSession };
          },
        },
      },
    },
  });
};

let instance: ReturnType<typeof createAuth> | undefined;

export const getAuth = () => {
  instance ??= createAuth();
  return instance;
};

export type Auth = ReturnType<typeof getAuth>;
