const { maskPII, isDataQuery, checkRateLimit, isJuniorMention } = require('../../src/utils/security');

describe('maskPII', () => {
  test('電話番号をマスク', () => {
    expect(maskPII('090-1234-5678に電話して')).toBe('***-****-****に電話して');
    expect(maskPII('06 1234 5678です')).toBe('***-****-****です');
  });

  test('メールアドレスをマスク', () => {
    expect(maskPII('test@example.com に送って')).toBe('****@****.*** に送って');
    expect(maskPII('foo.bar+tag@sub.domain.co.jp')).toBe('****@****.***');  // 多段ドメインも全体マスク
  });

  test('郵便番号をマスク', () => {
    expect(maskPII('〒630-8501 奈良市')).toBe('〒***-**** 奈良市');
    expect(maskPII('630-8501')).toBe('〒***-****');
  });

  test('PII のないテキストはそのまま', () => {
    expect(maskPII('明日9時に集合やで')).toBe('明日9時に集合やで');
  });

  test('null / undefined でも壊れない', () => {
    expect(maskPII(null)).toBeNull();
    expect(maskPII(undefined)).toBeUndefined();
    expect(maskPII('')).toBe('');
  });
});

describe('isDataQuery', () => {
  test('タスク一覧要求を検出', () => {
    expect(isDataQuery('タスク一覧見せて')).toBe(true);
    expect(isDataQuery('タスクリスト教えて')).toBe(true);
  });

  test('担当確認要求を検出', () => {
    expect(isDataQuery('誰が担当してる？')).toBe(true);
    expect(isDataQuery('田中さんの担当教えて')).toBe(true);
  });

  test('普通のメッセージは false', () => {
    expect(isDataQuery('明日9時集合やで')).toBe(false);
    expect(isDataQuery('ジュニア、テントどこ？')).toBe(false);
  });

  test('null / empty は false', () => {
    expect(isDataQuery(null)).toBe(false);
    expect(isDataQuery('')).toBe(false);
  });
});

describe('isJuniorMention', () => {
  test('「ジュニア」を含む', () => {
    expect(isJuniorMention('ジュニア、音響の担当誰？')).toBe(true);
    expect(isJuniorMention('ジュニアよ！')).toBe(true);
  });

  test('「junior」（英語・大小問わず）を含む', () => {
    expect(isJuniorMention('junior, who is in charge?')).toBe(true);
    expect(isJuniorMention('JUNIOR!')).toBe(true);
    expect(isJuniorMention('Junior')).toBe(true);
  });

  test('含まない場合は false', () => {
    expect(isJuniorMention('明日テント設営よろしく')).toBe(false);
    expect(isJuniorMention('')).toBe(false);
    expect(isJuniorMention(null)).toBe(false);
  });
});

describe('checkRateLimit', () => {
  test('同じユーザーが10回まで通過できる', () => {
    const userId = 'test-user-rate-' + Date.now();
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit(userId)).toBe(true);
    }
    expect(checkRateLimit(userId)).toBe(false);
  });

  test('異なるユーザーは独立してカウント', () => {
    const u1 = 'user-a-' + Date.now();
    const u2 = 'user-b-' + Date.now();
    for (let i = 0; i < 10; i++) checkRateLimit(u1);
    expect(checkRateLimit(u1)).toBe(false);
    expect(checkRateLimit(u2)).toBe(true);
  });
});
