import { createHash, createHmac } from 'node:crypto';

import { appOrigin, serviceId } from '@/lib/config';

export function getProviderDomainClaim() {
  const claimId = process.env.UNET_PROVIDER_CLAIM_ID;
  const challenge = process.env.UNET_PROVIDER_CLAIM_CHALLENGE;
  const claimToken = process.env.UNET_PROVIDER_CLAIM_TOKEN;
  if (!claimId || !challenge || !claimToken) return null;

  const origin = appOrigin.replace(/\/+$/, '');
  const claimTokenHash = createHash('sha256').update(claimToken).digest('hex');
  const proof = createHmac('sha256', claimTokenHash)
    .update(`${claimId}.${serviceId}.${origin}.${challenge}`)
    .digest('base64url');

  return { serviceId, origin, claimId, challenge, proof };
}
