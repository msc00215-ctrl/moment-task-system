# Obsidian × Google Sheets リアルタイム同期 セットアップガイド

**目標：** Obsidian で MOMENT のタスクを管理し、Claude が自動で Google Sheets からデータを取得・学習します。

---

## ⚡ 5 分で開始

### STEP 1：Node.js パッケージをインストール

```bash
cd C:\Users\momose-o-25sf\moment-task-system

npm install googleapis google-auth-library
```

### STEP 2：Google Sheets API 認証キーを取得

1. [Google Cloud Console](https://console.cloud.google.com/) を開く
2. 新規プロジェクト作成：`MOMENT-Obsidian-Sync`
3. **Google Sheets API** を有効化
4. サービスアカウント作成
5. JSON キーをダウンロード
6. `config/google-credentials.json` に保存

```bash
mkdir config
# google-credentials.json をここに配置
```

### STEP 3：Google Sheets ID を設定

`scripts/obsidian-sync.js` の以下の行を編集：

```javascript
const CONFIG = {
  // ...
  googleSheetsId: '1kPCg1fbYfRxrWs7VwALrLAOo4oqONGgLAn3grhYvUfQ', // ← これをコピペ
  // ...
};
```

**Google Sheets ID の見つけ方：**
```
Google Sheets の URL: https://docs.google.com/spreadsheets/d/【ここ】/edit#gid=0
                                            ↑
                                        これをコピー
```

### STEP 4：Obsidian で管理パネルを開く

```
Obsidian を開く
  ↓
[[MOMENT/管理パネル]] を開く
  ↓
「📡 今すぐデータ同期」をクリック
```

---

## 🚀 実行方法

### コマンドラインから実行

```bash
# タスク同期
node scripts/obsidian-sync.js --action sync-tasks

# ダッシュボード生成
node scripts/obsidian-sync.js --action generate-dashboard

# 判定学習
node scripts/obsidian-sync.js --action analyze-decisions
```

### Obsidian QuickAdd プラグインで自動実行

1. Obsidian プラグイン「QuickAdd」をインストール
2. QuickAdd 設定画面を開く
3. 以下をマクロとして追加：

```javascript
// macro: sync-moment-data
const { execSync } = require('child_process');
const result = execSync('node scripts/obsidian-sync.js --action sync-tasks', {
  cwd: 'C:\\Users\\momose-o-25sf\\moment-task-system',
  encoding: 'utf-8'
});
console.log(result);
```

---

## 📅 スケジュール自動実行

### Windows Task Scheduler で毎日自動実行

1. Task Scheduler を開く
2. 新規タスク作成
3. 設定：

**朝 6 時に実行：**
```
プログラム: C:\Program Files\nodejs\node.exe
引数: scripts/obsidian-sync.js --action sync-tasks
開始: C:\Users\momose-o-25sf\moment-task-system
```

**昼 12 時に実行：**
```
プログラム: C:\Program Files\nodejs\node.exe
引数: scripts/obsidian-sync.js --action analyze-decisions
```

**夜 22 時に実行：**
```
プログラム: C:\Program Files\nodejs\node.exe
引数: scripts/obsidian-sync.js --action generate-dashboard
```

### または cron で Linux/Mac：

```bash
# crontab -e で以下を追加
0 6 * * * cd /path/to/moment-task-system && node scripts/obsidian-sync.js --action sync-tasks
0 12 * * * cd /path/to/moment-task-system && node scripts/obsidian-sync.js --action analyze-decisions
0 22 * * * cd /path/to/moment-task-system && node scripts/obsidian-sync.js --action generate-dashboard
```

---

## 📊 出力ファイル

スクリプト実行後、以下のノートが自動生成・更新されます：

```
Obsidian Vault/MOMENT/
├── 管理パネル.md（←これをクリック）
├── 同期ログ/
│   └── タスク同期_2026-06-19.md
├── ダッシュボード/
│   └── マイク用_2026-06-20.md
└── ログ/
    └── 判断ログ_2026-06-19.md
```

---

## 🔍 トラブルシューティング

### エラー：`Cannot find module 'googleapis'`

**対応：**
```bash
npm install googleapis google-auth-library
```

### エラー：`Google Sheets ID が無効`

**対応：**
- Google Sheets の URL から ID を再確認
- `scripts/obsidian-sync.js` の `googleSheetsId` が正しく設定されているか確認

### エラー：`ノートが作成されない`

**対応：**
- Obsidian Vault パスが正しいか確認
  ```
  C:\Users\momose-o-25sf\Documents\Obsidian Vault
  ```
- Obsidian がノートを自動リロードするか確認（設定→ファイル）

---

## 🎯 次のステップ

1. ✅ セットアップ完了したら、まずテストで実行
2. ✅ Obsidian で生成されたノートを確認
3. ✅ LINE 連携を追加（マイク の発言自動取得）
4. ✅ 毎日スケジュール実行に切り替え

---

## 📝 LINE 連携（オプション）

LINE からマイク の発言を自動取得する場合：

1. LINE Messaging API の認証情報を取得
2. `scripts/obsidian-sync.js` に LINE 取得機能を追加
3. 以下のコード例を参考：

```javascript
// LINE グループから メッセージ取得（オプション）
async function getLineMessages(groupId) {
  // LINE Messaging API を使用
  const response = await axios.get(`https://api.line.biz/...`, {
    headers: { Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` }
  });
  return response.data.messages;
}
```

---

## 🚀 すぐに試す

```bash
# 1. 現在のディレクトリ確認
cd C:\Users\momose-o-25sf\moment-task-system

# 2. 一度実行してテスト
node scripts/obsidian-sync.js --action sync-tasks

# 3. Obsidian を確認
# MOMENT/同期ログ/タスク同期_[今日の日付].md が作成される

# 成功したら、Obsidian の管理パネルから動かすのが楽
```

---

## 🔗 関連ノート

- [[MOMENT/管理パネル]] — ボタンをクリックで実行
- [[Obsidian×AI連携プロンプト]] — 設計詳細
- [[Obsidian自己進化AI]] — AI 学習ロジック
