/**
 * LINE Webhook ハンドラ
 *
 * 動作フロー:
 * 1. 全メッセージ → ログ記録 + タスク自動抽出（無言）
 * 2. DM: 常にジュニアが返答 / グループ: 「ジュニア」と呼ばれた時だけ返答
 *    - 備品情報を教えてもらった → シートに保存して確認返信
 *    - 質問 → スタッフ/備品/スケジュール情報をもとに回答
 * 3. join イベント: グループ参加時に自己紹介 + 取説をピン止め
 */
const { verifyLineSignature } = require('../middleware/lineSignature');
const { extractTasks, generateJuniorResponse, extractEquipmentInfo, extractKnowledge } = require('../services/openaiService');
const { reply, pushMessages, pinMessage } = require('../services/lineService');
const { postToGas, getSheetData } = require('../services/gasService');

const INTRO_SHORT = `はじめまして！ジュニアです🌟
MOMENT 2026 の設営・運営をサポートするAIアシスタントやで！

【基本の使い方】
・「ジュニア、〇〇は？」と呼びかけると答えるで！
・スプシの情報を自動で学習して成長するんや📈
・タスクの管理もこっそり手伝ってるよ😊

詳しい使い方は↓の取説を見てな！`;

const INTRO_MANUAL = `📖 ジュニア 取扱説明書（フルバージョン）

━━━━━━━━━━━━━━━━━━
🔰 基本コマンド
━━━━━━━━━━━━━━━━━━
「ジュニア、〇〇は？」→ 質問に答えるで
「ジュニア、〇〇はXXに決まったよ」→ 確定情報を覚えるで
「ジュニア、備品〇〇はBエリアにあるよ」→ 備品場所を記録するで

━━━━━━━━━━━━━━━━━━
📋 タスク管理（ステルス機能）
━━━━━━━━━━━━━━━━━━
グループのトーク内容から自動でタスクを抽出してスプシに登録するで（返答なし・バレない）
→ スプシ「📋 タスク（現役）」シートで確認できるで

━━━━━━━━━━━━━━━━━━
📚 自動成長（知識ベース）
━━━━━━━━━━━━━━━━━━
「〇〇は△△に確定」「〇〇は××でOK」などの決定事項を自動で学習するで
→ スプシ「📚 確定知識ベース」シートで蓄積内容を確認できるで

━━━━━━━━━━━━━━━━━━
📦 備品・資材管理
━━━━━━━━━━━━━━━━━━
「ジュニア、テント（10張）はBエリアに置いてあるよ」のように教えると記録するで
→ スプシ「📦 備品・資材」シートで確認できるで

━━━━━━━━━━━━━━━━━━
👥 スタッフ情報
━━━━━━━━━━━━━━━━━━
スタッフの名前・配属チームなどを答えられるで
※個人の連絡先・財務情報は答えられないよ（セキュリティ上）

━━━━━━━━━━━━━━━━━━
⚠️ 注意事項
━━━━━━━━━━━━━━━━━━
・グループでは「ジュニア」と呼びかけた時だけ返答するで
・公式アカウントへのDMはいつでも話しかけてOK！
・スプシを育てるほどジュニアが賢くなるで📈

スプシ管理はHI-Cさんに確認してな🙏`;
const { assertRequired } = require('../config');
const { logger } = require('../utils/logger');
const { maskPII, checkRateLimit, isJuniorMention } = require('../utils/security');

const groupNameCache = new Map();

async function handleWebhook(req, res) {
  try {
    assertRequired();
  } catch (err) {
    logger.error({ err: err.message }, '設定不足 — Webhook 停止');
    res.status(500).send('Configuration error');
    return;
  }

  const valid = await verifyLineSignature(req);
  if (!valid) {
    logger.warn({ ip: req.ip }, 'LINE 署名検証失敗');
    res.status(401).send('Invalid signature');
    return;
  }

  res.status(200).send('OK');

  const events = Array.isArray(req.body?.events) ? req.body.events : [];
  if (events.length === 0) return;

  const results = await Promise.allSettled(events.map(handleSingleEvent));
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      logger.error({ err: r.reason?.message, eventIndex: i }, 'イベント処理失敗');
    }
  });
}

async function handleJoinEvent(event) {
  const chatId = event.source?.groupId || event.source?.roomId;
  if (!chatId) return;
  logger.info({ chatId }, 'グループ参加 — 自己紹介を送信');
  try {
    const sent = await pushMessages(chatId, [
      { type: 'text', text: INTRO_SHORT },
      { type: 'text', text: INTRO_MANUAL },
    ]);
    const manualMsgId = sent[1]?.id;
    if (manualMsgId) {
      await pinMessage(chatId, manualMsgId);
      logger.info({ chatId, messageId: manualMsgId }, 'ピン止め完了');
    }
  } catch (err) {
    logger.error({ err: err.message }, 'join 自己紹介失敗');
  }
}

