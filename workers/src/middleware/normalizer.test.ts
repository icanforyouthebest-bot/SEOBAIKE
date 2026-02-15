import { describe, it, expect } from 'vitest'
import { normalizeLine, normalizeTelegram, normalizeWhatsApp, normalizeMessenger } from './normalizer'

describe('LINE 正規化', () => {
  it('正常文字訊息', () => {
    const body = {
      events: [{
        type: 'message',
        message: { type: 'text', text: '你好', id: 'msg001' },
        source: { userId: 'U123' },
        replyToken: 'token123',
        timestamp: 1700000000000,
      }],
    }
    const msg = normalizeLine(body)
    expect(msg).not.toBeNull()
    expect(msg!.text).toBe('你好')
    expect(msg!.source_user_id).toBe('U123')
    expect(msg!.reply_token).toBe('token123')
  })

  it('空 events 回傳 null', () => {
    expect(normalizeLine({ events: [] })).toBeNull()
  })

  it('非文字訊息回傳 null', () => {
    const body = {
      events: [{
        type: 'message',
        message: { type: 'image' },
        source: { userId: 'U123' },
        replyToken: 'token123',
      }],
    }
    expect(normalizeLine(body)).toBeNull()
  })

  it('缺少 body 不爆炸', () => {
    expect(normalizeLine(null)).toBeNull()
    expect(normalizeLine(undefined)).toBeNull()
    expect(normalizeLine({})).toBeNull()
  })
})

describe('Telegram 正規化', () => {
  it('正常文字訊息', () => {
    const body = {
      message: {
        text: '測試',
        from: { id: 456 },
        chat: { id: 789 },
        message_id: 1001,
        date: 1700000000,
      },
    }
    const msg = normalizeTelegram(body)
    expect(msg).not.toBeNull()
    expect(msg!.text).toBe('測試')
    expect(msg!.chat_id).toBe('789')
  })

  it('無 message 回傳 null', () => {
    expect(normalizeTelegram({})).toBeNull()
    expect(normalizeTelegram({ update_id: 1 })).toBeNull()
  })
})

describe('WhatsApp 正規化', () => {
  it('正常文字訊息', () => {
    const body = {
      entry: [{
        changes: [{
          value: {
            messages: [{
              type: 'text',
              text: { body: 'hello' },
              from: '886912345678',
              id: 'wamid.001',
              timestamp: '1700000000',
            }],
          },
        }],
      }],
    }
    const msg = normalizeWhatsApp(body)
    expect(msg).not.toBeNull()
    expect(msg!.text).toBe('hello')
    expect(msg!.phone_number).toBe('886912345678')
  })

  it('空 entry 回傳 null', () => {
    expect(normalizeWhatsApp({ entry: [] })).toBeNull()
  })
})

describe('Messenger 正規化', () => {
  it('正常文字訊息', () => {
    const body = {
      entry: [{
        messaging: [{
          sender: { id: 'sender123' },
          message: { text: '嗨', mid: 'mid.001' },
          timestamp: 1700000000000,
        }],
      }],
    }
    const msg = normalizeMessenger(body)
    expect(msg).not.toBeNull()
    expect(msg!.text).toBe('嗨')
    expect(msg!.sender_id).toBe('sender123')
  })

  it('空 entry 回傳 null', () => {
    expect(normalizeMessenger({ entry: [] })).toBeNull()
  })
})
