'use client';

import { useCallback, useEffect, useState } from 'react';
import { LoginPanel } from './LoginPanel';

declare global {
  interface Window { ReactNativeWebView?: { postMessage: (message: string) => void }; }
}

type HostMessage = { id?: string; type?: string; result?: { scopedUserId?: string; assertionJws?: string }; error?: string };

export function MiniappClient() {
  const [scopedUserId, setScopedUserId] = useState('');
  const [status, setStatus] = useState('Connecting to U-net...');
  const [requestType, setRequestType] = useState('age_over_18');

  const requestFromHost = useCallback(() => {
    if (!window.ReactNativeWebView) {
      setStatus('Open in U-net or sign in below.');
      return;
    }
    const id = `host-${Date.now()}`;
    const listener = (event: MessageEvent) => {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) as HostMessage : event.data as HostMessage;
      if (data?.id !== id) return;
      window.removeEventListener('message', listener);
      document.removeEventListener('message', listener as EventListener);
      if (data.error) {
        setStatus(data.error);
        return;
      }
      const scoped = data.result?.scopedUserId;
      if (!scoped) {
        setStatus('Host did not return a scoped ID.');
        return;
      }
      setScopedUserId(scoped);
      setStatus('Connected with a service-scoped U-net ID.');
    };
    window.addEventListener('message', listener);
    document.addEventListener('message', listener as EventListener);
    window.ReactNativeWebView.postMessage(JSON.stringify({ id, type: 'host.createServiceSession' }));
  }, []);

  useEffect(() => { requestFromHost(); }, [requestFromHost]);

  async function submitRequest() {
    if (!scopedUserId) {
      setStatus('Sign in first.');
      return;
    }
    setStatus('Creating attestation request...');
    const response = await fetch('/api/issuer/requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scopedUserId, requestType, claims: { requestedFrom: 'issuer-example-miniapp' } }),
    });
    const payload = await response.json();
    setStatus(response.ok ? `Request created: ${payload.request.requestId}` : (payload.message || 'request failed'));
  }

  return (
    <div className="stack">
      <div className="panel stack">
        <span className="pill">Holder miniapp</span>
        <h1 style={{ fontSize: 44 }}>Authority Portal</h1>
        <p>Request attestations from the demo issuer using a scoped U-net identity.</p>
        <div className="code">{scopedUserId || 'No scoped identity yet'}</div>
      </div>
      {!scopedUserId && <LoginPanel onLogin={(scoped) => { setScopedUserId(scoped); setStatus('Connected with browser U-net login.'); }} />}
      <div className="panel stack">
        <h2>Request an attestation</h2>
        <select value={requestType} onChange={(event) => setRequestType(event.target.value)}>
          <option value="age_over_18">Over 18</option>
          <option value="dutch_citizen">Dutch citizen</option>
        </select>
        <button onClick={submitRequest}>Request attestation</button>
        <p className="status">{status}</p>
      </div>
    </div>
  );
}
