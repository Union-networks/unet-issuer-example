import { createIssuerSignerFromEnv } from '@union-networks/issuer';
import { verifyLoginAssertion } from '@union-networks/server';
import { createPrivateKey, createPublicKey } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { isIssuerAdminScopedUserId, readIssuerAdminSession } from './issuer-admin-session';
import { issuerBaseUrl, serviceId } from './config';

export const providerToken = () => process.env.UNET_PROVIDER_API_KEY;
export const issuerOptions = () => ({ issuerBaseUrl });
export const configureCredentialRuntime = () => {
  if (process.env.BB_WASM_PATH?.trim()) return process.env.BB_WASM_PATH.trim();
  const wasmPath = join(process.cwd(), 'server-assets', 'barretenberg-threads.wasm.gz');
  if (!existsSync(wasmPath)) throw new Error('issuer_credential_runtime_wasm_missing');
  process.env.BB_WASM_PATH = wasmPath;
  return wasmPath;
};
const decodeEnvString = (value: string) => {
  let next = value.trim();
  for (let i = 0; i < 2; i += 1) {
    if (!next.startsWith('"') || !next.endsWith('"')) break;
    try {
      const parsed = JSON.parse(next);
      if (typeof parsed !== 'string') break;
      next = parsed.trim();
    } catch {
      break;
    }
  }
  return next.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
};
const wrapPemBody = (label: string, body: string) => {
  const compact = body.replace(/[^A-Za-z0-9+/=]/g, '');
  const chunks = compact.match(/.{1,64}/g)?.join('\n') ?? compact;
  return `-----BEGIN ${label}-----\n${chunks}\n-----END ${label}-----\n`;
};
const normalizePemText = (value: string, fallbackLabel: 'PRIVATE KEY' | 'PUBLIC KEY') => {
  const decoded = decodeEnvString(value);
  const pemMatch = decoded.match(/-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/);
  if (pemMatch) return wrapPemBody(pemMatch[1], pemMatch[2]);
  return wrapPemBody(fallbackLabel, decoded);
};
const normalizePrivateKeyPem = (value: string) => {
  const pem = normalizePemText(value, 'PRIVATE KEY');
  try {
    const key = createPrivateKey(pem);
    if (key.asymmetricKeyType !== 'ed25519') throw new Error(`issuer_private_key_must_be_ed25519:${key.asymmetricKeyType ?? 'unknown'}`);
    return key.export({ type: 'pkcs8', format: 'pem' }).toString();
  } catch (pemError) {
    const clean = decodeEnvString(value).replace(/[^A-Za-z0-9+/=]/g, '');
    try {
      const key = createPrivateKey({ key: Buffer.from(clean, 'base64'), format: 'der', type: 'pkcs8' });
      if (key.asymmetricKeyType !== 'ed25519') throw new Error(`issuer_private_key_must_be_ed25519:${key.asymmetricKeyType ?? 'unknown'}`);
      return key.export({ type: 'pkcs8', format: 'pem' }).toString();
    } catch {
      if (pemError instanceof Error && pemError.message.startsWith('issuer_private_key_must_be_ed25519')) throw pemError;
      throw new Error('issuer_private_key_invalid');
    }
  }
};
const normalizePublicKeyPem = (value: string) => {
  const pem = normalizePemText(value, 'PUBLIC KEY');
  try {
    const key = createPublicKey(pem);
    return key.export({ type: 'spki', format: 'pem' }).toString();
  } catch {
    return decodeEnvString(value);
  }
};
const normalizeCredentialPrivateKeyPem = (value: string) => {
  const pem = normalizePemText(value, 'PRIVATE KEY');
  try {
    const key = createPrivateKey(pem);
    if (key.asymmetricKeyType !== 'ec') throw new Error(`credential_private_key_must_be_secp256k1:${key.asymmetricKeyType ?? 'unknown'}`);
    if (key.asymmetricKeyDetails?.namedCurve !== 'secp256k1') throw new Error(`credential_private_key_must_be_secp256k1:${key.asymmetricKeyDetails?.namedCurve ?? 'unknown'}`);
    return key.export({ type: 'pkcs8', format: 'pem' }).toString();
  } catch (pemError) {
    const clean = decodeEnvString(value).replace(/[^A-Za-z0-9+/=]/g, '');
    try {
      const key = createPrivateKey({ key: Buffer.from(clean, 'base64'), format: 'der', type: 'pkcs8' });
      if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'secp256k1') {
        throw new Error(`credential_private_key_must_be_secp256k1:${key.asymmetricKeyType ?? key.asymmetricKeyDetails?.namedCurve ?? 'unknown'}`);
      }
      return key.export({ type: 'pkcs8', format: 'pem' }).toString();
    } catch {
      if (pemError instanceof Error && pemError.message.startsWith('credential_private_key_must_be_secp256k1')) throw pemError;
      throw new Error('credential_private_key_invalid');
    }
  }
};
type IssuerSignerJson = {
  issuerId?: string;
  keyId?: string;
  privateKeyPem?: string;
  publicKeyPem?: string;
  credentialKeyId?: string;
  credentialPrivateKeyPem?: string;
  credentialPublicKeyPem?: string;
  credentialSignatureScheme?: 'ecdsa_secp256k1_compact_low_s';
};
export const issuerSigner = (requestType?: string) => {
  const raw = process.env.UNET_ISSUER_SIGNERS_JSON;
  if (raw && requestType) {
    const parsed = JSON.parse(raw) as Record<string, IssuerSignerJson>;
    const signer = parsed[requestType];
    if (signer?.issuerId && signer.keyId && signer.privateKeyPem) {
      return {
        issuerId: signer.issuerId,
        keyId: signer.keyId,
        privateKeyPem: normalizePrivateKeyPem(signer.privateKeyPem),
        ...(signer.publicKeyPem ? { publicKeyPem: normalizePublicKeyPem(signer.publicKeyPem) } : {}),
        ...(signer.credentialKeyId ? { credentialKeyId: signer.credentialKeyId } : {}),
        ...(signer.credentialPrivateKeyPem ? { credentialPrivateKeyPem: normalizeCredentialPrivateKeyPem(signer.credentialPrivateKeyPem) } : {}),
        ...(signer.credentialPublicKeyPem ? { credentialPublicKeyPem: normalizePublicKeyPem(signer.credentialPublicKeyPem) } : {}),
        ...(signer.credentialSignatureScheme ? { credentialSignatureScheme: signer.credentialSignatureScheme } : {}),
      };
    }
  }
  const signer = createIssuerSignerFromEnv();
  return {
    ...signer,
    privateKeyPem: normalizePrivateKeyPem(signer.privateKeyPem),
    ...(signer.publicKeyPem ? { publicKeyPem: normalizePublicKeyPem(signer.publicKeyPem) } : {}),
  };
};

