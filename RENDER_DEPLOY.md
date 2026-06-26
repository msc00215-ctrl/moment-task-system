# MOMENT 2026 セットアップ完全ガイド

## システム全体フロー

```
LINEグループ（複数）
    ↓ Webhook（全メッセージ）
Render サーバー（moment-task-system.onrender.com）
    ↓ ① 全メッセージ → タスク抽出 + 確定情報抽出 → GASに無言で保存（ステルス）
    ↓ ② 「ジュニア」とメンションされた時だけ → Q&A返信
GAS Web App（doPost/doGet）
    ↓ SpreadsheetApp.openById()
Google Sheets（タスク・スケジュール管理スプシ）
    ├── 📱 LINEリアルタイム    ← 全メッセージログ（500件ローテ）
    ├── 📋 タスク（現役）      ← AI抽出タスク（自動upsert）
    ├── ✅ 完了タスク          ← 完了アーカイブ
    ├── 📚 確定知識ベース      ← 自動成長（LINEから学んだ確定情報）
    ├── 📦 備品・資材          ← ジュニアが覚えた場所・数量
    ├── 👥 スタッフ            ← スタッフ情報
    ├── 🛍️ 出店リスト          ← 出店情報
    └── 🔗 リンク集            ← 関連スプシリンク

GAS 工程表（同じスプシ内の別シート）
    ├── 📅 工程表_有給スタッフ            ← ガントチャート
    ├── 📋 エントランス用_全チーム入り一覧 ← 当日チェックシート
    └── 📊 当日運営マスター               ← 全工程・緊急対応一覧
```

---

## ⚠️ 実行順序（この順番で必ず）

```
STEP 1 → GAS webhook receiver をデプロイ（GAS_WEBHOOK_URL を取得）
STEP 2 → GAS 工程表をセットアップ（スプシにシートを生成）
STEP 3 → Render の環境変数を設定（STEP 1 の URL を使う）
STEP 4 → Render プランをアップグレード（7/2 前に必須！）
STEP 5 → LINE Developers で Webhook URL を設定
STEP 6 → 動作確認
```

---

## STEP 1｜GAS webhook receiver をデプロイ

**役割**: LINE Bot のデータを受け取ってスプレッドシートに書き込む中継サーバー

### 1-1. GAS プロジェクトを開く

👉 **https://script.google.com** にアクセス

1. 「新しいプロジェクト」をクリック
2. 左上のプロジェクト名（「無題のプロジェクト」）をクリック → `MOMENT2026_LINE_Receiver` に変更

### 1-2. コードを貼り付け

1. 左のファイル欄に `コード.gs` が1つある
2. ファイルをクリック → エディタの中身を全選択（Ctrl+A）して削除
3. `gas/MOMENT2026_webhook_receiver.gs` の内容をコピーして貼り付け
4. Ctrl+S で保存

### 1-3. セットアップを実行

1. 上部の関数選択欄（▶ の左）をクリック → **`setupAll`** を選択
2. ▶ 実行 をクリック
3. 「権限が必要です」→「権限を確認」→ Googleアカウントでログイン → 「許可」
4. 実行ログ（下部）に以下が表示される:
   ```
   GAS_SECRET_TOKEN: moment2026_xxxxxxxx  ← これをメモ！
   ```

### 1-4. ウェブアプリとしてデプロイ

1. 右上「デプロイ」→「**新しいデプロイ**」
2. 「種類の選択」→「**ウェブアプリ**」を選択
3. 以下を設定:
   - **説明**: `MOMENT2026 LINE Receiver`
   - **次のユーザーとして実行**: 自分（自分のGoogleアカウント）
   - **アクセスできるユーザー**: **全員**（匿名ユーザーを含む）
4. 「デプロイ」をクリック
5. 表示された URL（`https://script.google.com/macros/s/xxx/exec`）をコピー → **GAS_WEBHOOK_URL** としてメモ

---

## STEP 2｜GAS 工程表をセットアップ

**役割**: エントランスチェックシート・当日運営マスター・ガントチャートを生成

### 2-1. 対象スプレッドシートを開く

👉 **https://docs.google.com/spreadsheets/d/1kPCg1fbYfRxrWs7VwALrLAOo4oqONGgLAn3grhYvUfQ/edit**

### 2-2. Apps Script エディタを開く

1. メニューバー「**拡張機能**」→「**Apps Script**」をクリック
2. 新しいタブでエディタが開く

### 2-3. コードを貼り付け

1. 左のファイル欄の `コード.gs` をクリック → 中身を全選択して削除
2. `gas/MOMENT2026_工程表.gs` の内容をコピーして貼り付け
3. Ctrl+S で保存

### 2-4. 全シートを一括生成

1. 関数選択欄で **`setupAllSheets`** を選択
2. ▶ 実行 をクリック → 権限許可が出たら「許可」
3. 以下の3シートが自動生成される:
   - `📅 工程表_有給スタッフ` — ガントチャート付き有給スタッフ工程表
   - `📋 エントランス用_全チーム入り一覧` — 当日到着チェックシート（✅ 欄あり）
   - `📊 当日運営マスター` — 緊急対応・スタッフ配置・タイムライン全網羅

> ⚠️ 既存シートは一切変更されません。上記3枚のみ追加されます。

---

## STEP 3｜Render の環境変数を設定

**役割**: LINE Bot サーバー（Render）に API キーを登録する

### 3-1. Render ダッシュボードを開く

👉 **https://dashboard.render.com** にログイン

