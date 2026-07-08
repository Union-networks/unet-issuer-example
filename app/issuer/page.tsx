import Link from 'next/link';
import { IssuerDashboard } from '@/components/IssuerDashboard';

export default function IssuerPage() {
  return (
    <main>
      <nav className="nav"><Link className="brand" href="/"><span className="mark" /> U-net Issuer Example</Link></nav>
      <IssuerDashboard initialTab="requests" />
    </main>
  );
}
