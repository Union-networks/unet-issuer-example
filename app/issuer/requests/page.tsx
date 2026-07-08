import Link from 'next/link';
import { IssuerDashboard } from '@/components/IssuerDashboard';

export default function RequestsPage() {
  return <main><nav className="nav"><Link className="brand" href="/"><span className="mark" /> Requests</Link></nav><IssuerDashboard initialTab="requests" /></main>;
}
