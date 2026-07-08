import { NextResponse } from 'next/server';
import { revokeAttestation } from '@union-networks/issuer';
import { issuerOptions, issuerSigner, providerToken } from '@/lib/issuer-server';
import { serviceId } from '@/lib/config';

export async function POST(request: Request, { params }: { params: Promise<{ attestationHash: string }> }) {
  const { attestationHash } = await params;
  const body = await request.json() as { reason?: string };
  const result = await revokeAttestation({ serviceId, attestationHash, reason: body.reason, signer: issuerSigner(), providerToken: providerToken() }, issuerOptions());
  return NextResponse.json(result);
}
