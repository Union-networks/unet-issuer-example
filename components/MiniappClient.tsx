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
  const [isMiniapp, setIsMiniapp] = useState(false);
  const [bridgeChecked, setBridgeChecked] = useState(false);
  const [showBrowserLogin, setShowBrowserLogin] = useState(false);
  const [status, setStatus] = useState('Connecting to U-net...');
  const [requestType, setRequestType] = useState('over-18-yr');
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
        reject(new Error('U-net bridge timed out.'));
      }, 30000);
      pending.current.set(id, { resolve, reject, timeout });
      window.ReactNativeWebView.postMessage(JSON.stringify({ id, action, payload }));
    }), []);

  const completeLogin = useCallback(async (scoped: string, assertion: string, options: { verify?: boolean } = {}) => {
    if (options.verify !== false) {
      const response = await fetch('/api/login/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ assertionJws: assertion }),
      });
      const verified = await response.json().catch(() => ({ success: false, message: 'Could not read login verification response.' }));
      if (!response.ok || !verified.success) throw new Error(verified.message || 'login verification failed');
    }
    localStorage.setItem('unetIssuerExampleScopedUserId', scoped);
    localStorage.setItem('unetIssuerExampleAssertion', assertion);
    setScopedUserId(scoped);
    setAssertionJws(assertion);
    setStatus('Connected with a service-scoped U-net ID.');
  }, []);

  const clearStoredSession = useCallback(() => {
    localStorage.removeItem('unetIssuerExampleScopedUserId');
    localStorage.removeItem('unetIssuerExampleAssertion');
    setScopedUserId('');
    setAssertionJws('');
  }, []);

  const requestFromHost = useCallback(async () => {
    if (!window.ReactNativeWebView) {
      setStatus('Open in U-net or sign in below.');
      return undefined;
    }
    try {
      setStatus('Asking U-net for a scoped service session...');
      const result = await callHost('host.createServiceSession');
      const scoped = result?.scopedUserId;
      const assertion = result?.assertionJws;
      if (!scoped) throw new Error('U-net host returned no scoped user ID.');
      if (!assertion) throw new Error('U-net host returned no login assertion.');
      await completeLogin(scoped, assertion, { verify: false });
      return { scopedUserId: scoped, assertionJws: assertion };
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'U-net miniapp login failed.');
      return undefined;
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
    setIsMiniapp(Boolean(window.ReactNativeWebView));
    setBridgeChecked(true);
    const storedScopedUserId = localStorage.getItem('unetIssuerExampleScopedUserId') || '';
    const storedAssertionJws = localStorage.getItem('unetIssuerExampleAssertion') || '';
    if (storedScopedUserId && storedAssertionJws) {
      setScopedUserId(storedScopedUserId);
      setAssertionJws(storedAssertionJws);
    } else {
      localStorage.removeItem('unetIssuerExampleScopedUserId');
      localStorage.removeItem('unetIssuerExampleAssertion');
      setScopedUserId('');
      setAssertionJws('');
    }
    void fetch('/api/verification-checks')
      .then((res) => res.json())
      .then((body) => {
        const next = Array.isArray(body.checks) ? body.checks as VerificationCheck[] : [];
        setChecks(next);
        if (next[0]?.requestType) setRequestType(next[0].requestType);
      })
      .catch((error) => setStatus(error instanceof Error ? `Could not load active checks: ${error.message}` : 'Could not load active checks.'));
  }, []);

  useEffect(() => {
    if (!bridgeChecked || !isMiniapp) return;
    if (scopedUserId && assertionJws) return;
    void requestFromHost();
  }, [assertionJws, bridgeChecked, isMiniapp, requestFromHost, scopedUserId]);

  async function submitRequest() {
    let nextScopedUserId = scopedUserId;
    let nextAssertionJws = assertionJws;
    if (isMiniapp && window.ReactNativeWebView) {
      const refreshed = await requestFromHost();
      if (refreshed?.scopedUserId && refreshed.assertionJws) {
        nextScopedUserId = refreshed.scopedUserId;
        nextAssertionJws = refreshed.assertionJws;
      }
    }
    if (!nextScopedUserId || !nextAssertionJws) {
      setStatus('Sign in first.');
      return;
    }
    setStatus('Creating attestation request...');
    const createRequest = async (scoped: string, assertion: string) => {
      const response = await fetch('/api/issuer/requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scopedUserId: scoped, assertionJws: assertion, requestType, claims: { requestedFrom: 'issuer-example-miniapp' } }),
      });
      const payload = await response.json().catch(() => ({ success: false, message: 'Could not read request response.' }));
      return { response, payload };
    };
    let { response, payload } = await createRequest(nextScopedUserId, nextAssertionJws);
    if (!response.ok && payload?.message === 'login_assertion_expired' && isMiniapp && window.ReactNativeWebView) {
      clearStoredSession();
      const refreshed = await requestFromHost();
      if (refreshed?.scopedUserId && refreshed.assertionJws) {
        ({ response, payload } = await createRequest(refreshed.scopedUserId, refreshed.assertionJws));
      }
    }
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
      {(!scopedUserId || !assertionJws) && isMiniapp && !showBrowserLogin ? (
        <div className="panel stack">
          <h2>Connecting through U-net</h2>
          <p>{status}</p>
          <button onClick={() => void requestFromHost()}>Retry U-net bridge</button>
          <button onClick={() => setShowBrowserLogin(true)}>Use QR login instead</button>
        </div>
      ) : null}
      {(!scopedUserId || !assertionJws) && bridgeChecked && (!isMiniapp || showBrowserLogin) && <LoginPanel onLogin={(scoped, assertion) => { setScopedUserId(scoped); setAssertionJws(assertion); setStatus('Connected with browser U-net login.'); }} />}
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
