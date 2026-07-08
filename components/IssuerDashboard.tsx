'use client';

import { useCallback, useEffect, useState } from 'react';
import { LoginPanel } from './LoginPanel';

type RequestItem = { requestId: string; scopedUserId?: string; userId?: string; requestType: string; status: string; createdAt?: string; attestationHash?: string };
type AttestationItem = { attestationHash: string; requestType?: string; status: string; userId?: string; scopedUserId?: string; issuedAt?: string };

export function IssuerDashboard({ initialTab }: { initialTab: 'requests' | 'attestations' }) {
  const [scopedUserId, setScopedUserId] = useState('');
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [attestations, setAttestations] = useState<AttestationItem[]>([]);
  const [status, setStatus] = useState('');

  useEffect(() => {
    setScopedUserId(localStorage.getItem('unetIssuerExampleScopedUserId') || '');
  }, []);

  const load = useCallback(async () => {
    const [req, att] = await Promise.all([
      fetch('/api/issuer/requests?status=pending').then((res) => res.json()),
      fetch('/api/issuer/attestations').then((res) => res.json()),
    ]);
    setRequests(req.requests ?? []);
    setAttestations(att.attestations ?? []);
  }, []);

  useEffect(() => { if (scopedUserId) void load(); }, [scopedUserId, load]);

  async function decide(requestId: string, decision: 'approve' | 'deny') {
    setStatus(`${decision}...`);
    const response = await fetch(`/api/issuer/requests/${encodeURIComponent(requestId)}/decision`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision, reason: decision === 'deny' ? 'Denied by issuer' : undefined }),
    });
    const payload = await response.json();
    setStatus(response.ok ? 'Updated.' : (payload.message || 'Decision failed'));
    await load();
  }

  async function revoke(attestationHash: string) {
    setStatus('Revoking...');
    const response = await fetch(`/api/issuer/attestations/${encodeURIComponent(attestationHash)}/revoke`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'Revoked from issuer example dashboard' }),
    });
    const payload = await response.json();
    setStatus(response.ok ? 'Revoked.' : (payload.message || 'Revoke failed'));
    await load();
  }

  if (!scopedUserId) return <LoginPanel onLogin={(scoped) => setScopedUserId(scoped)} />;

  return (
    <div className="stack">
      <div className="panel row">
        <div>
          <span className="pill">Issuer dashboard</span>
          <h1 style={{ fontSize: 42 }}>Authority Portal</h1>
          <p className="code">{scopedUserId}</p>
        </div>
        <button className="secondary" onClick={load}>Refresh</button>
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
