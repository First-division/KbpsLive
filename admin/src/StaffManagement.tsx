import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { type SupabaseClient } from '@supabase/supabase-js';

type Role = 'admin' | 'editor';
type Staff = {
  id: string;
  email: string;
  role: Role;
  active: boolean;
  invited_at: string | null;
  email_confirmed_at: string | null;
};
type Approval = { email: string; role: Role; active: boolean; user_id: string | null };

function errorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message;
  return String(error);
}

export function StaffManagement({ client, userId }: { client: SupabaseClient; userId: string }) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('editor');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadStaff = useCallback(async () => {
    const { data, error: loadError } = await client.rpc('list_staff');
    if (loadError) throw loadError;
    setStaff(data as Staff[]);
    const { data: approved, error: approvalError } = await client.rpc('list_google_approvals');
    if (approvalError) throw approvalError;
    setApprovals(approved as Approval[]);
  }, [client]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data, error: loadError } = await client.rpc('list_staff');
      if (!active) return;
      if (loadError) { setError(`Could not load staff: ${loadError.message}`); return; }
      const { data: approved, error: approvalError } = await client.rpc('list_google_approvals');
      if (!active) return;
      if (approvalError) { setError(`Could not load approvals: ${approvalError.message}`); return; }
      setStaff(data as Staff[]);
      setApprovals(approved as Approval[]);
    })();
    return () => { active = false; };
  }, [client]);

  async function approve(event: FormEvent) {
    event.preventDefault();
    if (!window.confirm(`Approve ${email.trim()} for ${role} access using Google sign-in?`)) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { error: approveError } = await client.rpc('approve_google_staff', { staff_email: email.trim(), staff_role: role });
      if (approveError) throw approveError;
      setEmail('');
      setRole('editor');
      setNotice('Approved. Share the admin website link with the staff member; no email was sent.');
      await loadStaff();
    } catch (approveError) {
      setError(`Could not approve staff: ${errorMessage(approveError)}`);
    } finally {
      setBusy(false);
    }
  }

  async function changeApproval(person: Approval, nextRole: Role, active: boolean) {
    if (!window.confirm(`Update access for ${person.email}?`)) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { error: accessError } = await client.rpc('set_google_approval_access', {
        staff_email: person.email, new_role: nextRole, new_active: active,
      });
      if (accessError) throw accessError;
      setNotice('Staff access updated.');
      await loadStaff();
    } catch (accessError) {
      setError(`Could not update staff access: ${errorMessage(accessError)}`);
    } finally {
      setBusy(false);
    }
  }

  async function changeAccess(person: Staff, nextRole: Role, active: boolean) {
    const action = !active ? 'revoke access for' : !person.active ? 'restore access for' : `change the role of`;
    if (!window.confirm(`Are you sure you want to ${action} ${person.email}${active ? ` to ${nextRole}` : ''}?`)) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { error: accessError } = await client.rpc('set_staff_access', {
        target_id: person.id, new_role: nextRole, new_active: active,
      });
      if (accessError) throw accessError;
      setNotice('Staff access updated.');
      await loadStaff();
    } catch (accessError) {
      setError(`Could not update staff access: ${errorMessage(accessError)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2>Staff management</h2>
      <p>Approve a Google account, then share this website link with the staff member. No email is sent. Revoking access stops editing but keeps the account.</p>
      {error && <p className="alert" role="alert">{error}</p>}
      {notice && <p className="notice" role="status">{notice}</p>}
      <form className="grid" onSubmit={(event) => void approve(event)}>
        <label>Google account email<input type="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Access role<select value={role} onChange={(event) => setRole(event.target.value as Role)}>
          <option value="editor">Editor</option><option value="admin">Admin</option>
        </select></label>
        <div className="actions"><button disabled={busy}>Approve staff</button></div>
      </form>
      <h3>Approved Google accounts</h3>
      {approvals.length === 0 && !error && <p>No Google accounts approved yet.</p>}
      <ul className="shows">{approvals.map((person) => (
        <li key={person.email}>
          <div><strong>{person.email}</strong><p>{person.role} · {person.active ? 'Access active' : 'Access revoked'} · {person.user_id ? 'Signed in' : 'Not yet signed in'}</p></div>
          {person.user_id !== userId && <div className="actions">
            {person.active && <button className="secondary" disabled={busy} onClick={() => void changeApproval(person, person.role === 'admin' ? 'editor' : 'admin', true)}>Make {person.role === 'admin' ? 'editor' : 'admin'}</button>}
            <button className={person.active ? 'danger' : 'secondary'} disabled={busy} onClick={() => void changeApproval(person, person.role, !person.active)}>{person.active ? 'Revoke access' : 'Restore access'}</button>
          </div>}
        </li>
      ))}</ul>
      <h3>Staff accounts</h3>
      {staff.length === 0 && !error && <p>No staff accounts found.</p>}
      <ul className="shows">{staff.filter((person) => !approvals.some((approval) => approval.user_id === person.id)).map((person) => (
        <li key={person.id}>
          <div>
            <strong>{person.email}</strong>
            <p>{person.role} · {person.active ? 'Access active' : 'Access revoked'}
              {person.invited_at && !person.email_confirmed_at ? ' · Invitation pending' : ''}
              {person.id === userId ? ' · You' : ''}
            </p>
          </div>
          {person.id !== userId && <div className="actions">
            {person.active && <button className="secondary" disabled={busy} onClick={() => void changeAccess(person, person.role === 'admin' ? 'editor' : 'admin', true)}>
              Make {person.role === 'admin' ? 'editor' : 'admin'}
            </button>}
            <button className={person.active ? 'danger' : 'secondary'} disabled={busy} onClick={() => void changeAccess(person, person.role, !person.active)}>
              {person.active ? 'Revoke access' : 'Restore access'}
            </button>
          </div>}
        </li>
      ))}</ul>
    </section>
  );
}
