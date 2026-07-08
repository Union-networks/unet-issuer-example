'use client';

import { useEffect, useState } from 'react';
import { pollLoginSession, renderLoginQrPayload } from '@union-networks/web-login';

type Props = { onLogin: (scopedUserId: string, assertionJws: string) => void };

export function LoginPanel({ onLogin }: Props) {
  const [qr, setQr] = useState('');
  const [status, setStatus] = useState('Creating U-net QR...');

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const created = await fetch('/api/login/session', { method: 'POST' }).then((res) => res.json());
        if (cancelled) return;
        setQr(created.qrDataUrl || renderLoginQrPayload(created));
        setStatus('Scan with U-net to continue.');
        const finalSession = await pollLoginSession(created.sessionId, { issuerBaseUrl: process.env.NEXT_PUBLIC_UNET_ISSUER_BASE_URL });
        if (cancelled) return;
        if (finalSession.status !== 'approved' || !finalSession.scopedUserId || !finalSession.assertionJws) {
          setStatus(`Login ${finalSession.status}`);
          return;
        }
        const verified = await fetch('/api/login/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ assertionJws: finalSession.assertionJws }) }).then((res) => res.json());
        if (!verified.success) throw new Error(verified.message || 'login verification failed');
        localStorage.setItem('unetIssuerExampleScopedUserId', finalSession.scopedUserId);
        localStorage.setItem('unetIssuerExampleAssertion', finalSession.assertionJws);
        onLogin(finalSession.scopedUserId, finalSession.assertionJws);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : String(error));
      }
    }
    run();
    return () => { cancelled = true; };
  }, [onLogin]);

  return (
    <div className="panel stack">
      <h2>Sign in with U-net</h2>
      <p>{status}</p>
      {qr ? (qr.startsWith('data:') ? <img src={qr} alt="U-net login QR" style={{ width: 220, height: 220, borderRadius: 16 }} /> : <pre className="code">{qr}</pre>) : null}
    </div>
  );
}
