# gassign アーキテクチャ解説

## 全体構成

```
ブラウザ
    ↓ HTTPS
GAS Web App (HtmlService)
    ├── doGet()  → HTML レスポンス（サーバーサイドレンダリング）
    └── callServer()  ← google.script.run 経由
         ↓
GAS Backend (Code.gs / *.gs)
    ↓
┌──────────┬──────────┬────────────┬──────────┐
│  Drive   │  Docs    │ eSignature │  Gmail   │
│   API    │   API    │    API     │   API    │
└──────────┴──────────┴────────────┴──────────┘
    ↓
Spreadsheet (ledger / audit_log / config)
```

## なぜ Google Apps Script か

gassign は「サーバー不要」を最優先の設計原則にしています。

- **実行環境**: Google が管理する GAS ランタイム（V8）
- **データストア**: Google Spreadsheet（隠し運用）
- **ファイル**: Google Drive
- **電子署名**: Google eSignature（Drive API v2beta）
- **メール**: GmailApp

これらはすべて Google Workspace のスコープ内で完結するため、外部サービスとの契約・料金・セキュリティ審査が不要です。

---

## データの「真実の所在」

| 情報 | 真実の所在 | gassign が持つもの |
|------|------------|---------------------|
| 契約書本文 | Google Docs | `doc_id`（参照キー）のみ |
| 署名済み PDF | Google Drive | `signed_pdf_id` のみ |
| 署名状態 | eSignature API | `status`（キャッシュ） |
| 操作履歴 | audit_log Sheet | 完全なコピー（追記専用） |
| 設定 | config Sheet | ー |

`ledger` の `status` は **キャッシュ** です。eSignature 側の状態が真実であるため、「状態を再同期」ボタンや毎朝の定期同期で上書きされます。

---

## Drive フォルダ構成

```
gassign/
├── _system/
│   ├── ledger        （Spreadsheet: 契約マスタ）
│   ├── audit_log     （Spreadsheet: 操作ログ、追記専用）
│   └── config        （Spreadsheet: 設定・テンプレ一覧）
├── templates/
│   └── （テンプレート Google Docs を配置）
├── contracts/
│   └── YYYY/MM/
│       └── C-XXX_<相手先>/
│           ├── C-XXX_<相手先>_<テンプレ名>.gdoc
│           └── C-XXX_<相手先>_signed.pdf
└── archive/
    └── （将来利用、v1.0 では未使用）
```

フォルダ ID はすべて `ScriptProperties` に保存します：

```
ROOT_FOLDER_ID
SYSTEM_FOLDER_ID
TEMPLATES_FOLDER_ID
CONTRACTS_FOLDER_ID
LEDGER_ID
AUDIT_LOG_ID
CONFIG_ID
```

---

## データモデル

### ledger — 契約マスタ（contracts シート）

24 カラム構成。

| # | カラム名 | 型 | 説明 |
|---|----------|-----|------|
| 1 | id | string | C-001 形式の連番 ID |
| 2 | created_at | datetime | ISO 8601 |
| 3 | updated_at | datetime | 最終更新日時 |
| 4 | creator_email | email | 作成者 |
| 5 | status | enum | draft / internal_signing / external_signing / signed / rejected |
| 6 | title | string | 件名 |
| 7 | template_id | string | 使用テンプレート |
| 8 | counterparty_name | string | 相手先会社名 |
| 9 | counterparty_rep | string | 相手先代表者 |
| 10 | counterparty_signer_email | email | 相手先署名者メール |
| 11 | counterparty_signer_name | string | 相手先署名者氏名 |
| 12 | internal_signer_email | email | 社内署名者メール |
| 13 | internal_signer_name | string | 社内署名者氏名 |
| 14 | folder_id | string | Drive フォルダ ID |
| 15 | doc_id | string | Google Docs ID |
| 16 | signed_pdf_id | string | 署名済み PDF |
| 17 | esignature_request_id | string | eSignature 依頼 ID |
| 18 | internal_signed_at | datetime | 社内署名完了日時 |
| 19 | counterparty_signed_at | datetime | 相手先署名完了日時 |
| 20 | sent_at | datetime | 署名依頼送信日時 |
| 21 | completed_at | datetime | 締結完了日時 |
| 22 | template_variables | json | テンプレ変数の値 |
| 23 | notes | text | 備考 |
| 24 | tags | string | カンマ区切りタグ |

### ステータス遷移

