import { NextResponse } from 'next/server';
import { createIssuerMiniappManifest } from '@union-networks/issuer';
import { appOrigin, providerName, serviceId, serviceName } from '@/lib/config';

export function GET() {
  const origin = appOrigin.replace(/\/+$/, '');
  const claimId = process.env.UNET_PROVIDER_CLAIM_ID;
  const challenge = process.env.UNET_PROVIDER_CLAIM_CHALLENGE;
  const manifest = createIssuerMiniappManifest({
    serviceId,
    name: serviceName,
    provider: providerName,
    launchUrl: new URL('/miniapp', origin).toString(),
    description: 'Request demo attestations from an external issuer example.',
    icon: 'business-outline',
    permissions: ['identity.scoped', 'attestations.request', 'attestations.refresh'],
    notificationCategories: ['service', 'security', 'marketing'],
  }) as unknown as Record<string, unknown>;
  if (claimId && challenge) {
    manifest.domainClaim = { serviceId, origin, claimId, challenge };
  }
  return NextResponse.json(manifest, { headers: { 'cache-control': 'public, max-age=300' } });
}
