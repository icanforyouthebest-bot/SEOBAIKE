// Telegram Bot API
export interface TelegramButton {
  text: string
  callback_data: string
}

export interface TelegramReplyOptions {
  text: string
  buttons?: TelegramButton[][]
}

export async function replyTelegram(
  chatId: string,
  textOrOpts: string | TelegramReplyOptions,
  botToken: string
): Promise<void> {
  const opts = typeof textOrOpts === 'string' ? { text: textOrOpts } : textOrOpts
  const payload: any = {
    chat_id: chatId,
    text: opts.text.slice(0, 4096),
  }
  if (opts.buttons?.length) {
    payload.reply_markup = {
      inline_keyboard: opts.buttons,
    }
  }
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function answerCallback(
  callbackId: string,
  botToken: string,
  text?: string
): Promise<void> {
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackId,
      text: text || '',
    }),
  })
}
