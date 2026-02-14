// WhatsApp Cloud API
export async function replyWhatsApp(
  phoneNumber: string,
  text: string,
  phoneNumberId: string,
  accessToken: string
): Promise<void> {
  await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phoneNumber,
      type: 'text',
      text: { body: text.slice(0, 4096) },
    }),
  })
}
