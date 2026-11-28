import React, { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { StaffManagement } from './StaffManagement';
import './style.css';

type Role = 'admin' | 'editor';
type Theme = 'system' | 'light' | 'dark';
type Icon = 'child' | 'microphone' | 'star' | 'music';
type Show = {
  id: string;
  name: string;
  day: string;
  time: string;
  icon: Icon;
  active: boolean;
  sort_order: number;
};
type ShowInput = Omit<Show, 'id'>;

const emptyShow: ShowInput = { name: '', day: '', time: '', icon: 'music', active: true, sort_order: 0 };
const initialLinkType = new URLSearchParams(window.location.hash.slice(1)).get('type');
const themeStorageKey = 'kbps-admin-theme';
const staffManagementEnabled = import.meta.env.VITE_ENABLE_STAFF_MANAGEMENT === 'true';
const googleSignInEnabled = import.meta.env.VITE_ENABLE_GOOGLE_SIGN_IN === 'true';
const oauthQuery = new URLSearchParams(window.location.search);
const oauthHash = new URLSearchParams(window.location.hash.slice(1));
const oauthError = googleSignInEnabled
  ? oauthQuery.get('error_description') || oauthHash.get('error_description')
  : null;

function initialTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(themeStorageKey);
    if (saved === 'system' || saved === 'light' || saved === 'dark') return saved;
  } catch (error) {
    console.warn('Could not read the theme preference:', error);
  }
  return 'system';
}

