import Link from 'next/link';
import { IssuerDashboard } from '@/components/IssuerDashboard';

export default function AttestationsPage() {
  return <main><nav className="nav"><Link className="brand" href="/"><span className="mark" /> Attestations</Link></nav><IssuerDashboard initialTab="attestations" /></main>;
}
