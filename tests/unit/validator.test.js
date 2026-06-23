const { extractTextEvent, normalizeExtractedTask, isTaskRegisterable } = require('../../src/utils/validator');

describe('extractTextEvent', () => {
  test('正常な text イベントを抽出', () => {
    const ev = {
      type: 'message',
      message: { type: 'text', text: '  hello  ' },
      replyToken: 'tok',
      source: { userId: 'U1' },
    };
    expect(extractTextEvent(ev)).toEqual({ text: 'hello', replyToken: 'tok', userId: 'U1' });
  });

  test('text 以外は null', () => {
    expect(extractTextEvent({ type: 'message', message: { type: 'image' } })).toBeNull();
    expect(extractTextEvent({ type: 'follow' })).toBeNull();
    expect(extractTextEvent(null)).toBeNull();
  });

  test('空テキストや replyToken 欠損は null', () => {
    expect(extractTextEvent({ type: 'message', message: { type: 'text', text: '' }, replyToken: 't' })).toBeNull();
    expect(extractTextEvent({ type: 'message', message: { type: 'text', text: 'a' } })).toBeNull();
  });
});

describe('normalizeExtractedTask', () => {
  test('正常値はそのまま', () => {
    expect(normalizeExtractedTask({ task: 'A', assignee: 'B', deadline: '2026-05-10', area: 'C' })).toEqual({
      task: 'A',
      assignee: 'B',
      deadline: '2026-05-10',
      area: 'C',
    });
  });

  test('不正な deadline は null', () => {
    expect(normalizeExtractedTask({ task: 'A', deadline: 'tomorrow' }).deadline).toBeNull();
  });

  test('null/undefined 入力でも壊れない', () => {
    expect(normalizeExtractedTask(null)).toEqual({ task: null, assignee: null, deadline: null, area: null });
    expect(normalizeExtractedTask({})).toEqual({ task: null, assignee: null, deadline: null, area: null });
  });
});

describe('isTaskRegisterable', () => {
  test('task があれば true', () => {
    expect(isTaskRegisterable({ task: 'a' })).toBe(true);
  });
  test('task がなければ false', () => {
    expect(isTaskRegisterable({ task: null })).toBe(false);
    expect(isTaskRegisterable(null)).toBe(false);
  });
});
