import { NextResponse } from 'next/server';
import { verifyLoginAssertion } from '@union-networks/server';
import { serviceId } from '@/lib/config';
import {
  ISSUER_ADMIN_SESSION_COOKIE,
  createIssuerAdminSession,
  isIssuerAdminScopedUserId,
  issuerAdminCookieOptions,
  readIssuerAdminSession,
} from '@/lib/issuer-admin-session';

export async function GET(request: Request) {
  const session = readIssuerAdminSession(request);
  let authenticated = false;
  try {
    authenticated = Boolean(session && isIssuerAdminScopedUserId(session.scopedUserId));
  } catch {
    authenticated = false;
  }
  const response = NextResponse.json({
    success: true,
    authenticated,
    ...(authenticated && session ? { scopedUserId: session.scopedUserId, expiresAt: session.expiresAt } : {}),
  });
  response.headers.set('cache-control', 'private, no-store');
  return response;
}

export async function POST(request: Request) {
  const body = await request.json() as { assertionJws?: string; purpose?: 'miniapp' | 'issuer-admin' };
  if (!body.assertionJws) return NextResponse.json({ success: false, message: 'assertionJws is required' }, { status: 400 });
  const secret = process.env.UNET_WEB_LOGIN_ASSERTION_SECRET;
  if (!secret) return NextResponse.json({ success: false, message: 'UNET_WEB_LOGIN_ASSERTION_SECRET is not configured' }, { status: 500 });
  try {
    const claims = verifyLoginAssertion(body.assertionJws, { secret, serviceId });
    if (body.purpose !== 'issuer-admin') {
      return NextResponse.json({ success: true, scopedUserId: claims.scopedUserId, sessionId: claims.sessionId });
    }
    if (!claims.scopedUserId || !isIssuerAdminScopedUserId(claims.scopedUserId)) {
      return NextResponse.json({ success: false, message: 'issuer_admin_not_authorized' }, { status: 403 });
    }
    const session = createIssuerAdminSession(claims.scopedUserId);
    const response = NextResponse.json({
      success: true,
      scopedUserId: claims.scopedUserId,
      sessionId: claims.sessionId,
      expiresAt: session.expiresAt,
    });
    response.cookies.set(ISSUER_ADMIN_SESSION_COOKIE, session.token, issuerAdminCookieOptions(session.expiresAt));
    return response;
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'invalid assertion' }, { status: 401 });
  }
}
