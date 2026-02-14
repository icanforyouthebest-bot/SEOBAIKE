// ============================================================
// 指令解析器 — 文字 → command + sub_command + args
// ============================================================

interface ParsedCommand {
  command: string
  sub_command: string | null
  args: Record<string, string>
}

// 指令對照表（自然語言 → 指令）
const ALIASES: Record<string, string> = {
  // Chinese aliases
  '狀態': '/status',
  '系統狀態': '/status',
  '鎖定': '/lock',
  '解鎖': '/unlock',
  '維護': '/maintenance',
  '功能': '/feature',
  '模型': '/ai',
  '用戶': '/users',
  '營收': '/revenue',
  '退款': '/refund',
  '點數': '/points',
  '幫助': '/help',
  '我': '/me',
  '綁定': '/bind',
  '關鍵字': '/keywords',
  '核准': '/approve',
  '同意': '/approve',
  '拒絕': '/reject',
  '待審批': '/pending',
  '審批': '/pending',
}

export function parseCommand(text: string): ParsedCommand {
  const trimmed = text.trim()

  // 1. Check if starts with /
  if (trimmed.startsWith('/')) {
    return parseSlashCommand(trimmed)
  }

  // 2. Check aliases
  const firstWord = trimmed.split(/\s+/)[0]
  if (ALIASES[firstWord]) {
    const rest = trimmed.slice(firstWord.length).trim()
    return parseSlashCommand(ALIASES[firstWord] + (rest ? ' ' + rest : ''))
  }

  // 3. Default: treat as unknown
  return { command: trimmed, sub_command: null, args: {} }
}

function parseSlashCommand(text: string): ParsedCommand {
  const parts = text.split(/\s+/)
  const command = parts[0].toLowerCase()
  const sub_command = parts[1] || null
  const args: Record<string, string> = {}

  // Parse remaining args based on command
  switch (command) {
    case '/feature':
      // /feature on ai_secretary → sub=on, args.key=ai_secretary
      // /feature off boss_mode  → sub=off, args.key=boss_mode
      if (parts[2]) args.key = parts[2]
      break

    case '/ai':
      // /ai switch chat_general gpt-4o → sub=switch, args.route=chat_general, args.model=gpt-4o
      if (sub_command === 'switch') {
        if (parts[2]) args.route = parts[2]
        if (parts[3]) args.model = parts[3]
        if (parts[4]) args.provider = parts[4]
      }
      break

    case '/users':
      // /users ban abc-123 → sub=ban, args.target_id=abc-123
      if (parts[2]) args.target_id = parts[2]
      break

    case '/kyc':
      // /kyc status abc-123 → sub=status, args.target_id=abc-123
      if (parts[2]) args.target_id = parts[2]
      break

    case '/refund':
      // /refund abc-123 → sub=abc-123 (order_id)
      if (sub_command) args.order_id = sub_command
      break

    case '/points':
      // /points grant user-123 500 → sub=grant, args.target_id=user-123, args.amount=500
      if (parts[2]) args.target_id = parts[2]
      if (parts[3]) args.amount = parts[3]
      break

    case '/seo':
      // /seo scan example.com → sub=scan, args.domain=example.com
      if (parts[2]) args.domain = parts[2]
      break

    case '/keywords':
      // /keywords example.com → args.domain=sub_command
      if (sub_command) args.domain = sub_command
      break

    case '/l2':
      if (sub_command === 'list' && parts[2]) args.l1_code = parts[2]
      else if (sub_command && sub_command !== 'list') args.l1_code = sub_command
      break

    case '/l3':
      if (sub_command === 'list' && parts[2]) args.l2_code = parts[2]
      else if (sub_command && sub_command !== 'list') args.l2_code = sub_command
      break

    case '/l4':
      if (sub_command === 'list' && parts[2]) args.l3_code = parts[2]
      else if (sub_command && sub_command !== 'list') args.l3_code = sub_command
      break

    case '/path':
      // /path check l1_id l2_id l3_id l4_id
      if (parts[2]) args.l1_id = parts[2]
      if (parts[3]) args.l2_id = parts[3]
      if (parts[4]) args.l3_id = parts[4]
      if (parts[5]) args.l4_id = parts[5]
      break

    case '/bind':
      // /bind email@example.com
      if (sub_command) args.email = sub_command
      break

    case '/approve':
      // /approve ABC123
      if (sub_command) args.code = sub_command
      break

    case '/reject':
      // /reject ABC123 不需要
      if (sub_command) args.code = sub_command
      if (parts[2]) args.reason = parts.slice(2).join(' ')
      break
  }

  return { command, sub_command, args }
}
