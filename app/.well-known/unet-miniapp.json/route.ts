import { NextResponse } from 'next/server';
import { createIssuerMiniappManifest } from '@union-networks/issuer';
import { appOrigin, providerName, serviceId, serviceName } from '@/lib/config';

export function GET() {
  const manifest = createIssuerMiniappManifest({
    serviceId,
    name: serviceName,
    provider: providerName,
    launchUrl: new URL('/miniapp', appOrigin).toString(),
    description: 'Request demo attestations from the Authority Portal.',
    icon: 'business-outline',
    permissions: ['identity.scoped', 'attestations.request', 'attestations.refresh'],
    notificationCategories: ['service', 'security', 'marketing'],
  });
  return NextResponse.json(manifest, { headers: { 'cache-control': 'public, max-age=300' } });
}
