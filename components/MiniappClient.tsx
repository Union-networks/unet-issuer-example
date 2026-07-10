'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LoginPanel } from './LoginPanel';

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void };
    __unetReceiveHostMessage?: (message: HostMessage) => void;
  }
}

type HostMessage = { id?: string; source?: string; ok?: boolean; result?: { scopedUserId?: string; assertionJws?: string }; error?: string };
type VerificationCheck = { requestType: string; label?: string; description?: string };

export function MiniappClient() {
  const [scopedUserId, setScopedUserId] = useState('');
  const [assertionJws, setAssertionJws] = useState('');
  const [status, setStatus] = useState('Connecting to U-net...');
  const [requestType, setRequestType] = useState('age-over-18');
  const [checks, setChecks] = useState<VerificationCheck[]>([]);
  const pending = useRef(new Map<string, { resolve: (value: HostMessage['result']) => void; reject: (error: Error) => void; timeout: ReturnType<typeof setTimeout> }>());

  const parseHostMessage = (data: unknown): HostMessage | null => {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data) as HostMessage;
      } catch {
        return null;
      }
    }
    return data && typeof data === 'object' ? data as HostMessage : null;
  };

  const callHost = useCallback((action: string, payload: Record<string, unknown> = {}) =>
    new Promise<HostMessage['result']>((resolve, reject) => {
      if (!window.ReactNativeWebView) {
        reject(new Error('Open in U-net or sign in below.'));
        return;
      }
      const id = `issuer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const timeout = setTimeout(() => {
        pending.current.delete(id);
        reject(new Error('U-net host did not respond.'));
      }, 15000);
      pending.current.set(id, { resolve, reject, timeout });
      window.ReactNativeWebView.postMessage(JSON.stringify({ id, action, payload }));
    }), []);

  const completeLogin = useCallback(async (scoped: string, assertion: string) => {
    const verified = await fetch('/api/login/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ assertionJws: assertion }),
    }).then((res) => res.json());
    if (!verified.success) throw new Error(verified.message || 'login verification failed');
    localStorage.setItem('unetIssuerExampleScopedUserId', scoped);
    localStorage.setItem('unetIssuerExampleAssertion', assertion);
    setScopedUserId(scoped);
    setAssertionJws(assertion);
    setStatus('Connected with a service-scoped U-net ID.');
  }, []);

  const requestFromHost = useCallback(async () => {
    if (!window.ReactNativeWebView) {
      setStatus('Open in U-net or sign in below.');
      return;
    }
    try {
      const result = await callHost('host.createServiceSession');
      const scoped = result?.scopedUserId;
      const assertion = result?.assertionJws;
      if (!scoped || !assertion) throw new Error('Host did not return a scoped U-net session.');
      await completeLogin(scoped, assertion);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'U-net miniapp login failed.');
    }
  }, [callHost, completeLogin]);

  useEffect(() => {
    window.__unetReceiveHostMessage = (message: HostMessage) => {
      if (!message || message.source !== 'unet-host' || !message.id) return;
      const item = pending.current.get(message.id);
      if (!item) return;
      pending.current.delete(message.id);
      clearTimeout(item.timeout);
      if (message.ok) item.resolve(message.result);
      else item.reject(new Error(message.error || 'U-net host request failed.'));
    };
    const listener = (event: MessageEvent) => {
      const message = parseHostMessage(event.data);
      if (message) window.__unetReceiveHostMessage?.(message);
    };
    window.addEventListener('message', listener);
    document.addEventListener('message', listener as EventListener);
    return () => {
      window.removeEventListener('message', listener);
      document.removeEventListener('message', listener as EventListener);
      pending.current.forEach((item) => clearTimeout(item.timeout));
      pending.current.clear();
      delete window.__unetReceiveHostMessage;
    };
  }, []);

  useEffect(() => {
    setScopedUserId(localStorage.getItem('unetIssuerExampleScopedUserId') || '');
    setAssertionJws(localStorage.getItem('unetIssuerExampleAssertion') || '');
    void fetch('/api/verification-checks')
      .then((res) => res.json())
      .then((body) => {
        const next = Array.isArray(body.checks) ? body.checks as VerificationCheck[] : [];
        setChecks(next);
        if (next[0]?.requestType) setRequestType(next[0].requestType);
      })
      .catch((error) => setStatus(error instanceof Error ? error.message : 'Could not load active checks.'));
  }, []);

  useEffect(() => {
    if (scopedUserId) return;
    void requestFromHost();
  }, [requestFromHost, scopedUserId]);

  async function submitRequest() {
    if (!scopedUserId || !assertionJws) {
      setStatus('Sign in first.');
      return;
    }
    setStatus('Creating attestation request...');
    const response = await fetch('/api/issuer/requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scopedUserId, assertionJws, requestType, claims: { requestedFrom: 'issuer-example-miniapp' } }),
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
          {checks.map((check) => <option key={check.requestType} value={check.requestType}>{check.label || check.requestType}</option>)}
        </select>
        <button onClick={submitRequest} disabled={!checks.length}>Request attestation</button>
        <p className="status">{status}</p>
      </div>
    </div>
  );
}
