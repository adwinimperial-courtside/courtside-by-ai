import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: 'Not signed in' });

    const { phone } = await req.json();
    if (!phone || phone.replace(/[^0-9]/g, '').length < 8) {
      return Response.json({ ok: false, error: 'Please enter a valid mobile number with country code.' });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await base44.asServiceRole.entities.User.update(user.id, {
      phone: phone,
      phone_verified: false,
      phone_verify_code: code,
      phone_verify_expires: expires,
    });

    await base44.asServiceRole.integrations.Core.SendSMS({
      to: phone,
      body: `Your Courtside by AI verification code is ${code}. It expires in 10 minutes.`,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ ok: false, error: error.message });
  }
});