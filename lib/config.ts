export const serviceId = process.env.NEXT_PUBLIC_UNET_SERVICE_ID ?? 'unet-issuer-example';
export const issuerBaseUrl = process.env.NEXT_PUBLIC_UNET_ISSUER_BASE_URL ?? 'https://issuer.egress.live';

function resolveAppOrigin() {
  const explicit = process.env.NEXT_PUBLIC_UNET_ORIGIN ?? process.env.UNET_ORIGIN;
  if (explicit) return explicit.replace(/\/+$/, '');

  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProductionUrl) return `https://${vercelProductionUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;

  return 'http://localhost:3000';
}

export const appOrigin = resolveAppOrigin();
export const serviceName = 'U-net Issuer Example';
export const providerName = 'Example Issuer';
export const allowedIssuerRequestTypes = (process.env.UNET_ISSUER_ALLOWED_REQUEST_TYPES ?? 'age-over-18,nl-citizen')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
