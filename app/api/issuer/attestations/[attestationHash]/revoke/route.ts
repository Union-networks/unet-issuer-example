import { NextResponse } from 'next/server';
import { listIssuedAttestations, revokeAttestation } from '@union-networks/issuer';
import { issuerOptions, issuerSigner, providerToken, requireIssuerAdmin } from '@/lib/issuer-server';
import { serviceId } from '@/lib/config';

export async function POST(request: Request, { params }: { params: Promise<{ attestationHash: string }> }) {
  try {
    requireIssuerAdmin(request);
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'issuer admin auth required' }, { status: 401 });
  }
  const { attestationHash } = await params;
  const body = await request.json() as { reason?: string };
  const listed = await listIssuedAttestations({ serviceId, providerToken: providerToken() }, issuerOptions());
  const item = listed.attestations.find((entry) => entry.attestationHash === attestationHash);
  const result = await revokeAttestation({ serviceId, attestationHash, reason: body.reason, signer: issuerSigner(String(item?.requestType || '')), providerToken: providerToken() }, issuerOptions());
  return NextResponse.json(result);
}
