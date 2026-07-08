import { createIssuerSignerFromEnv } from '@union-networks/issuer';
import { issuerBaseUrl } from './config';

export const providerToken = () => process.env.UNET_PROVIDER_API_KEY;
export const issuerOptions = () => ({ issuerBaseUrl });
export const issuerSigner = () => createIssuerSignerFromEnv();
