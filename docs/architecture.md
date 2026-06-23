# Architecture

## レイヤ構造

```
handlers/    ── HTTP 入出力 / フロー制御
  ↓
services/    ── 外部 SaaS のラッパ (OpenAI / LINE / Sheets / AppSheet)
  ↓
repositories/── ドメインモデルの永続化 (Task / User / Area)
  ↓
utils/       ── 横串ユーティリティ (logger / retry / cache / validator)
```

依存方向は上→下のみ。services が repositories を知ってはいけない。

## エラー伝播のポリシー

| 層 | 失敗時の挙動 |
|----|-------------|
| services (OpenAI) | 例外を握り潰し空オブジェクトを返す。上位が「抽出失敗」と判断できるように。 |
| services (LINE / Sheets / AppSheet) | リトライ後に例外を再 throw。上位がフィードバック責任を負う。 |
| repositories | services の例外をログ後に再 throw。 |
| handlers | 個別 catch でユーザにフィードバック。`Promise.allSettled` で兄弟イベントを保護。 |
| index.js | 最終 catch。レスポンス未送なら 200 を返す (LINE リトライ抑制)。 |

## Cloud Functions vs App Engine 選択指針

- **Cloud Functions Gen 2**: イベント駆動、スケール 0、料金は実行時間ベース。Webhook 用途に最適。
- **App Engine Standard**: 常駐インスタンスが欲しい時、複数エンドポイントが必要な時。コードはそのまま動く。
- **Cloud Run**: コンテナ化で柔軟。`gcloud run deploy --source=.` で即移行可能。

## Secret Manager 設計

- Secret は **用途単位** で分割 (openai-api-key / line-channel-access-token / line-channel-secret / appsheet-access-key)。
- 各 Secret に **サービスアカウント単位の IAM** を付与 (最小権限)。
- ローテーションは `versions/latest` 参照なので新版を追加するだけ。コード側のキャッシュは `invalidateSecretCache` で破棄可能 (将来 Pub/Sub からの破棄イベントで連動)。

## キャッシュ戦略

| 対象 | TTL | 理由 |
|------|-----|------|
| Users マスタ | 5 分 | 担当者追加は中頻度 |
| Areas マスタ | 10 分 | エリアは滅多に変わらない |
| Secret Manager | プロセス寿命 | キーローテ時のみ手動破棄 |

複数インスタンス間で整合性が必要になったら **Memorystore (Redis)** へ移行。

## 拡張ポイント

- **複数ステージ**: 抽出 → 確認ボタン → 確定登録 (LINE Flex Message + Postback)
- **Cloud Tasks**: 重い処理を別ワーカに切り出す (現状は同期処理で足りる想定)
- **Pub/Sub**: Webhook を受けるだけの Function と、処理する Function を分離 (高負荷時)
- **BigQuery export**: AppSheet の sync ログをエクスポートして遅延を可視化
