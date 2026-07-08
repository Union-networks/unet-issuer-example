import Link from 'next/link';
import { MiniappClient } from '@/components/MiniappClient';

export default function MiniappPage() {
  return (
    <main>
      <nav className="nav">
        <Link className="brand" href="/"><span className="mark" /> Authority Portal</Link>
      </nav>
      <MiniappClient />
    </main>
  );
}