function makeClient(): { client: SupabaseClient | null; error: string | null } {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return { client: null, error: 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before building the admin site.' };
  try {
    return { client: createClient(url, key), error: null };
  } catch (error) {
    return { client: null, error: `Invalid Supabase configuration: ${message(error)}` };
  }
}

function message(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message;
  return String(error);
}

const config = makeClient();

function App() {
  const client = config.client;
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [setPassword, setSetPassword] = useState(initialLinkType === 'invite' || initialLinkType === 'recovery');
  const [email, setEmail] = useState('');
  const [password, setPasswordValue] = useState('');
  const [role, setRole] = useState<Role | null>(null);
  const [shows, setShows] = useState<Show[]>([]);
  const [form, setForm] = useState<ShowInput>(emptyShow);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(config.error || (oauthError ? `Sign in failed: ${oauthError}` : null));
  const [notice, setNotice] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      document.documentElement.dataset.theme = theme === 'system'
        ? (preference.matches ? 'dark' : 'light')
        : theme;
    };
    applyTheme();
    if (theme === 'system') preference.addEventListener('change', applyTheme);
    return () => preference.removeEventListener('change', applyTheme);
  }, [theme]);

  function chooseTheme(next: Theme) {
    setTheme(next);
    try {
      window.localStorage.setItem(themeStorageKey, next);
    } catch (storageError) {
      console.warn('Could not save the theme preference:', storageError);
    }
  }

  useEffect(() => {
    if (!client) {
      setInitializing(false);
      return;
    }
    let active = true;
    const { data: { subscription } } = client.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setSetPassword(true);
      setSession(next);
      if (!next) {
        setRole(null);
        setShows([]);
        setEditing(null);
        setForm(emptyShow);
      }
    });
    void client.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session);
      setInitializing(false);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [client]);

  const loadShows = useCallback(async () => {
    if (!client) return;
    const { data, error: queryError } = await client.from('shows')
      .select('id,name,day,time,icon,active,sort_order').order('sort_order').order('id');
    if (queryError) throw queryError;
    setShows(data as Show[]);
  }, [client]);

  useEffect(() => {
    if (!client || !session) return;
    let active = true;
    setRole(null);
    setShows([]);
    void (async () => {
      if (googleSignInEnabled) {
        const { error: claimError } = await client.rpc('claim_google_staff');
        if (!active) return;
        if (claimError) {
          setError(`Could not check Google staff access: ${claimError.message}`);
          return;
        }
      }
      const { data, error: profileError } = staffManagementEnabled
        ? await client.from('profiles').select('role,active').eq('id', session.user.id).maybeSingle()
        : await client.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
      if (!active) return;
      if (profileError) {
        setError(profileError.message);
        return;
      }
      if ((data?.role !== 'admin' && data?.role !== 'editor') ||
          (staffManagementEnabled && (!('active' in data) || data.active !== true))) {
        setError('This account has no staff role. Ask a station admin to grant access.');
        return;
      }
      const { data: rows, error: showsError } = await client.from('shows')
        .select('id,name,day,time,icon,active,sort_order').order('sort_order').order('id');
      if (!active) return;
      if (showsError) {
        setError(showsError.message);
        return;
      }
      setRole(data.role);
      setShows(rows as Show[]);
      setError(null);
    })();
    return () => { active = false; };
  }, [client, session?.user.id]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    if (!client) return;
    setBusy(true);
    setError(null);
    const { error: authError } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) setError(authError.message);
    else setPasswordValue('');
    setBusy(false);
  }

  async function signInWithGoogle() {
    if (!client) return;
    setBusy(true);
    setError(null);
    const { error: authError } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (authError) {
      setError(authError.message);
      setBusy(false);
    }
  }

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    if (!client) return;
    setBusy(true);
    setError(null);
    const { error: authError } = await client.auth.updateUser({ password });
    if (authError) setError(authError.message);
    else {
      setPasswordValue('');
      setSetPassword(false);
      setNotice('Password saved.');
      window.history.replaceState(null, '', window.location.pathname);
    }
    setBusy(false);
  }

  async function signOut() {
    if (!client) return;
    setBusy(true);
    const { error: authError } = await client.auth.signOut();
    if (authError) setError(authError.message);
    else {
      setSetPassword(false);
      setNotice(null);
      setError(null);
    }
    setBusy(false);
  }

  async function saveShow(event: React.FormEvent) {
    event.preventDefault();
    if (!client) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const values = { ...form, name: form.name.trim(), day: form.day.trim(), time: form.time.trim() };
    if (!values.name || !values.day || !values.time || !Number.isInteger(values.sort_order)) {
      setError('Name, day, time, and a whole-number order are required.');
      setBusy(false);
      return;
    }
    try {
      const query = editing
        ? client.from('shows').update(values).eq('id', editing)
        : client.from('shows').insert(values);
      const { error: saveError } = await query.select('id').single();
      if (saveError) throw saveError;
      setForm(emptyShow);
      setEditing(null);
      setNotice('Show saved. Listeners will see the change when the schedule refreshes.');
      await loadShows();
    } catch (saveError) {
      setError(`Could not save or reload the schedule: ${message(saveError)}`);
    } finally {
      setBusy(false);
    }
  }

  async function deleteShow(show: Show) {
    if (!client || !window.confirm(`Permanently delete "${show.name}"? You can disable it instead.`)) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { error: deleteError } = await client.from('shows').delete().eq('id', show.id).select('id').single();
      if (deleteError) throw deleteError;
      if (editing === show.id) {
        setEditing(null);
        setForm(emptyShow);
      }
      setNotice('Show deleted.');
      await loadShows();
    } catch (deleteError) {
      setError(`Could not delete or reload the schedule: ${message(deleteError)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <header>
        <div><p className="eyebrow">AM 1450 KBPS</p><h1>Schedule admin</h1></div>
        <div className="header-controls">
          <div className="theme-controls" role="group" aria-label="Color theme">
            <button type="button" aria-pressed={theme === 'system'} onClick={() => chooseTheme('system')}>System</button>
            <button type="button" aria-pressed={theme === 'light'} onClick={() => chooseTheme('light')}>Light</button>
            <button type="button" aria-pressed={theme === 'dark'} onClick={() => chooseTheme('dark')}>Dark</button>
          </div>
          {session && <button className="secondary" disabled={busy} onClick={() => void signOut()}>Sign out</button>}
        </div>
      </header>
      {error && <p className="alert" role="alert">{error}</p>}
      {notice && <p className="notice" role="status">{notice}</p>}
      {initializing ? <p>Loading…</p> : !client ? null : !session ? (
        <section>
          <h2>Staff sign in</h2>
          <p>Only approved station staff can edit the schedule.</p>
          <form onSubmit={signIn}>
            <label>Email<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPasswordValue(e.target.value)} /></label>
            <button disabled={busy}>Sign in</button>
          </form>
          {googleSignInEnabled && <div className="google-sign-in">
            <p>Already approved for staff access?</p>
            <button type="button" className="secondary" disabled={busy} onClick={() => void signInWithGoogle()}>Sign in with Google</button>
          </div>}
        </section>
      ) : setPassword ? (
        <section>
          <h2>Set your password</h2>
          <form onSubmit={savePassword}>
            <label>New password<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPasswordValue(e.target.value)} /></label>
            <button disabled={busy}>Save password</button>
          </form>
        </section>
      ) : role ? (
        <>
          <p>Signed in as {session.user.email} · {role}. Changes go live when listeners refresh their schedule.</p>
          <section>
            <h2>{editing ? 'Edit show' : 'Add a show'}</h2>
            <form onSubmit={saveShow} className="grid">
              <label>Show name<input maxLength={120} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label>Days<input maxLength={80} required placeholder="e.g. Mon–Fri" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} /></label>
              <label>Time<input maxLength={80} required placeholder="e.g. 8:30 AM – 3:30 PM" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></label>
              <label>Icon<select value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value as Icon })}>
                <option value="music">Music</option><option value="microphone">Microphone</option><option value="star">Star</option><option value="child">People</option>
              </select></label>
              <label>Display order<input type="number" min="0" max="100000" step="1" required value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.valueAsNumber })} /><small>Lower numbers appear first.</small></label>
              <label className="checkbox"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />Visible to listeners</label>
              <div className="actions"><button disabled={busy}>{editing ? 'Save changes' : 'Add show'}</button>
                {editing && <button type="button" className="secondary" disabled={busy} onClick={() => { setEditing(null); setForm(emptyShow); }}>Cancel edit</button>}</div>
            </form>
          </section>
          <section>
            <h2>Shows</h2>
            {shows.length === 0 && <p>No shows yet.</p>}
            <ul className="shows">{shows.map((show) => (
              <li key={show.id}>
                <div><strong>{show.name}</strong><p>{show.day} · {show.time} · Order {show.sort_order} · {show.active ? 'Visible' : 'Hidden'}</p></div>
                <div className="actions">
                  <button className="secondary" disabled={busy} onClick={() => { const { id, ...values } = show; setEditing(id); setForm(values); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>
                  {role === 'admin' && <button className="danger" disabled={busy} onClick={() => void deleteShow(show)}>Delete</button>}
                </div>
              </li>
            ))}</ul>
          </section>
          {staffManagementEnabled && role === 'admin' && <StaffManagement client={client} userId={session.user.id} />}
        </>
      ) : <p>{error ? 'Staff access could not be loaded.' : 'Checking staff access…'}</p>}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
