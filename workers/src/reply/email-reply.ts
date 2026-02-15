// ============================================================
// Email — 回覆訊息（透過 SendGrid / Mailgun API）
// ============================================================

export async function replyEmail(
  toEmail: string,
  subject: string,
  text: string,
  apiKey: string,
  fromEmail: string = 'ai@aiforseo.vip'
): Promise<void> {
  // SendGrid v3 API
  await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: toEmail }] }],
      from: { email: fromEmail, name: 'SEOBAIKE AI' },
      subject: `Re: ${subject}`,
      content: [
        { type: 'text/plain', value: text + '\n\n— SEOBAIKE AI' },
      ],
    }),
  })
}
