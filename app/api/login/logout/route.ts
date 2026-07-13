import { NextResponse } from 'next/server';
import { ISSUER_ADMIN_SESSION_COOKIE, issuerAdminCookieOptions } from '@/lib/issuer-admin-session';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(ISSUER_ADMIN_SESSION_COOKIE, '', issuerAdminCookieOptions());
  return response;
}
