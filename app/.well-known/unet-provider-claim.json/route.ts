import { NextResponse } from 'next/server';

import { getProviderDomainClaim } from '@/lib/domain-claim';

export function GET() {
  const claim = getProviderDomainClaim();
  if (!claim) {
    return NextResponse.json({ error: 'domain claim is not configured' }, { status: 404 });
  }

  return NextResponse.json(claim, { headers: { 'cache-control': 'no-store' } });
}
