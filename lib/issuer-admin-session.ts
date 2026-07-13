import { createHmac, timingSafeEqual } from 'node:crypto';
import { serviceId } from './config';

export const ISSUER_ADMIN_SESSION_COOKIE = 'unet_issuer_admin_session';

type IssuerAdminSession = {
  v: 1;
  serviceId: string;
  scopedUserId: string;
  issuedAt: number;
  expiresAt: number;
};

const sessionSecret = () => {
  const secret = process.env.UNET_ISSUER_DASHBOARD_SESSION_SECRET
    ?? process.env.UNET_WEB_LOGIN_ASSERTION_SECRET;
  if (!secret) throw new Error('issuer_dashboard_session_secret_not_configured');
  return secret;
};

const sessionTtlSeconds = () => {
  const configured = Number(process.env.UNET_ISSUER_DASHBOARD_SESSION_TTL_SECONDS ?? 8 * 60 * 60);
  if (!Number.isFinite(configured)) return 8 * 60 * 60;
  return Math.min(Math.max(Math.floor(configured), 5 * 60), 24 * 60 * 60);
};

const sign = (payload: string) => createHmac('sha256', sessionSecret()).update(payload).digest('base64url');

export function isIssuerAdminScopedUserId(scopedUserId: string) {
  const allowed = (process.env.UNET_ISSUER_ADMIN_SCOPED_IDS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (!allowed.length) throw new Error('issuer_admin_allowlist_not_configured');
  return allowed.includes(scopedUserId);
}

export function createIssuerAdminSession(scopedUserId: string) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + sessionTtlSeconds();
  const claims: IssuerAdminSession = { v: 1, serviceId, scopedUserId, issuedAt, expiresAt };
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return { token: `${payload}.${sign(payload)}`, expiresAt };
}

const cookieValue = (request: Request) => {
  const cookieHeader = request.headers.get('cookie') ?? '';
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== ISSUER_ADMIN_SESSION_COOKIE) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return '';
};

export function readIssuerAdminSession(request: Request): IssuerAdminSession | undefined {
  try {
    const token = cookieValue(request);
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra) return undefined;
    const expected = Buffer.from(sign(payload), 'base64url');
    const actual = Buffer.from(signature, 'base64url');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return undefined;
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<IssuerAdminSession>;
    if (claims.v !== 1 || claims.serviceId !== serviceId || typeof claims.scopedUserId !== 'string') return undefined;
    if (!Number.isInteger(claims.expiresAt) || claims.expiresAt! <= Math.floor(Date.now() / 1000)) return undefined;
    return claims as IssuerAdminSession;
  } catch {
    return undefined;
  }
}

export const issuerAdminCookieOptions = (expiresAt?: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  ...(expiresAt ? { expires: new Date(expiresAt * 1000) } : { maxAge: 0 }),
});
