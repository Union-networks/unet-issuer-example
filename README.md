# U-net Issuer Example

This standalone Next.js app shows the issuer side of U-net attestations without
living inside trust-plane. It can run as a normal website with QR login and as a
U-net miniapp with bridge login.

It demonstrates how a Studio-tier provider can:

- prove control of a domain with a U-net domain claim;
- let holders sign in with a service-scoped U-net identity;
- expose a same-origin miniapp manifest;
- let a holder request an attestation;
- approve, deny, and revoke attestations from an issuer dashboard;
- keep issuer private keys server-side.

The example identity is:

- serviceId / miniProgramId: `unet-issuer-example`
- issuerId: `issuer:unet-issuer-example`
- keyId: `issuer:unet-issuer-example#main`

## Setup

1. Copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_UNET_ORIGIN` or server-only `UNET_ORIGIN` to your public deployment origin. On Vercel, the example can also infer the origin from Vercel deployment URL env vars, but setting the canonical production origin is still recommended.
3. In the U-net dashboard, verify that domain and copy the claim values into:
   `UNET_PROVIDER_CLAIM_ID`, `UNET_PROVIDER_CLAIM_CHALLENGE`, and
   `UNET_PROVIDER_CLAIM_TOKEN`.
4. Upgrade the verified domain to Studio and complete the Stripe sandbox flow.
5. Generate issuer keys:

```ts
import { generateIssuerKeyPairEnv } from '@union-networks/issuer';

console.log(generateIssuerKeyPairEnv({
  issuerId: 'issuer:unet-issuer-example',
  keyId: 'issuer:unet-issuer-example#main',
}));
```

6. Store the generated key env vars server-side in Vercel.

`NEXT_PUBLIC_UNET_ISSUER_BASE_URL` is optional for production U-net; the SDK
defaults to `https://issuer.egress.live`. Set it only for local or staging
trust-plane environments.

## Required Well-Known Routes

The app serves:

- `/.well-known/unet-miniapp.json`
- `/.well-known/unet-provider-claim.json`

The provider claim route derives a proof from the raw claim token on the server.
The raw token is never exposed to frontend JavaScript.

## Local Development

```bash
pnpm install
pnpm dev
```

## Security Model

The browser can create attestation requests and view status, but approval,
denial, revocation, and issuer signing happen only in server routes. Never expose
`UNET_ISSUER_PRIVATE_KEY_PEM` or `UNET_PROVIDER_CLAIM_TOKEN` to frontend code.
