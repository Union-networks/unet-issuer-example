'use client';

import { useCallback, useEffect, useState } from 'react';
import { LoginPanel } from './LoginPanel';

type RequestItem = { requestId: string; scopedUserId?: string; userId?: string; requestType: string; status: string; createdAt?: string; attestationHash?: string };
type AttestationItem = { attestationHash: string; requestType?: string; status: string; userId?: string; scopedUserId?: string; issuedAt?: string };
type ApiPayload = { success?: boolean; message?: string; errorCode?: string; authenticated?: boolean; scopedUserId?: string; requests?: RequestItem[]; attestations?: AttestationItem[] };

const issuerErrorMessage = (payload: ApiPayload, fallback: string) => {
  if (payload.errorCode === 'issuer_key_not_registered') {
    return 'No active issuer key is registered for this attestation type. Create or rotate its issuer keys in the U-net domain dashboard, then update UNET_ISSUER_SIGNERS_JSON with that exact key set.';
  }
  if (payload.errorCode === 'credential_issuer_key_mismatch') {
    return 'The credential signing key does not match the active key for this attestation type. Update UNET_ISSUER_SIGNERS_JSON with the latest exported key set.';
  }
  return payload.errorCode ? `${payload.errorCode}: ${payload.message || fallback}` : (payload.message || fallback);
};

