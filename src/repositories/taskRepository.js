/**
 * Tasks リポジトリ
 * - 書き込み戦略: AppSheet API があればそちら優先 (即時同期)、なければ Sheets append
 * - 列順は Tasks シートの (TaskId, Task, AssigneeId, AreaId, Deadline, Status, CreatedAt) を想定
 */
const crypto = require('node:crypto');
const sheetsService = require('../services/sheetsService');
const appsheetService = require('../services/appsheetService');
const userRepository = require('./userRepository');
const areaRepository = require('./areaRepository');
const { logger } = require('../utils/logger');

const SHEET_NAME = 'Tasks';
const APPSHEET_TABLE = 'Tasks';

/**
 * 抽出済みタスクをシートに登録する。
 * @param {{ task: string, assignee: string|null, deadline: string|null, area: string|null }} extracted
 * @returns {Promise<{ taskId: string, assigneeId: string, areaId: string|null }>}
 */
async function createTask(extracted) {
  // User / Area の解決を並列化 (どちらもキャッシュ前提なので I/O 0 のことが多い)
  const [assigneeId, areaId] = await Promise.all([
    userRepository.resolveUserIdByName(extracted.assignee),
    areaRepository.resolveAreaIdByName(extracted.area),
  ]);

  const taskId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const deadline = extracted.deadline; // YYYY-MM-DD or null

  // AppSheet API を優先 (即時同期)
  const appsheetRow = {
    TaskId: taskId,
    Task: extracted.task,
    AssigneeId: assigneeId,
    AreaId: areaId,
    Deadline: deadline,
    Status: '未着手',
    CreatedAt: createdAt,
  };
  const viaAppsheet = await appsheetService.addRow(APPSHEET_TABLE, appsheetRow);

  if (!viaAppsheet) {
    // フォールバック: Sheets に直接追記 (AppSheet が後追い同期)
    try {
      await sheetsService.appendRow(SHEET_NAME, [
        taskId,
        extracted.task,
        assigneeId,
        areaId,
        deadline,
        '未着手',
        createdAt,
      ]);
    } catch (err) {
      logger.error({ err: err.message, taskId }, 'Sheets 書き込み失敗');
      throw err; // 上位に返してユーザに通知させる
    }
  }

  return { taskId, assigneeId, areaId };
}

module.exports = { createTask };
