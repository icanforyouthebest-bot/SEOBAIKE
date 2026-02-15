import { describe, it, expect } from 'vitest'
import { parseCommand } from './command-parser'

describe('指令解析器', () => {
  // 基本指令
  it('解析 /status', () => {
    const r = parseCommand('/status')
    expect(r.command).toBe('/status')
  })

  it('解析 /help', () => {
    const r = parseCommand('/help')
    expect(r.command).toBe('/help')
  })

  // 帶子指令
  it('解析 /system info', () => {
    const r = parseCommand('/system info')
    expect(r.command).toBe('/system')
    expect(r.sub_command).toBe('info')
  })

  // 中文別名
  it('解析中文「狀態」→ /status', () => {
    const r = parseCommand('狀態')
    expect(r.command).toBe('/status')
  })

  it('解析中文「幫助」→ /help', () => {
    const r = parseCommand('幫助')
    expect(r.command).toBe('/help')
  })

  it('解析中文「掃描」→ /scan', () => {
    const r = parseCommand('掃描')
    expect(r.command).toBe('/scan')
  })

  // 帶參數
  it('解析 /approve abc-123', () => {
    const r = parseCommand('/approve abc-123')
    expect(r.command).toBe('/approve')
    expect(r.args).toBeDefined()
  })

  it('解析 /reject abc-123 理由', () => {
    const r = parseCommand('/reject abc-123 不同意')
    expect(r.command).toBe('/reject')
  })

  // 空白和邊界
  it('空字串不爆炸', () => {
    const r = parseCommand('')
    expect(r.command).toBeDefined()
  })

  it('純空白不爆炸', () => {
    const r = parseCommand('   ')
    expect(r.command).toBeDefined()
  })

  it('超長字串不爆炸', () => {
    const r = parseCommand('a'.repeat(10000))
    expect(r.command).toBeDefined()
  })

  // 大小寫
  it('/STATUS 轉小寫', () => {
    const r = parseCommand('/STATUS')
    expect(r.command).toBe('/status')
  })
})
