import { NextResponse } from 'next/server';
import { createAttestationRequest, listAttestationRequests } from '@union-networks/issuer';
import { issuerOptions, providerToken } from '@/lib/issuer-server';
import { serviceId } from '@/lib/config';

export async function GET(request: Request) {
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
  const body = await request.json() as { scopedUserId?: string; requestType?: string; claims?: Record<string, unknown> };
  if (!body.scopedUserId || !body.requestType) return NextResponse.json({ success: false, message: 'scopedUserId and requestType are required' }, { status: 400 });
  const result = await createAttestationRequest({ serviceId, scopedUserId: body.scopedUserId, requestType: body.requestType, claims: body.claims }, issuerOptions());
  return NextResponse.json(result);
}
