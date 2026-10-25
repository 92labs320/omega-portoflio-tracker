const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

/** Public pages are served by the same Vercel project as the API (backend/public). */
const site = apiUrl || 'https://omega-portoflio-tracker-backend.vercel.app';

export const Config = {
  /** Omega API (Vercel + Neon). Empty string = cloud backup and stock quotes unavailable. */
  apiUrl,
  coinGeckoBase: 'https://api.coingecko.com/api/v3',
  privacyUrl: `${site}/privacy`,
  termsUrl: `${site}/terms`,
  supportUrl: `${site}/support`,
  supportEmail: '92labs320@gmail.com',
} as const;
