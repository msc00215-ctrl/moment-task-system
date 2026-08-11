# LINEグループメンバー取得機能

moment-task-system に LINEグループのメンバーリストを取得する機能が追加されました。

## 機能概要

- **LINEチャットボット内での利用**: グループ内で「ジュニア、メンバーリスト」と呼びかけるとメンバー一覧が返される
- **CLIツール**: Node.js スクリプトを実行して、プログラム的にメンバー情報を取得可能

## 使用方法

### 1️⃣ LINEチャットボット経由でメンバーリストを取得

グループ内でボットに以下のコマンドを送ります：

```
ジュニア、メンバーリスト
```

または

```
ジュニア、メンバー一覧
```

ボットが以下の形式で返答します：

```
👥 グループメンバー（15名）

1. ユーザー太郎
2. ユーザー花子
3. ユーザー次郎
...
```

### 2️⃣ CLIツール経由でメンバー情報を取得

#### グループIDを取得

まずグループの ID を確認する必要があります。以下の方法で確認できます：

1. **ログから取得**: LINEメッセージが送信されると、ログに `groupId` が記録されます
   - Google Sheets の LOG シートで確認可能
   - または環境変数 `GAS_WEBHOOK_URL` で送信されたログを確認

2. **DEBUG モードで取得**: Node.js で以下を実行
   ```bash
   LOG_LEVEL=debug npm start
   ```
   グループメンバーからメッセージが送信されると、groupId がログに出力されます

#### メンバー情報を取得

```bash
node scripts/getGroupMembers.js <groupId>
```

**例:**
```bash
node scripts/getGroupMembers.js Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**出力例:**

```
🔍 グループID: Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
メンバー情報を取得中...

✅ 15 名のメンバーを取得しました

──────────────────────────────────────────────────────────────────────
  #  │  displayName          │  userId
──────────────────────────────────────────────────────────────────────
  1  │  ユーザー太郎          │  Uyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  2  │  ユーザー花子          │  Uyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  3  │  ユーザー次郎          │  Uyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
...
──────────────────────────────────────────────────────────────────────

📋 メンバーリスト（JSON）:

[
  {
    "userId": "Uyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "displayName": "ユーザー太郎",
    "pictureUrl": "https://...",
    "statusMessage": ""
  },
  ...
]
```

## 実装詳細

### 新規追加ファイル

- **`scripts/getGroupMembers.js`**: CLI ツール

### 修正ファイル

- **`src/services/lineService.js`**: 新関数 `getGroupMembers()` を追加
- **`src/handlers/lineWebhook.js`**: メンバーリスト取得コマンドのハンドリングを追加

## API仕様

### `getGroupMembers(groupId)`

LINE のグループメンバー情報を取得します。

**パラメータ:**
- `groupId` (string, required): LINE グループID

**戻り値:**
```javascript
Promise<Array<{
  userId: string,           // LINE ユーザーID
  displayName: string,      // 表示名
  pictureUrl: string,       // プロフィール画像URL
  statusMessage: string,    // ステータスメッセージ
}>>
```

**エラー:**
- `groupId` が指定されていない場合: 「groupId は必須です」
- グループメンバー取得失敗時: LINE API のエラーをスロー

## 技術仕様

### 使用API

- `MessagingApiClient.getGroupMembersIds(groupId, options)`: グループメンバーIDを最大100件ずつ取得（ページネーション対応）
- `MessagingApiClient.getProfile(userId)`: 個別ユーザーの詳細情報を取得

### リトライ処理

- LINE API の一時的な障害に対応して、最大 2 回の自動リトライを実装

### エラーハンドリング

- 個別メンバーの プロフィール取得失敗時は、そのメンバーをスキップして処理を継続
- ページネーション処理で全メンバーを確実に取得

## 注意事項

- ⚠️ LINE Bot が**グループ管理者権限**を持つ必要があります（通常のメンバーでは不可）
- ⚠️ グループメンバーの取得には LINE API へのアクセス権限が必要
- ⚠️ ユーザーのステータスメッセージは、LINE 側で公開設定になっていないと取得できません