export const domainAdminSigner = () => {
  const issuerId = process.env.UNET_DOMAIN_ADMIN_ISSUER_ID;
  const keyId = process.env.UNET_DOMAIN_ADMIN_KEY_ID;
  const privateKeyPem = process.env.UNET_DOMAIN_ADMIN_PRIVATE_KEY_PEM;
  const publicKeyPem = process.env.UNET_DOMAIN_ADMIN_PUBLIC_KEY_PEM;
  const credentialKeyId = process.env.UNET_DOMAIN_ADMIN_CREDENTIAL_KEY_ID;
  const credentialPrivateKeyPem = process.env.UNET_DOMAIN_ADMIN_CREDENTIAL_PRIVATE_KEY_PEM;
  const credentialPublicKeyPem = process.env.UNET_DOMAIN_ADMIN_CREDENTIAL_PUBLIC_KEY_PEM;
  if (!issuerId || !keyId || !privateKeyPem || !credentialKeyId || !credentialPrivateKeyPem) {
    throw new Error('domain_admin_signer_environment_missing');
  }
  return {
    issuerId,
    keyId,
    privateKeyPem: normalizePrivateKeyPem(privateKeyPem),
    ...(publicKeyPem ? { publicKeyPem: normalizePublicKeyPem(publicKeyPem) } : {}),
    credentialKeyId,
    credentialPrivateKeyPem: normalizeCredentialPrivateKeyPem(credentialPrivateKeyPem),
    ...(credentialPublicKeyPem ? { credentialPublicKeyPem: normalizePublicKeyPem(credentialPublicKeyPem) } : {}),
    credentialSignatureScheme: 'ecdsa_secp256k1_compact_low_s' as const,
  };
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
  const session = readIssuerAdminSession(request);
  const claims = session ?? verifyServiceAssertion(bearerAssertion(request));
  if (!claims.scopedUserId) throw new Error('issuer_admin_not_authorized');
  if (!isIssuerAdminScopedUserId(claims.scopedUserId)) throw new Error('issuer_admin_not_authorized');
  return claims;
}