```
draft
  └──→ (署名依頼送信) ──→ internal_signing
                              └──→ (社内署名完了) ──→ external_signing
                                                         └──→ (相手先署名完了) ──→ signed
                              └──→ (取り下げ) ──→ rejected
external_signing
  └──→ (取り下げ) ──→ rejected
```

### audit_log — 操作ログ（logs シート）

12 カラム、**追記専用**。onEdit トリガーで既存行の改ざんを検知・阻止します。

| # | カラム名 | 説明 |
|---|----------|------|
| 1 | log_id | LOG-YYYYMMDD-HHMMSS-XXXX 形式 |
| 2 | timestamp | ISO 8601 |
| 3 | actor_email | 操作者メール |
| 4 | actor_type | user / system / api |
| 5 | action | contract_created 等（下記参照） |
| 6 | contract_id | 関連する契約 ID |
| 7 | target_type | contract / template / editor 等 |
| 8 | target_id | 操作対象の ID |
| 9 | before_state | 変更前の状態（JSON） |
| 10 | after_state | 変更後の状態（JSON） |
| 11 | metadata | 補足情報（JSON） |
| 12 | description | 人が読める説明文 |

---

## モジュール構成

| ファイル | 責務 |
|----------|------|
| `Code.gs` | doGet / doPost ルーティング、composite operations |
| `ContractManager.gs` | 契約 CRUD、ステータス遷移 |
| `TemplateManager.gs` | テンプレート管理 |
| `ESignature.gs` | Google eSignature API ラッパ |
| `DriveHelper.gs` | Drive フォルダ・ファイル操作 |
| `DocsHelper.gs` | テンプレ変数置換、変数抽出 |
| `Notifier.gs` | Gmail 通知 |
| `AuditLog.gs` | 操作ログ追記・取得 |
| `Config.gs` | 設定読み書き、キャッシュ、editors 管理 |
| `Auth.gs` | 権限チェック（canEdit / requireEditor） |
| `EditorManager.gs` | editors の追加・削除 |
| `Initializer.gs` | 初回セットアップ |
| `triggers/OnEdit.gs` | audit_log 改ざん検知トリガー |
| `triggers/DailySync.gs` | 毎朝 9:00 のステータス同期 |

---

## 権限モデル

二値の権限制御を採用しています。ロール（admin/member/viewer）の概念は v1.0 では存在しません。

```
editor（config の editors シートに登録済み）
    → 全機能: 契約作成・編集・送信、テンプレ管理、エディタ管理

非 editor（登録なし）
    → 閲覧のみ: 一覧・詳細・Docs リンク
```

すべての書き込み系 API は冒頭で `requireEditor()` を呼び出します。これがバイパスされても Drive 側の共有権限が二重防御として機能します。

---

## フロントエンド設計

GAS HtmlService を使ったサーバーサイドレンダリング（SSR）です。

- **HTML テンプレート**: `<?= ?>` でエスケープ出力、`<?!= ?>` で非エスケープ出力（include 等）
- **クライアント → サーバー**: `google.script.run.callServer(action, payload)` の単一エントリポイント
- **共通 UI**: `shared/ConfirmModal.html` を各ページで include して再利用
- **スタイル**: CSS カスタムプロパティ + Vanilla CSS（外部 CDN なし）

---

## 電子署名フロー

```
1. editor が「署名依頼を送信」ボタンを押す
   ↓
2. ESignature.sendRequest(contract)
   → Drive API v2beta POST /files/{docId}/requestSignature
   → signers: [社内署名者(order:1), 相手先(order:2)]
   ↓
3. ledger.status = 'internal_signing'
   ↓
4. 社内署名者が署名
   → eSignature が自動で相手先に転送
   ↓
5. DailySync が毎朝ポーリング（または手動「再同期」）
   → ESignature.getStatus() で状態確認
   → 変更があれば status / 日時フィールドを更新
   → Notifier で通知送信
```

---

## スケーラビリティの考慮

v1.0 は月 10 件規模を想定しています。以下の制約に注意してください：

| 制約 | 上限 | 対処 |
|------|------|------|
| GAS 実行時間 | 6 分 / 実行 | 大量バッチは分割 |
| Drive API レート | 10 req/sec | 必要に応じてスリープ挿入 |
| Spreadsheet 行数 | 実質制限なし（数千行は問題なし） | v1.0 では懸念不要 |
| メール送信数 | 1 日 100 通（Workspace は多め） | 月 10 件なら余裕 |

月 100 件超を想定する場合は、ScriptProperties キャッシュの積極活用と、`AuditLog.list()` のページネーション改善が必要です。
