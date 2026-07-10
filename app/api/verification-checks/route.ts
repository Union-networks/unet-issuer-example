import { NextResponse } from 'next/server';

import { allowedIssuerRequestTypes, issuerBaseUrl } from '@/lib/config';

export async function GET() {
  const response = await fetch(`${issuerBaseUrl.replace(/\/+$/, '')}/v1/verification-checks`, { cache: 'no-store' });
  const body = await response.json().catch(() => ({ success: false, checks: [] }));
  if (!response.ok) return NextResponse.json(body, { status: response.status });
  const allowed = new Set(allowedIssuerRequestTypes);
  const checks = Array.isArray(body.checks)
    ? body.checks.filter((check: { requestType?: string }) => check.requestType && allowed.has(check.requestType))
    : [];
  return NextResponse.json({ ...body, checks });
}
