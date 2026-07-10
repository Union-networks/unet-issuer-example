import { NextResponse } from 'next/server';
import { listIssuedAttestations } from '@union-networks/issuer';
import { issuerOptions, providerToken, requireIssuerAdmin } from '@/lib/issuer-server';
import { serviceId } from '@/lib/config';

export async function GET(request: Request) {
  try {
    requireIssuerAdmin(request);
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'issuer admin auth required' }, { status: 401 });
  }
  const url = new URL(request.url);
  const result = await listIssuedAttestations({ serviceId, scopedUserId: url.searchParams.get('scopedUserId') ?? undefined, providerToken: providerToken() }, issuerOptions());
  return NextResponse.json(result);
}
