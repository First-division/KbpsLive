import { createClient } from 'npm:@supabase/supabase-js@2.119.2';
import { createInviteHandler } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const adminSite = Deno.env.get('ADMIN_SITE_URL');
if (!url || !anonKey || !serviceKey || !adminSite) throw new Error('Missing invite-staff server configuration');
const parsedSite = new URL(adminSite);
if (parsedSite.protocol !== 'https:' || parsedSite.origin !== adminSite) {
  throw new Error('ADMIN_SITE_URL must be an HTTPS origin without a trailing slash');
}

const adminClient = createClient(url, serviceKey, { auth: { persistSession: false } });
const userClient = (token: string) => createClient(url, anonKey, {
  global: { headers: { Authorization: `Bearer ${token}` } },
  auth: { persistSession: false },
});

Deno.serve(createInviteHandler({
  origin: adminSite,
  async authenticate(token) {
    const { data, error } = await adminClient.auth.getUser(token);
    return { data: data.user ? { id: data.user.id } : null, error };
  },
  async getRole(token, userId) {
    return await userClient(token).from('profiles').select('role,active').eq('id', userId).maybeSingle();
  },
  async invite(email, redirectTo) {
    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, { redirectTo });
    return { data: data.user ? { id: data.user.id } : null, error };
  },
  async grantAccess(token, id, role) {
    return await userClient(token).rpc('set_staff_access', { target_id: id, new_role: role, new_active: true });
  },
  logError(message, error) { console.error(message, error); },
}));
