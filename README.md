# U-net Issuer Example

This is a standalone issuer web app and miniapp for U-net attestations. It shows
how a provider can:

- let users sign in with U-net scoped identity;
- open the same site inside U-net as a miniapp;
- let a holder request an attestation;
- approve, deny, and revoke attestations from an issuer dashboard;
- keep issuer private keys server-side.

## Setup

1. Publish or install the matching U-net SDK alpha that includes
   `@union-networks/issuer`.
2. Copy `.env.example` to `.env.local`.
3. Generate issuer keys:

```ts
import { generateIssuerKeyPairEnv } from '@union-networks/issuer';
console.log(generateIssuerKeyPairEnv({
  issuerId: 'issuer:authority-portal',
  keyId: 'issuer:authority-portal#main',
}));
```

4. Put the generated values in Vercel env vars.
5. Set `NEXT_PUBLIC_UNET_ORIGIN` to your deployed origin.

## Local development

```bash
pnpm install
pnpm dev
```

## Security model

The browser can create attestation requests and view status, but approval,
denial, revocation, and issuer signing happen only in server routes. Never expose
`UNET_ISSUER_PRIVATE_KEY_PEM` to frontend code.
