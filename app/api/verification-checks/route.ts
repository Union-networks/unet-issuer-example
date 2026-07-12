import { NextResponse } from 'next/server';

import { allowedIssuerRequestTypes, serviceId, verifierBaseUrl } from '@/lib/config';

export async function GET() {
  const response = await fetch(`${verifierBaseUrl.replace(/\/+$/, '')}/v1/verification-checks`, { cache: 'no-store' });
  const body = await response.json().catch(() => ({ success: false, checks: [] }));
  if (!response.ok) return NextResponse.json(body, { status: response.status });
  const allowed = new Set(allowedIssuerRequestTypes);
  const checks = Array.isArray(body.checks)
    ? body.checks.filter((check: { requestType?: string; schemaId?: string }) =>
        Boolean(check.requestType) && (
          allowed.has(check.requestType!) ||
          check.schemaId?.startsWith(`unet.${serviceId}.`)
        ))
    : [];
  return NextResponse.json({ ...body, checks });
}
