import { NextResponse } from 'next/server';
import { listIssuedAttestations } from '@union-networks/issuer';
import { issuerOptions, providerToken } from '@/lib/issuer-server';
import { serviceId } from '@/lib/config';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const result = await listIssuedAttestations({ serviceId, scopedUserId: url.searchParams.get('scopedUserId') ?? undefined, providerToken: providerToken() }, issuerOptions());
  return NextResponse.json(result);
}