1. 左メニューの「**Web Services**」→ `moment-task-system`（または `moment-line-bot`）をクリック
2. 左メニュー「**Environment**」をクリック

### 3-2. 環境変数を1つずつ追加

「**Add Environment Variable**」を押して以下を登録:

| キー | 値 | どこで取得するか |
|------|-----|-----------------|
| `LINE_CHANNEL_ACCESS_TOKEN` | `U+英数字の長い文字列` | LINE Developers → チャンネル → Messaging API → チャンネルアクセストークン |
| `LINE_CHANNEL_SECRET` | `英数字32文字` | LINE Developers → チャンネル → チャンネル基本設定 → チャンネルシークレット |
| `OPENAI_API_KEY` | `sk-proj-xxxxx` | https://platform.openai.com/api-keys |
| `GAS_WEBHOOK_URL` | `https://script.google.com/macros/s/xxx/exec` | STEP 1-4 でメモしたURL |
| `GAS_SECRET_TOKEN` | `moment2026_xxxxxxxx` | STEP 1-3 でメモしたトークン |
| `NODE_ENV` | `production` | そのまま入力 |

3. 「**Save Changes**」をクリック → 自動で再デプロイが始まる（2〜3分待つ）

### 3-3. デプロイ完了を確認

- Render ダッシュボードで「**Live** 🟢」になれば OK
- Webhook URL: `https://moment-task-system.onrender.com/webhook`

---

## STEP 4｜Render プランをアップグレード（7/2 前に必須！）

> **⚠️ 無料プランだと15分間リクエストがないとスリープします。本番中（7/3〜7/5）にジュニアが沈黙します。**

### 4-1. 支払い情報を登録

👉 **https://dashboard.render.com/billing**

1. 「**Add Payment Method**」→ クレジットカード情報を入力

### 4-2. プランを変更

1. 「**Web Services**」→ `moment-task-system`（または `moment-line-bot`）をクリック
2. 左メニュー「**Scaling**」または「**Settings**」→「**Instance Type**」
3. **Starter（$7/月）** を選択 → 「**Save**」

> ✅ `render.yaml` のプランは既に `starter` に設定済みなので、リポジトリと連携している場合は自動反映されます。請求のみ要設定。

---

## STEP 5｜LINE Developers で Webhook URL を設定

### 5-1. LINE Developers Console を開く

👉 **https://developers.line.biz/console/**

1. プロバイダー → **MOMENT 2026** のチャンネルをクリック
2. 「**Messaging API**」タブをクリック

### 5-2. Webhook URL を設定

1. 「**Webhook URL**」の「編集」をクリック
2. 以下を入力:
   ```
   https://moment-task-system.onrender.com/webhook
   ```
3. 「**更新**」→「**検証**」→ 「成功」が表示されれば OK
4. 「**Webhookの利用**」が **ON** になっていることを確認

---

## STEP 6｜動作確認

### テスト1: タスク抽出（ステルス）
1. LINE Botが入っているグループで送信:
   ```
   hajimeさん、明日までにテント設営お願い
   ```
2. Bot は**返答しない**（ステルス動作）
3. スプシの「📋 タスク（現役）」に行が追加されていれば ✅

### テスト2: ジュニア Q&A
1. 同じグループで送信:
   ```
   ジュニア、ゲートオープン何時？
   ```
2. Bot が「7月3日の朝9時やで！🌅」のように返答すれば ✅

### テスト3: 自動成長
1. グループで送信:
   ```
   ジュニア、テント置き場はBエリアに決まったよ
   ```
2. Bot が「覚えたで！テント → Bエリアやな🌱」と返答すれば ✅
3. スプシの「📦 備品・資材」に追記されていれば ✅

### テスト4: 確定情報の自動学習
1. グループで送信（ジュニアを呼ばずに）:
   ```
   エントランスのゲートは9:00に確定しました
   ```
2. Bot は**返答しない**（ステルス）
3. スプシの「📚 確定知識ベース」に追記されていれば ✅
4. その後「ジュニア、ゲートオープンは？」と聞くと学んだ情報で答える

---

## よくあるトラブル

### Bot が返答しない
- Render で「**Live** 🟢」になっているか確認: https://dashboard.render.com
- LINE Developers で Webhook URL が正しく設定されているか確認
- 無料プランの場合: Render がスリープ中（最初のメッセージから15秒後に返答）

### GAS デプロイが失敗する
- 「アクセスできるユーザー: 全員」になっているか確認
- デプロイ後に URL が変わる → Render の `GAS_WEBHOOK_URL` を更新する

### ジュニアが返答しない（タスク抽出はされる）
- メッセージに「**ジュニア**」または「**junior**」が含まれているか確認（大小文字不問）
- Render の `OPENAI_API_KEY` が正しいか確認

---

## 各種リンク早見表

| 用途 | URL |
|------|-----|
| Google Apps Script | https://script.google.com |
| タスク・スケジュール管理スプシ | https://docs.google.com/spreadsheets/d/1kPCg1fbYfRxrWs7VwALrLAOo4oqONGgLAn3grhYvUfQ/edit |
| Render ダッシュボード | https://dashboard.render.com |
| Render 請求設定 | https://dashboard.render.com/billing |
| LINE Developers Console | https://developers.line.biz/console/ |
| OpenAI API キー発行 | https://platform.openai.com/api-keys |
| Bot の Webhook URL | https://moment-task-system.onrender.com/webhook |
| Bot のヘルスチェック | https://moment-task-system.onrender.com/health |
