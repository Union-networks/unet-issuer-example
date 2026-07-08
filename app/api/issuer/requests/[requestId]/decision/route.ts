import { NextResponse } from 'next/server';
import { approveAttestationRequest, denyAttestationRequest } from '@union-networks/issuer';
import { issuerOptions, issuerSigner, providerToken } from '@/lib/issuer-server';
import { serviceId } from '@/lib/config';

export async function POST(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const body = await request.json() as { decision?: 'approve' | 'deny'; reason?: string; claims?: Record<string, unknown> };
  const signer = issuerSigner();
  const result = body.decision === 'deny'
    ? await denyAttestationRequest({ serviceId, requestId, reason: body.reason, signer, providerToken: providerToken() }, issuerOptions())
    : await approveAttestationRequest({ serviceId, requestId, claims: body.claims, signer, providerToken: providerToken() }, issuerOptions());
  return NextResponse.json(result);
}
