# LINE Bot → Render デプロイ手順書

## 全体フロー

```
LINEグループ20個
    ↓ Webhook
Render (Express サーバー)
    ↓ OpenAI タスク抽出 + GAS POST
GAS doPost Web App
    ↓ SpreadsheetApp.openById()
Google Sheets（管理マスターシート）
    ├── 📱 LINEリアルタイム  ← 全メッセージログ
    └── 📋 タスク自動抽出   ← AIが抽出したタスク
```

---

## STEP 1: GAS doPost をデプロイ

1. [Google Apps Script](https://script.google.com/) を開く
2. 「新しいプロジェクト」→ プロジェクト名: `MOMENT2026 LINE Receiver`
3. `gas/MOMENT2026_webhook_receiver.gs` の内容を貼り付けて保存
4. `setupSecretToken` 関数を実行してシークレットトークンを設定
   - `setupSecretToken()` 内の文字列を任意の英数字に変更してから実行
   - 設定した文字列をメモしておく → **GAS_SECRET_TOKEN** として使う
5. デプロイ → 新しいデプロイ
   - 種類: **ウェブアプリ**
   - 実行ユーザー: **自分（momose）**
   - アクセス: **全員（匿名を含む）**
6. 「デプロイ」→ 表示されたURLをコピー → **GAS_WEBHOOK_URL** として使う

---

## STEP 2: Render に Node.js サービスを作成

1. [render.com](https://render.com) でアカウント作成（無料）
2. 「New +」→「Web Service」
3. Git リポジトリ接続 or「Public Git repository」から：
   - `moment-task-system` フォルダを GitHub にプッシュしてから接続
   - または「Deploy from existing code」
4. 設定:
   - **Name**: `moment-line-bot`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node src/index.js`
   - **Instance Type**: Free
5. 「Environment Variables」に以下を設定:

| キー | 値 |
|------|-----|
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developers から取得 |
| `LINE_CHANNEL_SECRET` | LINE Developers から取得 |
| `OPENAI_API_KEY` | OpenAI API キー |
| `GAS_WEBHOOK_URL` | STEP 1 で取得したGAS URL |
| `GAS_SECRET_TOKEN` | STEP 1 で設定したトークン |

6. 「Deploy」→ デプロイ完了後に表示される URL をコピー
   - 例: `https://moment-line-bot.onrender.com`
   - Webhook URL: `https://moment-line-bot.onrender.com/webhook`

---

## STEP 3: LINE Developers で Webhook URL を設定

1. [LINE Developers Console](https://developers.line.biz/) を開く
2. プロバイダー → チャンネル（MOMENT Bot）を選択
3. 「Messaging API」タブ → 「Webhook URL」
4. `https://moment-line-bot.onrender.com/webhook` を入力
5. 「検証」→ 成功を確認
6. 「Webhookの利用」を ON にする

---

## STEP 4: LINE Bot を20グループに追加

**HI-C またはマイクが対応（1グループ約10秒）:**

1. LINE Bot の QR コードを LINE Developers Console から表示
2. 各グループを開く → 「メンバーを追加」→ QR コードでスキャン → 追加

**追加必要なグループ一覧:**
- Moment26デコレーションG
- Moment26音響G
- Moment26電源G
- Moment26設営G
- 舞台監督グループ
- BARグループ
- エントランスG
- 警備・駐車場G
- ボランティアG
- …（全20グループ）

---

## STEP 5: 動作確認

1. いずれかのグループでテストメッセージを送る
   - 例: 「妹尾さん、カムロックケーブル80mを6/25までに手配してください」
2. Bot が「✅ タスク1件 登録しました！」と返信 → 成功
3. Google Sheets の「📱 LINEリアルタイム」「📋 タスク自動抽出」シートを確認

---

## 注意事項

- **Render Free プランのスリープ**: 15分間リクエストがないと自動スリープ
  - 最初のリクエストに15〜20秒かかる（LINE がタイムアウトして再送することもある）
  - 本番期間中（7/3〜7/5）は有料プランへのアップグレード推奨（$7/月）
- **GAS 実行制限**: 1日 6時間/トリガー 20,000回 → 通常使用では問題なし
- **Bot はグループ内の全メッセージを記録する**（スタッフに周知推奨）
