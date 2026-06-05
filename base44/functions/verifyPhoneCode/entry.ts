import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: 'Not signed in' });

    const { code } = await req.json();
    const fresh = await base44.asServiceRole.entities.User.get(user.id);

    if (!fresh?.phone_verify_code || !fresh?.phone_verify_expires) {
      return Response.json({ ok: false, error: 'Please request a new code.' });
    }
    if (new Date(fresh.phone_verify_expires) < new Date()) {
      return Response.json({ ok: false, error: 'That code expired. Request a new one.' });
    }
    if (String(code).trim() !== String(fresh.phone_verify_code)) {
      return Response.json({ ok: false, error: 'That code is incorrect.' });
    }

    await base44.asServiceRole.entities.User.update(user.id, {
      phone_verified: true,
      phone_verify_code: "",
      phone_verify_expires: "",
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ ok: false, error: error.message });
  }
});