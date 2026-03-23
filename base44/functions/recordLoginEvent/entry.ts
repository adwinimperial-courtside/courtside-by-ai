import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service role to write the login event (bypasses entity permissions)
    await base44.asServiceRole.entities.LoginEvent.create({
      user_id: user.id,
      user_email: user.email,
      full_name: user.full_name,
      user_type: user.data?.user_type || 'unknown',
      logged_at: new Date().toISOString(),
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});