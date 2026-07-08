import Link from 'next/link';

export default function HomePage() {
  return (
    <main>
      <nav className="nav">
        <div className="brand"><span className="mark" /> U-net Issuer Example</div>
        <div className="navlinks">
          <Link href="/miniapp">Miniapp</Link>
          <Link href="/issuer">Issuer dashboard</Link>
        </div>
      </nav>
      <section className="hero">
        <div className="eyebrow">Attestation issuer demo</div>
        <h1>Issue U-net attestations without seeing a holder's global identity.</h1>
        <p className="lead">This example site can run in a browser or inside U-net as a miniapp. Holders request attestations with a scoped service identity; the issuer approves, denies, or revokes from a server-side dashboard.</p>
        <div className="row" style={{ justifyContent: 'flex-start' }}>
          <Link className="button" href="/miniapp">Open holder miniapp</Link>
          <Link className="button secondary" href="/issuer">Open issuer dashboard</Link>
        </div>
      </section>
      <section className="grid">
        {['Scoped identity only', 'Server-side issuer signing', 'Ledger-backed status'].map((title) => (
          <div className="panel" key={title}>
            <h3>{title}</h3>
            <p>Designed to mirror how third-party providers should integrate with U-net.</p>
          </div>
        ))}
      </section>
    </main>
  );
}
