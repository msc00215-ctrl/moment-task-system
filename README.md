# MOMENT 2026 タスク管理システム

LINE Bot にメッセージを送ると、OpenAI が「タスク内容 / 担当者 / 期限 / エリア」を抽出し、Google Sheets (AppSheet バックエンド) に登録する自動化システム。

## アーキテクチャ

```
LINE  ──▶  Cloud Functions (lineWebhook)
                │
                ├─ 署名検証 (channel secret)
                ├─ 早期 200 ACK
                ├─ OpenAI: タスク抽出 (JSON mode)
                ├─ Sheets/AppSheet: 行追加
                │     ├─ AppSheet API があれば優先 (即時同期)
                │     └─ なければ Sheets API へ append
                └─ LINE: 結果を reply (失敗時は push fallback)
```

機密情報は **Google Secret Manager** で管理。サービスアカウントに `roles/secretmanager.secretAccessor` を付与する。

## ディレクトリ構成

```
moment-task-system/
├── app.yaml                 App Engine デプロイ用
├── package.json
├── .env.example             ローカル開発用 (本番は Secret Manager)
├── src/
│   ├── index.js             functions-framework エントリ
│   ├── config/
│   │   ├── index.js         env + Lazy Secret 解決
│   │   └── secrets.js       Secret Manager クライアント
│   ├── handlers/
│   │   └── lineWebhook.js   Webhook の主フロー
│   ├── middleware/
│   │   └── lineSignature.js HMAC-SHA256 検証
│   ├── services/
│   │   ├── openaiService.js OpenAI Chat Completions
│   │   ├── lineService.js   LINE Messaging API
│   │   ├── sheetsService.js Google Sheets API
│   │   └── appsheetService.js AppSheet API (即時同期)
│   ├── repositories/
│   │   ├── taskRepository.js
│   │   ├── userRepository.js
│   │   └── areaRepository.js
│   └── utils/
│       ├── logger.js        Cloud Logging 互換
│       ├── retry.js         指数バックオフ + ジッター
│       ├── cache.js         TTL キャッシュ
│       └── validator.js     入力正規化
└── tests/
```

## セットアップ

### 1. GCP プロジェクト準備

```bash
gcloud config set project moment-2026-prod
gcloud services enable secretmanager.googleapis.com sheets.googleapis.com cloudfunctions.googleapis.com cloudbuild.googleapis.com
```

### 2. Secret Manager に登録

```bash
echo -n "sk-..."           | gcloud secrets create openai-api-key            --data-file=-
echo -n "<line-token>"     | gcloud secrets create line-channel-access-token --data-file=-
echo -n "<line-secret>"    | gcloud secrets create line-channel-secret       --data-file=-
echo -n "<appsheet-key>"   | gcloud secrets create appsheet-access-key       --data-file=-
```

### 3. サービスアカウント

```bash
SA="moment-runtime@moment-2026-prod.iam.gserviceaccount.com"
gcloud iam service-accounts create moment-runtime
for s in openai-api-key line-channel-access-token line-channel-secret appsheet-access-key; do
  gcloud secrets add-iam-policy-binding "$s" --member="serviceAccount:$SA" --role=roles/secretmanager.secretAccessor
done
```

スプレッドシートをこのサービスアカウントのメールアドレスに「編集者」で共有する。

### 4. デプロイ

**Cloud Functions (Gen 2):**
```bash
npm run deploy:function -- --service-account=moment-runtime@moment-2026-prod.iam.gserviceaccount.com
```

**App Engine:**
```bash
npm run deploy:appengine
```

デプロイ後の URL を LINE Developers の Webhook URL に設定。

## 設計上のキーポイント

### エラーハンドリング
- **Webhook は必ず 200 を返す**。LINE は非200で短時間にリトライしてくるため、全イベント処理を `Promise.allSettled` で包んで部分失敗を許容。
- **OpenAI 失敗 → ユーザに「読み取れんかった」とフィードバック**。例外を投げずに空オブジェクトで返す設計。
- **Sheets 失敗 → ユーザに通知**。リトライ層で 5xx / レート制限は自動で再試行。
- **reply 失敗 → push にフォールバック**。replyToken の 30s 失効に備える。

### セキュリティ
- API キーは **Secret Manager 経由**。コード/環境変数に平文を置かない。
- **HMAC-SHA56 で LINE 署名検証**。`timingSafeEqual` で比較しタイミング攻撃を回避。
- ローカル開発時のみ `.env` を許容 (NODE_ENV=development チェック)。
- サービスアカウントは最小権限 (Secret 1 つずつ accessor 付与 / Sheets はシート単位の共有)。

### AppSheet 同期速度の最大化
1. **AppSheet API 直叩き優先**: `appsheetService.addRow` が成功するとクライアントに即時反映。Sheets 経由は数秒〜十数秒のラグ。
2. **マスタキャッシュ**: User / Area の名前→ID 解決を `TTLCache` で高速化。コールド起動以外は I/O ゼロ。
3. **書き込みは 1 リクエスト**: `appendRow` / `appsheetService.addRow` で 1 行 1 API。複数件はバッチ用 `appendRows` を使用。
4. **Sheets API は `valueInputOption=USER_ENTERED`**: AppSheet 側の型推論を活かす。
5. **クライアントのシングルトン化**: Sheets / OpenAI / LINE はインスタンス再利用で TLS ハンドシェイクを節約。

## ローカル開発

```bash
cp .env.example .env
# .env に LOCAL_* を入れる
npm install
npm run dev   # http://localhost:8080
```

ngrok で公開して LINE Webhook URL に設定 → 実機テスト。

## テスト

```bash
npm test
```

## Cloud Functions / App Engine 移行ガイド

両者ともコード変更ゼロでデプロイ可能 (functions-framework が App Engine 上でも動く)。
- 起動時間重視: **Cloud Functions Gen 2**
- 常駐 / VPC コネクタ要 / WebSocket: **App Engine**

将来 Cloud Run に移す場合も同じコードで `gcloud run deploy --source=.` で OK。
