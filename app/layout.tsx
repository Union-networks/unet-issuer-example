import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'U-net Issuer Example',
  description: 'Example U-net attestation issuer web app and miniapp.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