export function IssuerDashboard({ initialTab }: { initialTab: 'requests' | 'attestations' }) {
  const [scopedUserId, setScopedUserId] = useState('');
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [attestations, setAttestations] = useState<AttestationItem[]>([]);
  const [status, setStatus] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);

  const clearLogin = useCallback((message = '') => {
    localStorage.removeItem('unetIssuerAdminScopedUserId');
    setScopedUserId('');
    setRequests([]);
    setAttestations([]);
    setStatus(message);
  }, []);

  const completeLogin = useCallback((scoped: string) => {
    localStorage.setItem('unetIssuerAdminScopedUserId', scoped);
    setScopedUserId(scoped);
    setStatus('');
  }, []);

  const parseJson = async (response: Response): Promise<ApiPayload> => response.json().catch(() => ({ success: false, message: 'Could not read server response.' }));

  const authFetch = useCallback(async (url: string, init: RequestInit = {}) => {
    const response = await fetch(url, { ...init, credentials: 'same-origin' });
    const payload = await parseJson(response);
    const sessionFailure = response.status === 401 && (
      payload.errorCode === 'issuer_admin_session_required' ||
      payload.message === 'assertionJws is required' ||
      payload.message === 'issuer_admin_not_authorized'
    );
    if (sessionFailure) {
      clearLogin('Your session expired. Sign in again.');
      throw new Error('session_expired');
    }
    return { response, payload };
  }, [clearLogin]);

  useEffect(() => {
    let cancelled = false;
    const storedScopedUserId = localStorage.getItem('unetIssuerAdminScopedUserId') || '';
    setStatus('Checking session...');
    fetch('/api/login/verify', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then(async (response) => ({ response, payload: await parseJson(response) }))
      .then(({ response, payload }) => {
        if (cancelled) return;
        if (!response.ok || payload.success === false || !payload.authenticated || !payload.scopedUserId) {
          clearLogin(storedScopedUserId ? 'Your session expired. Sign in again.' : '');
          return;
        }
        localStorage.setItem('unetIssuerAdminScopedUserId', payload.scopedUserId);
        setScopedUserId(payload.scopedUserId);
        setStatus('');
      })
      .catch(() => {
        if (!cancelled) clearLogin('Your session expired. Sign in again.');
      })
      .finally(() => {
        if (!cancelled) setCheckingSession(false);
      });
    return () => { cancelled = true; };
  }, [clearLogin]);

  const load = useCallback(async () => {
    if (!scopedUserId) return;
    try {
      const [req, att] = await Promise.all([
        authFetch('/api/issuer/requests?status=pending'),
        authFetch('/api/issuer/attestations'),
      ]);
      if (req.payload.success === false) setStatus(req.payload.message || 'Could not load requests.');
      if (att.payload.success === false) setStatus(att.payload.message || 'Could not load attestations.');
      setRequests(req.payload.requests ?? []);
      setAttestations(att.payload.attestations ?? []);
    } catch (error) {
      if (error instanceof Error && error.message === 'session_expired') return;
      setStatus(error instanceof Error ? error.message : 'Could not load issuer dashboard.');
    }
  }, [scopedUserId, authFetch]);

  useEffect(() => { if (scopedUserId) void load(); }, [scopedUserId, load]);

  async function signOut() {
    await fetch('/api/login/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => undefined);
    clearLogin('Signed out.');
  }

  async function decide(requestId: string, decision: 'approve' | 'deny') {
    setStatus(`${decision}...`);
    try {
      const { response, payload } = await authFetch(`/api/issuer/requests/${encodeURIComponent(requestId)}/decision`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision, reason: decision === 'deny' ? 'Denied by issuer' : undefined }),
      });
      setStatus(response.ok ? 'Updated.' : issuerErrorMessage(payload, 'Decision failed'));
      await load();
    } catch (error) {
      if (error instanceof Error && error.message === 'session_expired') return;
      setStatus(error instanceof Error ? error.message : 'Decision failed');
    }
  }

  async function revoke(attestationHash: string) {
    setStatus('Revoking...');
    try {
      const { response, payload } = await authFetch(`/api/issuer/attestations/${encodeURIComponent(attestationHash)}/revoke`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'Revoked from issuer example dashboard' }),
      });
      setStatus(response.ok ? 'Revoked.' : issuerErrorMessage(payload, 'Revoke failed'));
      await load();
    } catch (error) {
      if (error instanceof Error && error.message === 'session_expired') return;
      setStatus(error instanceof Error ? error.message : 'Revoke failed');
    }
  }

  if (checkingSession) return <div className="panel"><p>Checking issuer session...</p></div>;
  if (!scopedUserId) return <LoginPanel purpose="issuer-admin" onLogin={completeLogin} />;

  return (
    <div className="stack">
      <div className="panel row">
        <div>
          <span className="pill">Issuer dashboard</span>
          <h1 style={{ fontSize: 42 }}>Authority Portal</h1>
          <p className="code">{scopedUserId}</p>
        </div>
        <div className="row">
          <button className="secondary" onClick={load}>Refresh</button>
          <button className="secondary" onClick={() => void signOut()}>Sign out</button>
        </div>
      </div>
      <div className="grid">
        <a className="panel" href="/issuer/requests"><h3>Requests</h3><p>{requests.length} pending</p></a>
        <a className="panel" href="/issuer/attestations"><h3>Attestations</h3><p>{attestations.length} issued</p></a>
      </div>
      {initialTab === 'requests' ? (
        <div className="panel stack">
          <h2>Pending requests</h2>
          {requests.length === 0 ? <p>No pending requests.</p> : requests.map((item) => (
            <div className="panel stack" key={item.requestId}>
              <div className="row"><strong>{item.requestType}</strong><span className="pill">{item.status}</span></div>
              <p className="code">{item.scopedUserId || item.userId}</p>
              <p className="code">{item.requestId}</p>
              <div className="row"><button onClick={() => decide(item.requestId, 'approve')}>Approve</button><button className="secondary" onClick={() => decide(item.requestId, 'deny')}>Deny</button></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="panel stack">
          <h2>Issued attestations</h2>
          {attestations.length === 0 ? <p>No issued attestations yet.</p> : attestations.map((item) => (
            <div className="panel stack" key={item.attestationHash}>
              <div className="row"><strong>{item.requestType || 'attestation'}</strong><span className="pill">{item.status}</span></div>
              <p className="code">{item.attestationHash}</p>
              <button className="secondary" onClick={() => revoke(item.attestationHash)}>Revoke</button>
            </div>
          ))}
        </div>
      )}
      <p className="status">{status}</p>
    </div>
  );
}
