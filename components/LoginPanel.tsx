'use client';

import { useEffect, useState } from 'react';
import { renderLoginQrPayload } from '@union-networks/web-login';

type Props = {
  onLogin: (scopedUserId: string, assertionJws: string) => void;
  purpose?: 'miniapp' | 'issuer-admin';
};

export function LoginPanel({ onLogin, purpose = 'miniapp' }: Props) {
  const [qr, setQr] = useState('');
  const [status, setStatus] = useState('Creating U-net QR...');

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sleep = (ms: number) => new Promise((resolve) => { timer = setTimeout(resolve, ms); });
    async function run() {
      try {
        const createdResponse = await fetch('/api/login/session', { method: 'POST' });
        const created = await createdResponse.json().catch(() => ({ success: false, message: 'Could not create login session.' }));
        if (!createdResponse.ok || created.success === false) throw new Error(created.message || 'Could not create login session.');
        if (cancelled) return;
        setQr(created.qrDataUrl || renderLoginQrPayload(created));
        setStatus('Scan with U-net to continue.');
        let finalSession = created;
        const deadline = Date.now() + 120000;
        while (!cancelled && finalSession.status === 'pending' && Date.now() < deadline) {
          await sleep(1500);
          if (cancelled) return;
          const pollResponse = await fetch(`/api/login/session?sessionId=${encodeURIComponent(created.sessionId)}`, { cache: 'no-store' });
          finalSession = await pollResponse.json().catch(() => ({ success: false, message: 'Could not read login session.' }));
          if (!pollResponse.ok || finalSession.success === false) throw new Error(finalSession.message || 'Could not poll login session.');
        }
        if (cancelled) return;
        if (finalSession.status !== 'approved' || !finalSession.scopedUserId || !finalSession.assertionJws) {
          setStatus(`Login ${finalSession.status}`);
          return;
        }
        const verifyResponse = await fetch('/api/login/verify', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ assertionJws: finalSession.assertionJws, purpose }),
        });
        const verified = await verifyResponse.json().catch(() => ({ success: false, message: 'Could not read login verification response.' }));
        if (!verifyResponse.ok || !verified.success) throw new Error(verified.message || 'login verification failed');
        if (purpose === 'issuer-admin') {
          localStorage.setItem('unetIssuerAdminScopedUserId', finalSession.scopedUserId);
        } else {
          localStorage.setItem('unetIssuerExampleScopedUserId', finalSession.scopedUserId);
          localStorage.setItem('unetIssuerExampleAssertion', finalSession.assertionJws);
        }
        onLogin(finalSession.scopedUserId, finalSession.assertionJws);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : String(error));
      }
    }
    run();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [onLogin, purpose]);

  return (
    <div className="panel stack">
      <h2>Sign in with U-net</h2>
      <p>{status}</p>
      {qr ? (qr.startsWith('data:') ? <img src={qr} alt="U-net login QR" style={{ width: 220, height: 220, borderRadius: 16 }} /> : <pre className="code">{qr}</pre>) : null}
    </div>
  );
}
