import { NextResponse } from 'next/server';
import { verifyLoginAssertion } from '@union-networks/server';
import { serviceId } from '@/lib/config';

export async function POST(request: Request) {
  const body = await request.json() as { assertionJws?: string };
  if (!body.assertionJws) return NextResponse.json({ success: false, message: 'assertionJws is required' }, { status: 400 });
  const secret = process.env.UNET_WEB_LOGIN_ASSERTION_SECRET;
  if (!secret) return NextResponse.json({ success: false, message: 'UNET_WEB_LOGIN_ASSERTION_SECRET is not configured' }, { status: 500 });
  try {
    const claims = verifyLoginAssertion(body.assertionJws, { secret, serviceId });
    return NextResponse.json({ success: true, scopedUserId: claims.scopedUserId, sessionId: claims.sessionId });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'invalid assertion' }, { status: 401 });
  }
}
