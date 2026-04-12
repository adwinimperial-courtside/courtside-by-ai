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
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
        <div style="background-color: #1e293b; padding: 24px 32px; border-radius: 8px 8px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px;">Courtside by AI</h1>
          <p style="color: #94a3b8; margin: 4px 0 0; font-size: 13px;">Basketball League Intelligence</p>
        </div>
        <div style="background-color: #ffffff; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; margin-top: 0;">Hi ${name ? name : 'there'},</p>
          <p style="font-size: 15px; line-height: 1.6;">Your access to <strong>Courtside by AI</strong> has been approved.</p>
          <div style="margin: 28px 0; text-align: center;">
            <a href="https://www.courtside-by-ai.com" style="background-color: #f97316; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-size: 15px; font-weight: bold;">Log In Now</a>
          </div>
          <p style="font-size: 14px; line-height: 1.7; color: #475569;">
            After logging in, you will be directed automatically to complete the next step by selecting your role and league.
            This helps ensure you are placed in the correct league environment and can access the right features and information.
          </p>
          <p style="font-size: 15px;">Welcome to Courtside by AI!</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 13px; color: #94a3b8; margin: 0;">Best regards,<br/><strong style="color: #475569;">Courtside by AI</strong><br/>Made in Finland 🇫🇮</p>
        </div>
      </div>
    `,
  });

  return Response.json({ success: true });
});