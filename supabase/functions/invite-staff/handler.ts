type Role = 'admin' | 'editor';
type Result<T> = { data: T; error: { message: string } | null };

export type InviteDependencies = {
  origin: string;
  authenticate: (token: string) => Promise<Result<{ id: string } | null>>;
  getRole: (token: string, userId: string) => Promise<Result<{ role: string; active: boolean } | null>>;
  invite: (email: string, redirectTo: string) => Promise<Result<{ id: string } | null>>;
  grantAccess: (token: string, id: string, role: Role) => Promise<{ error: { message: string } | null }>;
  logError: (message: string, error: unknown) => void;
};

export function createInviteHandler(deps: InviteDependencies) {
  return async (request: Request): Promise<Response> => {
    const requestOrigin = request.headers.get('origin');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Vary': 'Origin',
    };
    if (requestOrigin === deps.origin) {
      headers['Access-Control-Allow-Origin'] = deps.origin;
      headers['Access-Control-Allow-Headers'] = 'authorization, x-client-info, apikey, content-type';
      headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    }
    const respond = (status: number, error: string) => new Response(JSON.stringify({ error }), { status, headers });
    if (request.method === 'OPTIONS') {
      return requestOrigin === deps.origin
        ? new Response(null, { status: 204, headers })
        : respond(403, 'Origin not allowed');
    }
    if (request.method !== 'POST') return respond(405, 'Method not allowed');
    if (requestOrigin && requestOrigin !== deps.origin) return respond(403, 'Origin not allowed');
    const match = /^Bearer ([^\s]+)$/i.exec(request.headers.get('authorization') ?? '');
    if (!match) return respond(401, 'Sign in to continue');
    const token = match[1];
    try {
      const identity = await deps.authenticate(token);
      if (identity.error || !identity.data) return respond(401, 'Invalid or expired session');
      const staff = await deps.getRole(token, identity.data.id);
      if (staff.error) {
        deps.logError('Unable to verify staff access', staff.error);
        return respond(500, 'Could not verify staff access');
      }
      if (!staff.data?.active || staff.data.role !== 'admin') return respond(403, 'Administrator access required');

      let payload: unknown;
      try {
        payload = await request.json();
      } catch {
        return respond(400, 'Request must be valid JSON');
      }
      if (typeof payload !== 'object' || payload === null || !('email' in payload) || !('role' in payload)) {
        return respond(400, 'Email and role are required');
      }
      const { email, role } = payload;
      if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
          (role !== 'admin' && role !== 'editor')) {
        return respond(400, 'Enter a valid email address and role');
      }
      const invitation = await deps.invite(email.trim(), deps.origin);
      if (invitation.error || !invitation.data) {
        deps.logError('Staff invitation failed', invitation.error);
        return respond(502, 'Invitation could not be sent. Check email configuration and whether the account already exists.');
      }
      const access = await deps.grantAccess(token, invitation.data.id, role);
      if (access.error) {
        deps.logError('Invitation sent but role assignment failed', access.error);
        return respond(500, 'The invitation may have been sent, but access was not assigned. Contact the project owner before retrying.');
      }
      return new Response(JSON.stringify({ success: true }), { status: 200, headers });
    } catch (error) {
      deps.logError('Unexpected staff invitation failure', error);
      return respond(500, 'Could not complete the invitation. Check server logs before retrying.');
    }
  };
}
