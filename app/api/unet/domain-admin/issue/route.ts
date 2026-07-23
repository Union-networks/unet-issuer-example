import { sign } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createCredentialEnvelopeV2, encryptCredentialEnvelopeV2 } from '@union-networks/issuer';
import { configureCredentialRuntime, domainAdminSigner } from '@/lib/issuer-server';
import { serviceId } from '@/lib/config';

export const runtime = 'nodejs';

type CallbackRequest = {
  version?: number;
  action?: string;
  invitationId?: string;
  serviceId?: string;
  origin?: string;
  role?: 'owner' | 'admin';
  requestType?: string;
  schemaId?: string;
  claims?: Record<string, unknown>;
  holderBinding?: string;
  deliveryPublicKey?: string;
  challenge?: string;
  expiresAt?: string;
};

const consumedChallenges = new Set<string>();
const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
};

export async function POST(request: Request) {
  try {
    const body = await request.json() as CallbackRequest;
    const configuredOrigin = (process.env.NEXT_PUBLIC_SITE_URL ?? request.headers.get('origin') ?? '').replace(/\/+$/, '');
    const challengeHeader = request.headers.get('x-unet-domain-admin-challenge') ?? '';
    if (body.version !== 1 || body.action !== 'domain-admin.issue') throw new Error('domain_admin_callback_action_invalid');
    if (body.serviceId !== serviceId || body.origin !== configuredOrigin) throw new Error('domain_admin_callback_service_mismatch');
    if (body.role !== 'owner' && body.role !== 'admin') throw new Error('domain_admin_role_invalid');
    if (body.schemaId !== 'unet.provider.domain-admin.v1') throw new Error('domain_admin_schema_invalid');
    if (!body.challenge || body.challenge !== challengeHeader || consumedChallenges.has(body.challenge)) throw new Error('domain_admin_challenge_invalid');
    if (!body.expiresAt || Date.parse(body.expiresAt) <= Date.now()) throw new Error('domain_admin_invitation_expired');
    if (!body.invitationId || !body.requestType || !body.holderBinding || !body.deliveryPublicKey) throw new Error('domain_admin_callback_invalid');
    if (body.claims?.domain_role !== `${serviceId}:${body.role}` || body.claims.service_id !== serviceId || body.claims.role !== body.role) throw new Error('domain_admin_claims_invalid');
    consumedChallenges.add(body.challenge);
    if (consumedChallenges.size > 1000) consumedChallenges.delete(consumedChallenges.values().next().value!);

    configureCredentialRuntime();
    const signer = domainAdminSigner();
    const nowEpoch = Math.floor(Date.now() / 1000);
    const validUntilEpoch = nowEpoch + 2 * 365 * 24 * 60 * 60;
    const credentialEnvelope = await createCredentialEnvelopeV2({
      requestType: body.requestType,
      schemaId: body.schemaId,
      issuerId: signer.issuerId,
      issuerKeyId: signer.keyId,
      issuerCredentialKeyId: signer.credentialKeyId,
      credentialPrivateKeyPem: signer.credentialPrivateKeyPem,
      holderBinding: body.holderBinding,
      validFromEpoch: nowEpoch,
      validUntilEpoch,
      statusEpoch: 1,
      claims: [
        { path: 'domain_role', type: 'string', value: `${serviceId}:${body.role}` },
        { path: 'service_id', type: 'string', value: serviceId },
        { path: 'role', type: 'string', value: body.role },
        { path: 'valid_until', type: 'u64', value: validUntilEpoch },
      ],
    });
    const payload = {
      challenge: body.challenge,
      invitationId: body.invitationId,
      serviceId,
      role: body.role,
      requestType: body.requestType,
      attestationCommitment: credentialEnvelope.attestationCommitment,
      encryptedCredentialEnvelope: encryptCredentialEnvelopeV2(credentialEnvelope, body.deliveryPublicKey),
      credentialPublicMetadata: {
        version: 2,
        schemaId: credentialEnvelope.schemaId,
        schemaIdField: credentialEnvelope.schemaIdField,
        issuerCredentialKeyId: credentialEnvelope.issuerCredentialKeyId,
        issuerKeyHash: credentialEnvelope.issuerKeyHash,
        statusEpoch: credentialEnvelope.statusEpoch,
      },
      expiresAt: new Date(validUntilEpoch * 1000).toISOString(),
    };
    return NextResponse.json({ keyId: signer.keyId, payload, signature: sign(null, Buffer.from(canonicalJson(payload), 'utf8'), signer.privateKeyPem).toString('base64url') });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'domain_admin_issue_failed';
    return NextResponse.json({ success: false, errorCode: message, message }, { status: 400 });
  }
}
