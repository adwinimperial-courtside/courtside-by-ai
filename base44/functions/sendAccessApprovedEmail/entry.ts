import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin' && user?.user_type !== 'app_admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { email, name } = await req.json();
  if (!email) return Response.json({ error: 'Email is required' }, { status: 400 });

  const greeting = name ? `Hi ${name},` : 'Hi,';

  await base44.asServiceRole.integrations.Core.SendEmail({
    to: email,
    from_name: 'Courtside by AI',
    subject: 'Your Courtside by AI access has been approved',
    body: `${greeting}

Your access to Courtside by AI has been approved.

You can now log in to the platform here:
www.courtside-by-ai.com

After logging in, you will be directed automatically to complete the next step by selecting your role and league.

This helps ensure you are placed in the correct league environment and can access the right features and information.

Welcome to Courtside by AI.

Best regards,
Courtside by AI
Basketball League Intelligence
Made in Finland`,
  });

  return Response.json({ success: true });
});