import { createIssuerSignerFromEnv } from '@union-networks/issuer';
import { verifyLoginAssertion } from '@union-networks/server';
import { issuerBaseUrl, serviceId } from './config';

export const providerToken = () => process.env.UNET_PROVIDER_API_KEY;
export const issuerOptions = () => ({ issuerBaseUrl });
export const issuerSigner = (requestType?: string) => {
  const raw = process.env.UNET_ISSUER_SIGNERS_JSON;
  if (raw && requestType) {
    const parsed = JSON.parse(raw) as Record<string, { issuerId?: string; keyId?: string; privateKeyPem?: string; publicKeyPem?: string }>;
    const signer = parsed[requestType];
    if (signer?.issuerId && signer.keyId && signer.privateKeyPem) {
      return {
        issuerId: signer.issuerId,
        keyId: signer.keyId,
        privateKeyPem: signer.privateKeyPem,
        ...(signer.publicKeyPem ? { publicKeyPem: signer.publicKeyPem } : {}),
      };
    }
  }
  return createIssuerSignerFromEnv();
};

export function verifyServiceAssertion(assertionJws?: string) {
  const secret = process.env.UNET_WEB_LOGIN_ASSERTION_SECRET;
  if (!secret) throw new Error('UNET_WEB_LOGIN_ASSERTION_SECRET is not configured');
  if (!assertionJws) throw new Error('assertionJws is required');
  return verifyLoginAssertion(assertionJws, { secret, serviceId });
}

export function bearerAssertion(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  return authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : '';
}

export function requireIssuerAdmin(request: Request) {
  const claims = verifyServiceAssertion(bearerAssertion(request));
  const allowed = (process.env.UNET_ISSUER_ADMIN_SCOPED_IDS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (!claims.scopedUserId) throw new Error('issuer_admin_not_authorized');
  if (!allowed.length) throw new Error('issuer_admin_allowlist_not_configured');
  if (!allowed.includes(claims.scopedUserId)) throw new Error('issuer_admin_not_authorized');
  return claims;
}