async function handleSingleEvent(event) {
  if (!event) return;

  if (event.type === 'join') {
    await handleJoinEvent(event);
    return;
  }

  if (event.type !== 'message') return;
  if (!event.message || event.message.type !== 'text') return;

  const text = (event.message.text || '').trim();
  if (!text) return;

  const replyToken = event.replyToken;
  const userId     = event.source?.userId || 'unknown';
  const sourceType = event.source?.type   || 'unknown';
  const groupId    = event.source?.groupId || event.source?.roomId || null;
  const timestamp  = new Date(event.timestamp || Date.now()).toISOString();
  const groupName  = groupId ? await fetchGroupName(groupId) : 'DM';

  logger.info({ sourceType, groupName, textLen: text.length }, 'メッセージ受信');

  // ① レート制限
  if (!checkRateLimit(userId)) {
    logger.warn({ userId }, 'レート制限超過');
    return;
  }

  // ② 全メッセージをログ保存（PII マスク済み）
  const maskedText = maskPII(text);
  postToGas({
    type: 'lineLog',
    messages: [{ timestamp, groupId: groupId || 'direct', groupName, userId, text: maskedText }],
  }).catch(err => logger.error({ err: err.message }, 'GAS ログ送信失敗'));

  // ③ タスク抽出（常に・無言）
  let tasks;
  try {
    tasks = await extractTasks(text, groupName);
  } catch (err) {
    logger.error({ err: err.message }, 'extractTasks 失敗');
  }

  if (tasks && tasks.length > 0) {
    postToGas({
      type: 'task',
      groupName,
      groupId: groupId || 'direct',
      userId,
      originalText: maskedText,
      timestamp,
      tasks,
    }).catch(err => logger.error({ err: err.message }, 'GAS タスク送信失敗'));
  }

  // ③b 確定知識抽出（常に・無言・ステルス — fire-and-forget）
  extractKnowledge(text).then(info => {
    if (info?.found && info.content) {
      return postToGas({
        type:         'knowledge',
        category:     info.category    || 'その他',
        content:      info.content,
        notes:        info.notes       || '',
        groupName,
        originalText: maskedText,
      });
    }
  }).catch(err => logger.error({ err: err.message }, 'GAS 知識登録失敗'));

  // ④ DM は常に返答 / グループ・ルームは「ジュニア」メンション必須
  const isDM = sourceType === 'user';
  if (!isDM && !isJuniorMention(text)) return;
  if (!replyToken) return;

  // ⑤ リストアコマンド: 「現状の状態に戻れるように！！！」でスプシ再構築
  if (text.includes('現状の状態に戻れるように！！！')) {
    postToGas({ type: 'restore' })
      .catch(err => logger.error({ err: err.message }, 'GAS restore 送信失敗'));
    await safeReply(replyToken, userId,
      '⏳ ②スプシの再構築を開始したで！\n完了まで30〜60秒かかるかも。\n終わったらスプシを確認してみてな！\n\nhttps://docs.google.com/spreadsheets/d/1kPCg1fbYfRxrWs7VwALrLAOo4oqONGgLAn3grhYvUfQ/edit');
    return;
  }

  // ⑦ 備品情報を教えてもらったか確認
  let equipInfo;
  try {
    equipInfo = await extractEquipmentInfo(text);
  } catch {
    equipInfo = { found: false };
  }

  if (equipInfo?.found && equipInfo.item && equipInfo.location) {
    postToGas({
      type: 'equipment',
      item:       equipInfo.item,
      category:   equipInfo.category   || '',
      quantity:   equipInfo.quantity   ?? '',
      unit:       equipInfo.unit       || '',
      location:   equipInfo.location,
      department: equipInfo.department || '',
      notes:      equipInfo.notes      || '',
    }).catch(err => logger.error({ err: err.message }, 'GAS 備品登録失敗'));

    const qty = equipInfo.quantity ? `${equipInfo.quantity}${equipInfo.unit || ''}` : '';
    await safeReply(replyToken, userId,
      `覚えたで！${equipInfo.item}${qty ? `（${qty}）` : ''} → ${equipInfo.location}やな🌱`);
    return;
  }

  // ⑧ ジュニア Q&A
  try {
    const [equipment, staff, vendors, artists, knowledge] = await Promise.all([
      getSheetData('equipment'),
      getSheetData('staff'),
      getSheetData('vendor'),
      getSheetData('artist'),
      getSheetData('knowledge'),
    ]);
    const response = await generateJuniorResponse(text, groupName, { equipment, staff, vendors, artists, knowledge });
    if (response) await safeReply(replyToken, userId, response);
  } catch (err) {
    logger.error({ err: err.message }, 'Junior応答失敗');
  }
}

async function fetchGroupName(groupId) {
  if (groupNameCache.has(groupId)) return groupNameCache.get(groupId);
  try {
    const { getClient } = require('../services/lineService');
    const client = await getClient();
    const summary = await client.getGroupSummary(groupId);
    const name = summary?.groupName || groupId;
    groupNameCache.set(groupId, name);
    return name;
  } catch {
    return groupId;
  }
}

async function safeReply(replyToken, userId, text) {
  try {
    await reply(replyToken, text, userId);
  } catch (err) {
    logger.error({ err: err.message }, 'reply 失敗');
  }
}

module.exports = { handleWebhook };
