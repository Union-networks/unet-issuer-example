import { NextResponse } from 'next/server';
import { createIssuerMiniappManifest } from '@union-networks/issuer';
import { appOrigin, providerName, serviceId, serviceName } from '@/lib/config';
import { getProviderDomainClaim } from '@/lib/domain-claim';

export function GET() {
  const origin = appOrigin.replace(/\/+$/, '');
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
  const domainClaim = getProviderDomainClaim();
  if (domainClaim) manifest.domainClaim = domainClaim;
  return NextResponse.json(manifest, { headers: { 'cache-control': 'no-store' } });
}
