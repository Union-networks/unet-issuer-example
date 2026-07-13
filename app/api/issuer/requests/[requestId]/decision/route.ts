import { NextResponse } from 'next/server';
import { approveAttestationRequest, denyAttestationRequest, listAttestationRequests } from '@union-networks/issuer';
import { configureCredentialRuntime, issuerOptions, issuerSigner, providerToken, requireIssuerAdmin } from '@/lib/issuer-server';
import { serviceId, verifierBaseUrl } from '@/lib/config';

export async function POST(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    requireIssuerAdmin(request);
  } catch (error) {
    return NextResponse.json({
      success: false,
      errorCode: 'issuer_admin_session_required',
      message: error instanceof Error ? error.message : 'issuer admin auth required',
    }, { status: 401 });
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
    const checksResponse = await fetch(`${verifierBaseUrl.replace(/\/+$/, '')}/v1/verification-checks`, { cache: 'no-store' });
    const checksPayload = await checksResponse.json() as { checks?: Array<{ requestType?: string; schemaId?: string; proofProfileId?: string; predicateParams?: Record<string, unknown> }> };
    const check = checksPayload.checks?.find((entry) =>
      entry.requestType === item.requestType && entry.schemaId?.startsWith(`unet.${serviceId}.`));
    if (body.decision === 'approve' && (!check?.schemaId || !item.holderBinding || !item.deliveryPublicKey)) {
      return NextResponse.json({ success: false, message: 'Active check metadata or private credential delivery context is missing.' }, { status: 409 });
    }
    const predicateParams = check?.predicateParams ?? {};
    const claimPath = typeof predicateParams.claimPath === 'string' ? predicateParams.claimPath : 'claim';
    const generatedClaimValue = check?.proofProfileId === 'claim_range_v1'
      ? Number(predicateParams.lowerBound ?? 18) + 3
      : predicateParams.expectedValue ?? body.claims?.[claimPath];
    const credentialClaims = body.claims && Object.keys(body.claims).length ? body.claims : { [claimPath]: generatedClaimValue };
    if (body.decision === 'approve') configureCredentialRuntime();
    const result = body.decision === 'deny'
      ? await denyAttestationRequest({ serviceId, requestId, reason: body.reason, signer, providerToken: providerToken() }, issuerOptions())
      : await approveAttestationRequest({
          serviceId,
          requestId,
          claims: credentialClaims,
          signer,
          providerToken: providerToken(),
          credential: {
            requestType: String(item.requestType),
            schemaId: check!.schemaId!,
            holderBinding: item.holderBinding!,
            deliveryPublicKey: item.deliveryPublicKey!,
            validUntilEpoch: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
            statusEpoch: item.statusEpoch ?? 1,
          },
        }, issuerOptions());
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Decision failed';
    const status = typeof (error as { status?: unknown }).status === 'number' ? Number((error as { status?: unknown }).status) : 500;
    const errorCode = typeof (error as { errorCode?: unknown }).errorCode === 'string' ? String((error as { errorCode?: unknown }).errorCode) : undefined;
    return NextResponse.json({ success: false, message, ...(errorCode ? { errorCode } : {}) }, { status });
  }
}
