import { NextResponse } from 'next/server';
import { createLoginSession } from '@union-networks/web-login';
import { appOrigin, issuerBaseUrl, serviceId } from '@/lib/config';

export async function POST() {
  const session = await createLoginSession({ serviceId, origin: appOrigin, expiresInSeconds: 120 }, { issuerBaseUrl });
  return NextResponse.json(session);
}

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get('sessionId');
  if (!sessionId) return NextResponse.json({ success: false, message: 'sessionId is required' }, { status: 400 });
  const response = await fetch(`${issuerBaseUrl.replace(/\/+$/, '')}/v1/web-login/sessions/${encodeURIComponent(sessionId)}`, {
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({ success: false, message: 'Could not read U-net login session response.' }));
  return NextResponse.json(body, { status: response.status });
}
