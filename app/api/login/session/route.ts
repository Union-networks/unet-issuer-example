import { NextResponse } from 'next/server';
import { createLoginSession } from '@union-networks/web-login';
import { appOrigin, issuerBaseUrl, serviceId } from '@/lib/config';

export async function POST() {
  const session = await createLoginSession({ serviceId, origin: appOrigin, expiresInSeconds: 120 }, { issuerBaseUrl });
  return NextResponse.json(session);
}
