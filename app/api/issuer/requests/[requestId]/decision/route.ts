import { NextResponse } from 'next/server';
import { approveAttestationRequest, denyAttestationRequest, listAttestationRequests } from '@union-networks/issuer';
import { issuerOptions, issuerSigner, providerToken, requireIssuerAdmin } from '@/lib/issuer-server';
import { serviceId } from '@/lib/config';

export async function POST(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    requireIssuerAdmin(request);
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'issuer admin auth required' }, { status: 401 });
  }
  try {
    const { requestId } = await params;
    const body = await request.json() as { decision?: 'approve' | 'deny'; reason?: string; claims?: Record<string, unknown> };
    if (body.decision !== 'approve' && body.decision !== 'deny') {
      return NextResponse.json({ success: false, message: 'decision must be approve or deny' }, { status: 400 });
    }
    const listed = await listAttestationRequests({ serviceId, providerToken: providerToken() }, issuerOptions());
    const item = listed.requests.find((entry) => entry.requestId === requestId);
    if (!item) return NextResponse.json({ success: false, message: 'request not found' }, { status: 404 });
    const signer = issuerSigner(String(item.requestType));
    const result = body.decision === 'deny'
      ? await denyAttestationRequest({ serviceId, requestId, reason: body.reason, signer, providerToken: providerToken() }, issuerOptions())
      : await approveAttestationRequest({ serviceId, requestId, claims: body.claims, signer, providerToken: providerToken() }, issuerOptions());
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Decision failed';
    const status = typeof (error as { status?: unknown }).status === 'number' ? Number((error as { status?: unknown }).status) : 500;
    const errorCode = typeof (error as { errorCode?: unknown }).errorCode === 'string' ? String((error as { errorCode?: unknown }).errorCode) : undefined;
    return NextResponse.json({ success: false, message, ...(errorCode ? { errorCode } : {}) }, { status });
  }
}
