import { NextResponse } from 'next/server';
import { createAttestationRequest, listAttestationRequests } from '@union-networks/issuer';
import { issuerOptions, providerToken, requireIssuerAdmin, verifyServiceAssertion } from '@/lib/issuer-server';
import { serviceId } from '@/lib/config';

export async function GET(request: Request) {
  try {
    requireIssuerAdmin(request);
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'issuer admin auth required' }, { status: 401 });
  }
  const url = new URL(request.url);
  const result = await listAttestationRequests({
    serviceId,
    status: url.searchParams.get('status') ?? undefined,
    scopedUserId: url.searchParams.get('scopedUserId') ?? undefined,
    providerToken: providerToken(),
  }, issuerOptions());
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const body = await request.json() as { scopedUserId?: string; requestType?: string; claims?: Record<string, unknown>; assertionJws?: string };
  if (!body.scopedUserId || !body.requestType) return NextResponse.json({ success: false, message: 'scopedUserId and requestType are required' }, { status: 400 });
  try {
    const claims = verifyServiceAssertion(body.assertionJws);
    if (claims.scopedUserId !== body.scopedUserId) return NextResponse.json({ success: false, message: 'scoped user mismatch' }, { status: 403 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'invalid U-net assertion' }, { status: 401 });
  }
  const result = await createAttestationRequest({ serviceId, scopedUserId: body.scopedUserId, requestType: body.requestType, claims: body.claims }, issuerOptions());
  return NextResponse.json(result);
}
