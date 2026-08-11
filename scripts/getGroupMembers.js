#!/usr/bin/env node
/**
 * LINE グループメンバー取得ツール
 * 使用法: node scripts/getGroupMembers.js <groupId>
 */

require('dotenv').config();
const { getGroupMembers } = require('../src/services/lineService');
const { logger } = require('../src/utils/logger');

async function main() {
  const groupId = process.argv[2];

  if (!groupId) {
    console.error('使用法: node scripts/getGroupMembers.js <groupId>');
    console.error('例: node scripts/getGroupMembers.js Cxxx...xxx');
    process.exit(1);
  }

  try {
    console.log(`\n🔍 グループID: ${groupId}`);
    console.log('メンバー情報を取得中...\n');

    const members = await getGroupMembers(groupId);

    console.log(`✅ ${members.length} 名のメンバーを取得しました\n`);
    console.log('─'.repeat(70));
    console.log(`${' '.repeat(2)}#  │  displayName          │  userId`);
    console.log('─'.repeat(70));

    members.forEach((member, index) => {
      const num = String(index + 1).padStart(3, ' ');
      const name = member.displayName.substring(0, 20).padEnd(20, ' ');
      console.log(`${num}  │  ${name}  │  ${member.userId}`);
    });

    console.log('─'.repeat(70));
    console.log(`\n📋 メンバーリスト（JSON）:\n`);
    console.log(JSON.stringify(members, null, 2));

  } catch (err) {
    logger.error({ err: err.message }, 'メンバー取得失敗');
    console.error(`\n❌ エラー: ${err.message}`);
    process.exit(1);
  }
}

main();
