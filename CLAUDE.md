# gassign — 開発指示書

このドキュメントは、Claude Code でこのプロジェクトを開発する際の指針です。
プロジェクトのコンテキスト、設計思想、実装ルール、優先順位を記載します。

---

## プロジェクト名について

**gassign** = **G**oogle **A**pps **S**cript + **Sign**

このプロダクトは Google Apps Script だけで動作する契約署名システムです。
名前の由来は技術スタックそのもの。シンプルで、隠し事のない命名です。

英語の `assign`（割り当てる、任命する）にも掛かっており、
「契約を assign する」という二重の意味も込められています。

読み方: ジー・アサイン または ガッ・サイン（公式には前者を推奨）

---

## プロジェクト概要

### 何を作るか

gassign は、Google Workspace 上で動作するクラウド契約管理システムです。
freee Sign のような契約管理 SaaS の代替を、Google Apps Script + Google eSignature で実装します。

### このプロジェクトの特徴

- サーバー不要（Google Apps Script のみで動作）
- データストア不要（隠し Spreadsheet が DB の役割）
- 電子署名は Google eSignature に委譲（自前実装しない）
- OSS として公開し、他社の Google Workspace でも動作可能にする

### 想定利用規模

- 月10件程度の契約処理
- 社内利用（オーナー1名 + 担当者数名）
- 利用企業ごとに 1 Workspace 1 デプロイ

### 想定利用者

- Google Workspace Business Standard 以上を契約している中小企業
- 紙の押印業務をデジタル化したいが、freee Sign や クラウドサインの月額費用を払いたくない
- 自社の Workspace 内で契約データを管理したい（外部 SaaS にデータを置きたくない）

---

## 技術スタック

### 確定事項

- **ランタイム**: Google Apps Script (V8)
- **言語**: JavaScript (ES6+)
- **UI**: GAS HtmlService によるWeb App
- **フロントエンド**: Vanilla JS + HTML + CSS（外部依存最小化）
- **データストア**: Google Spreadsheet（隠し運用）
- **ファイル保管**: Google Drive
- **電子署名**: Google eSignature (Drive API 経由)
- **メール送信**: Gmail API / MailApp
- **デプロイツール**: clasp (Command Line Apps Script)

### 採用しない技術と理由

- React / Vue → ビルドステップが必要、GAS との相性が悪い
- TypeScript → clasp 対応はあるが、OSS 導入のハードルを上げる
- Firebase / Firestore → サーバーレス度合いが下がり、導入が複雑化
- 外部 CDN ライブラリ → CSP 制約とオフライン耐性のため最小限に

---

## アーキテクチャ

### 全体構成

```
ブラウザ
    ↓ (HTTPS)
GAS Web App (HtmlService)
    ↓
GAS Backend (Code.gs ほか)
    ↓
┌────────┬────────┬────────┬────────┐
│ Drive  │ Docs   │ eSign  │ Gmail  │
│ API    │ API    │ ature  │ API    │
└────────┴────────┴────────┴────────┘
    ↓
Spreadsheet (ledger / audit_log / config)
```

### データの真実の所在

| 情報 | 真実の所在 | ledger に持つ情報 |
|------|------------|---------------------|
| 契約書の本文 | Google Docs | `doc_id` のみ |
| 署名済みPDF | Drive | `signed_pdf_id` のみ |
| 署名状態 | eSignature API | キャッシュとしての `status` |
| 操作履歴 | audit_log Sheet | なし（audit_log を見る） |
| 自社情報 | config Sheet | なし（config を見る） |

ledger の `status` はキャッシュであり、真実ではない。
「状態を再同期」ボタンで eSignature API から取得して上書きする。

---

## Drive フォルダ構成

初期化スクリプトが以下の構造を自動生成する：

```
gassign/
├── _system/
│   ├── ledger (Spreadsheet)
│   ├── audit_log (Spreadsheet)
│   └── config (Spreadsheet)
├── templates/
│   └── (テンプレートDocsを配置)
├── contracts/
│   └── YYYY/MM/C-XXX_<相手先>_<種類>/
│       ├── C-XXX_<相手先>_<種類>.gdoc
│       ├── C-XXX_<相手先>_<種類>_signed.pdf
│       └── C-XXX_audit.pdf
└── archive/
    └── (将来用、v1.0では未使用)
```

### フォルダID の管理

各フォルダIDは ScriptProperties に保存し、Spreadsheet ID と合わせて参照する。

```javascript
PropertiesService.getScriptProperties().setProperties({
  ROOT_FOLDER_ID: '...',
  SYSTEM_FOLDER_ID: '...',
  TEMPLATES_FOLDER_ID: '...',
  CONTRACTS_FOLDER_ID: '...',
  LEDGER_ID: '...',
  AUDIT_LOG_ID: '...',
  CONFIG_ID: '...'
});
```

---

## データモデル

### ledger (Spreadsheet) — 契約マスタ

シート名: `contracts`、24カラム。

| # | カラム名 | 型 | 必須 | 用途 |
|---|----------|-----|------|------|
| 1 | id | string | ◯ | 契約ID (例: C-058) |
| 2 | created_at | datetime | ◯ | 作成日時 (ISO 8601) |
| 3 | updated_at | datetime | ◯ | 最終更新日時 |
| 4 | creator_email | email | ◯ | 作成者メール |
| 5 | status | enum | ◯ | ステータス |
| 6 | title | string | ◯ | 件名 |
| 7 | template_id | string | ◯ | 使用テンプレID |
| 8 | counterparty_name | string | ◯ | 相手先会社名 |
| 9 | counterparty_rep | string | | 相手先代表者 |
| 10 | counterparty_signer_email | email | ◯ | 相手先署名者メール |
| 11 | counterparty_signer_name | string | ◯ | 相手先署名者氏名 |
| 12 | internal_signer_email | email | ◯ | 社内署名者メール |
| 13 | internal_signer_name | string | ◯ | 社内署名者氏名 |
| 14 | folder_id | string | ◯ | DriveフォルダID |
| 15 | doc_id | string | ◯ | DocsファイルID |
| 16 | signed_pdf_id | string | | 署名済みPDF ID |
| 17 | esignature_request_id | string | | eSignature 依頼ID |
| 18 | internal_signed_at | datetime | | 社内署名完了日時 |
| 19 | counterparty_signed_at | datetime | | 相手先署名完了日時 |
| 20 | sent_at | datetime | | 署名依頼送信日時 |
| 21 | completed_at | datetime | | 締結完了日時 |
| 22 | template_variables | json | | テンプレ変数の値（日付類含む） |
| 23 | notes | text | | 備考 |
| 24 | tags | string | | カンマ区切りタグ |

### status の値

```
draft               作成中
internal_signing    社内署名待ち
external_signing    相手先署名待ち
signed              締結済
rejected            却下
```

### audit_log (Spreadsheet) — 操作ログ

シート名: `logs`、12カラム、追記専用。

| # | カラム名 | 型 | 必須 |
|---|----------|-----|------|
| 1 | log_id | string | ◯ |
| 2 | timestamp | datetime | ◯ |
| 3 | actor_email | email | ◯ |
| 4 | actor_type | enum (user/system/api) | ◯ |
| 5 | action | enum | ◯ |
| 6 | contract_id | string | |
| 7 | target_type | enum | ◯ |
| 8 | target_id | string | ◯ |
| 9 | before_state | json | |
| 10 | after_state | json | |
| 11 | metadata | json | |
| 12 | description | string | ◯ |

### action の値

```
contract_created, contract_edited, contract_sent,
contract_internal_signed, contract_external_signed,
contract_completed, contract_rejected, contract_withdrawn,
contract_reminded,
template_created, template_edited, template_deleted,
config_changed, signer_added, signer_removed,
system_initialized, sync_executed, alert_sent
```

### config (Spreadsheet) — 設定

5シート構成: `general`, `signers`, `editors`, `notifications`, `templates`。

#### general シート

| key | type | example |
|-----|------|---------|
| our_company_name | string | sator株式会社 |
| our_company_address | string | 東京都... |
| our_representative | string | 代表取締役 瀬野陽介 |
| next_contract_id | integer | 59 |
| app_version | string | 1.0.0 |
| initialized_at | datetime | 2026-04-01T00:00:00+09:00 |
| root_folder_id | string | 1aB2c... |

#### signers シート

| signer_id | role | name | email | applies_to | priority | active |
|-----------|------|------|-------|-----------|----------|--------|

#### editors シート

| email | name | added_at | added_by | active |
|-------|------|----------|----------|--------|
| seno@sator-inc.com | 瀬野陽介 | 2026-04-01... | seno@... | TRUE |
| admin-staff@sator-inc.com | 管理担当 | 2026-04-15... | seno@... | TRUE |

editors シートに記載されたメールアドレスのユーザーが、システム上で編集系の操作（契約作成、編集、送信、テンプレ管理、設定変更）を行える。
このシートに無いユーザーは閲覧のみ可能。

#### notifications シート

| event | enabled | recipient | template |
|-------|---------|-----------|----------|
| contract_sent | TRUE | creator | 署名依頼を送信しました |
| internal_signed | TRUE | creator | 社内署名が完了しました |
| completed | TRUE | creator,signer | 契約が締結されました |

#### templates シート

| template_id | name | category | docs_id | description | usage_count | active |
|-------------|------|----------|---------|-------------|-------------|--------|

---

## 画面構成

### 6画面 + 1モーダル

| 画面 | URL パラメータ | 役割 | 権限 |
|------|---------------|------|------|
| ダッシュボード | `?view=dashboard` | 起点・一覧 | 全員 |
| 新規契約作成 | `?view=new` | 3ステップフォーム | editor のみ |
| 契約詳細 | `?view=contract&id=C-XXX` | 状態確認・操作 | 全員（編集系は editor） |
| テンプレート管理 | `?view=templates` | テンプレ追加・編集 | editor のみ |
| 監査ログ | `?view=audit` | 操作履歴の検索 | editor のみ |
| エディタ管理 | `?view=editors` | 編集権限ユーザーの管理 | editor のみ |

### 汎用確認モーダル

破壊的・不可逆な操作（署名依頼の送信、契約の取り下げ、editor の削除など）を実行する前に表示する共通の確認モーダル。

仕様:
- タイトル、説明文、確認ボタンのラベルを呼び出し側から指定できる
- 「キャンセル」ボタンは常に表示
- 必要に応じて理由入力欄（textarea）を任意で表示できる（取り下げ等で使用）
- モーダル外クリック・ESC キーでキャンセル可能

実装方針:
- shared/ConfirmModal.html として 1 つだけ実装し、各画面から再利用する
- 各画面で個別のモーダルを作らない（増えると UX もコードも崩れる）

```javascript
// 呼び出し例
ConfirmModal.show({
  title: '署名依頼を送信しますか？',
  description: '送信後は内容を変更できません。',
  confirmLabel: '送信',
  requireReason: false,
  onConfirm: () => sendSignatureRequest(contractId)
});
```

### ダッシュボードのメトリクスカード（3つ）

```
作成中 / 社内署名待ち / 相手先署名待ち
```

「ボールが誰にあるか」が一目で分かる構成。
締結済の累計はテーブル側のフィルタで閲覧可能とする。

### 新規契約作成フロー

3ステップ:

1. **テンプレ選択**
2. **情報入力** (基本情報 / 署名者 / テンプレ変数)
3. **確認・送信**

社内署名者は config.signers から選択（プルダウン）。
テンプレ変数は Docs 内の `{{key}}` 記法を自動検出して入力欄を動的生成。

### 契約詳細の主要要素

- 契約サマリ（ID, 状態バッジ, 相手先, 担当者）
- 契約書ファイル（Docsで開く / PDFダウンロード）
- eSignature 状態（リアルタイム or 「再同期」ボタン）
- アクション（ステータスに応じて動的に変化）
- 履歴（audit_log から contract_id でフィルタ）

---

## マルチユーザ対応

### 設計方針

組織内の複数ユーザーが gassign を使えるようにする。  
ただし、「権限はシンプルに二値で管理する」原則を守る。

### 権限モデル

二値の権限制御:
- **editor**: 全機能を利用可能（契約作成、編集、送信、テンプレ管理、設定変更、editorsの追加削除）
- **非editor**: 閲覧のみ可能（一覧、詳細、PDF DL）

ロール（admin/member/viewer）の概念は導入しない。  
「editors リストにあるか、ないか」のみで判定する。  
「viewer ロール」は明示的に作らない（editor じゃない人 = 暗黙の閲覧者）。

### editors の管理

config の `editors` シートで管理。  
editor ユーザーは Web App の「エディタ管理」画面から、他のユーザーを editor として追加・削除可能。

```
editors シート:
| email | name | added_at | added_by | active |
|-------|------|----------|----------|--------|
| seno@sator-inc.com | 瀬野陽介 | 2026-04-01... | system | TRUE |
| admin-staff@sator-inc.com | 管理担当 | 2026-04-15... | seno@... | TRUE |
```

`added_by` には追加した editor の email を記録。監査性のため。  
初期 editor は Initializer.gs で自動的に追加（実行ユーザー = オーナー）。

### 権限チェックの実装

```javascript
// Auth.gs

/**
 * Check if the current user is an editor.
 * 現在のユーザーが editor 権限を持つかチェック
 */
function canEdit() {
  const email = Session.getActiveUser().getEmail();
  if (!email) return false;  // 未認証
  
  const editors = Config.getEditors();
  return editors.some(e => e.email === email && e.active === true);
}

/**
 * Throw if the current user is not an editor.
 * editor でなければ例外を投げる
 */
function requireEditor() {
  if (!canEdit()) {
    throw new Error('この操作には編集権限が必要です。管理者にお問い合わせください。');
  }
}

/**
 * Get current user info including edit permission.
 */
function getCurrentUser() {
  const email = Session.getActiveUser().getEmail();
  return {
    email: email,
    canEdit: canEdit()
  };
}
```

### バックエンドAPI への組み込み

すべての編集系関数の **冒頭に** `requireEditor()` を呼ぶ：

```javascript
function createContract(params) {
  requireEditor();
  // ...
}

function updateContract(id, params) {
  requireEditor();
  // ...
}

function sendSignatureRequest(id) {
  requireEditor();
  // ...
}

function addEditor(email, name) {
  requireEditor();
  // ...
}

function removeEditor(email) {
  requireEditor();
  // 自分自身を削除しようとしている場合は警告
  if (email === Session.getActiveUser().getEmail()) {
    throw new Error('自分自身を editors から削除することはできません');
  }
  // ...
}
```

読み取り系関数（getContract, listContracts 等）には requireEditor() を呼ばない。
ただし `getAuditLog` は監査ログが editor 限定のため例外的に `requireEditor()` を呼ぶ。

### UI への反映

各画面で `getCurrentUser()` の結果を取得し、`canEdit` の値で UI を切り替える：

```javascript
// HTML テンプレート内の例
<? if (currentUser.canEdit) { ?>
  <button onclick="createContract()">+ 新規契約</button>
<? } ?>
```

権限がないユーザーには：
- 編集系のボタンが表示されない
- ナビゲーションから「テンプレ管理」「エディタ管理」が非表示
- 契約詳細では「Docsで開く」「PDFダウンロード」のみ表示

### 重要な不変条件

editors は **常に最低1人** いる必要がある：
- editors が 0人になると、誰も管理できなくなる
- `removeEditor()` は editors が1人の時はエラーにする
- 自分自身を削除しようとした場合もエラー

### 初期化時の動作

Initializer.gs の `initializeApp()` で：
1. editors シートを作成
2. 実行ユーザー（= オーナー）を最初の editor として追加
3. audit_log に `editor_added` を記録

### 監査ログへの追加

新しい action を追加：

```
editor_added       editor を追加
editor_removed     editor を削除
editor_deactivated editor を一時無効化
permission_denied  権限エラーが発生（不正試行の追跡用）
```

### Drive 共有設定との連携

Web App デプロイ設定:
```
Execute as: User accessing the web app（実行ユーザー）
Who has access: Anyone within the organization（組織内全員）
```

Drive フォルダ共有設定（推奨）:
```
gassign フォルダ:
  編集権限: editors と同じメンバー
  閲覧権限: 組織内全員

_system フォルダ:
  編集権限: editors のみ
  閲覧権限: editors のみ

contracts フォルダ:
  編集権限: editors のみ
  閲覧権限: 組織内全員
```

これにより、アプリの権限制御 + Drive の権限制御の **二重防御** が実現される。
editors じゃない人がアプリの権限チェックをバイパスしようとしても、Drive 側で書き込みが拒否される。

### v2.0 への発展余地（やらない）

将来的に v2.0 で以下を追加する可能性があるが、v1.0 では実装しない：
- ロール（admin / member）
- 契約ごとの visibility（public / restricted / private）
- 部署/チーム概念
- 承認フロー

---

## 署名フロー

### 2段階署名

```
[作成者: seno@] が契約書作成
    ↓ 送信
[社内署名者: boss@] が署名 (1番目)
    ↓ 自動転送 (eSignatureが処理)
[相手先: counterparty@] が署名 (2番目)
    ↓
締結完了
```

### eSignature 呼び出し時の構成

```javascript
{
  signers: [
    {
      role: '社内署名者',
      email: 'boss@sator-inc.com',
      signing_order: 1
    },
    {
      role: '相手先',
      email: 'counterparty@example.com',
      signing_order: 2
    }
  ]
}
```

### ステータス遷移

```
draft
  └→ (送信ボタン) → internal_signing
                       └→ (社内署名完了) → external_signing
                                              └→ (相手先署名完了) → signed
                       └→ (取り下げ) → rejected
                       
external_signing
  └→ (取り下げ) → rejected
```

---

## ファイル構成

### リポジトリ構成

```
gassign/
├── README.md
├── LICENSE  (MIT)
├── CLAUDE.md  (このファイル)
├── docs/
│   ├── setup.md
│   ├── architecture.md
│   ├── api.md
│   └── screenshots/
├── src/
│   ├── appsscript.json     # スコープ定義
│   ├── Code.gs             # エントリポイント (doGet, doPost)
│   ├── ContractManager.gs  # 契約CRUD
│   ├── TemplateManager.gs  # テンプレートCRUD
│   ├── ESignature.gs       # eSignature API ラッパ
│   ├── DriveHelper.gs      # Drive操作のラッパ
│   ├── DocsHelper.gs       # Docs変数置換など
│   ├── Notifier.gs         # メール通知
│   ├── AuditLog.gs         # 監査ログ追記
│   ├── Config.gs           # 設定読み書き
│   ├── Auth.gs             # 権限チェック
│   ├── EditorManager.gs    # editors の追加・削除
│   ├── Initializer.gs      # 初期化スクリプト
│   ├── views/
│   │   ├── Dashboard.html
│   │   ├── NewContract.html
│   │   ├── ContractDetail.html
│   │   ├── Templates.html
│   │   ├── AuditLog.html
│   │   ├── Editors.html    # エディタ管理
│   │   └── shared/
│   │       ├── ConfirmModal.html  # 汎用確認モーダル
│   │       └── (共通CSS/JS)
│   └── triggers/
│       ├── OnEdit.gs       # audit_log改ざん検知
│       └── DailySync.gs    # 毎朝のステータス同期
├── templates/              # サンプルテンプレート
│   ├── nda_standard.md
│   ├── outsourcing_quasi.md
│   └── ...
└── tests/
    └── ...
```

### モジュール責務

| モジュール | 責務 |
|------------|------|
| Code.gs | doGet/doPost、ルーティング |
| ContractManager.gs | 契約のCRUD、ステータス遷移 |
| TemplateManager.gs | テンプレートの登録・取得 |
| ESignature.gs | Google eSignature API 呼び出し |
| DriveHelper.gs | フォルダ作成、ファイルコピー |
| DocsHelper.gs | テンプレ変数の置換 |
| Notifier.gs | Gmail通知 |
| AuditLog.gs | 操作の追記（必ず使う） |
| Config.gs | configシートの読み書き、キャッシュ |
| Auth.gs | 権限チェック（canEdit, requireEditor） |
| EditorManager.gs | editors の追加・削除 |
| Initializer.gs | 初回セットアップ |

---

## 実装ルール

### 必須ルール

1. **すべての操作は audit_log に記録する**
   - 契約変更、テンプレ編集、設定変更、ステータス遷移など
   - `AuditLog.log()` を呼ばない実装は許可しない

2. **状態の真実は外部に置く**
   - ledger は読み取り中心
   - 署名状態は必ず eSignature API で確認する余地を残す
   - 「再同期」できる構造にする

3. **エラー時の挙動を明示する**
   - 例外を握り潰さない
   - ユーザーに表示するエラーメッセージは日本語で具体的に
   - 内部ログにはスタックトレースを残す

4. **改ざん防止**
   - audit_log は onEdit トリガーで上書き禁止
   - ledger の重要カラム（id, created_at, status）も保護対象

5. **ロックを取る**
   - 契約ID採番、ledger 書き込みは `LockService` で排他制御
   - タイムアウトは 10 秒、失敗時はリトライしない

### コーディング規約

- 関数名: camelCase
- 定数: UPPER_SNAKE_CASE
- ファイル名: PascalCase.gs
- インデント: スペース 2
- 文字列: シングルクォート優先
- セミコロン: 必須
- JSDoc: 公開関数には必ず付ける

### コメント方針

```javascript
/**
 * Create a new contract from a template.
 * 新規契約をテンプレートから作成する。
 * 
 * @param {Object} params - Contract parameters
 * @param {string} params.templateId - Template ID
 * @param {string} params.counterpartyName - Counterparty company name
 * @returns {string} Contract ID (e.g., "C-058")
 * @throws {Error} If template not found or quota exceeded
 */
function createContract(params) {
  // ...
}
```

英語と日本語を併記。OSS として海外利用者にも配慮。

### 文字列リソース

ユーザー向けメッセージは i18n を見据え、`messages.gs` に集約：

```javascript
const MESSAGES = {
  ja: {
    contract_created: '契約を作成しました',
    contract_sent: '署名依頼を送信しました',
    // ...
  },
  en: {
    contract_created: 'Contract created',
    contract_sent: 'Signature request sent',
    // ...
  }
};
```

v1.0 は ja のみ実装。多言語対応（en 等）は v2.0 以降で検討。

---

## 開発の優先順位（フェーズ）

### Phase 1: コア基盤（Week 1-2）

実装するもの:
- [ ] Initializer.gs（フォルダ・Sheet 自動生成、初期 editor 登録）
- [ ] Config.gs（読み書き、キャッシュ、editors の取得）
- [ ] Auth.gs（canEdit, requireEditor, getCurrentUser）
- [ ] AuditLog.gs（追記、改ざん検知）
- [ ] ContractManager.gs（CRUD のみ、署名はまだ）
- [ ] DriveHelper.gs（フォルダ操作）

確認方法:
- 初期化スクリプトを実行して、Drive と Sheets が想定通り作成される
- 初期化したユーザーが editors に自動登録される
- 手動で contracts シートに行を追加 → audit_log に記録される
- audit_log の過去レコードを編集しようとすると阻止される
- canEdit() が editor / 非editor を正しく判定する

### Phase 2: 契約作成フロー（Week 3-4）

実装するもの:
- [ ] DocsHelper.gs（テンプレ変数置換）
- [ ] TemplateManager.gs
- [ ] Web App の doGet ルーティング
- [ ] Dashboard.html（読み取り専用、currentUser に応じて UI 切り替え）
- [ ] NewContract.html（3ステップ、editor のみアクセス可）
- [ ] ContractDetail.html（基本表示、編集系ボタンは editor のみ）

確認方法:
- ダッシュボードで契約一覧が表示される
- editor は「+ 新規契約」ボタンが見える、非editor は見えない
- 新規契約作成 → Drive に Docs が生成される
- 契約詳細で Docs リンクが機能する
- 非editor が直接 ?view=new を叩くとリダイレクトされる

### Phase 3: 署名連携（Week 5-6）

実装するもの:
- [ ] ESignature.gs（送信・状態取得）
- [ ] 契約詳細の「送信」ボタン
- [ ] ステータス同期トリガー（毎朝）
- [ ] 「状態を再同期」ボタン
- [ ] Notifier.gs（送信完了・社内署名完了・締結完了の通知）

確認方法:
- 「送信」を押すと社内署名者にメールが届く
- 社内署名後、自動で相手先にメールが転送される
- 全員署名後、ステータスが signed になる
- 各イベントで Gmail 通知が届く

### Phase 4: 管理機能（Week 7）

実装するもの:
- [ ] Templates.html（テンプレ管理画面、editor のみ）
- [ ] AuditLog.html（監査ログ画面、editor のみ）
- [ ] EditorManager.gs（editor の追加・削除）
- [ ] Editors.html（エディタ管理画面、editor のみ）
- [ ] リマインダー機能
- [ ] 取り下げ機能

確認方法:
- editor 画面から他のユーザーを editor として追加できる
- editor を削除できる（最後の1人は削除不可）
- editor 追加・削除が audit_log に記録される

### Phase 5: OSS公開準備（Week 8）

- [ ] README（日本語、コピーリンクを最上部に配置）
- [ ] 配布用「正式版 Apps Script プロジェクト」を作成し、`/copy` リンクを発行
- [ ] GitHub Actions（main ブランチ更新時に clasp push で正式版プロジェクトへ同期）
- [ ] セットアップ動画 / GIF（コピーリンクから 2 分で起動できることを示す）
- [ ] アーキテクチャ図
- [ ] 貢献ガイドライン（コントリビューターは clasp 経由で開発する旨を明記）
- [ ] LICENSE (MIT)
- [ ] サンプルテンプレート整備
- [ ] GitHub Actions（lint）
- [ ] 公開・告知

---

## API 設計（GAS Web App エンドポイント）

### doGet ルーティング

```
GET /?view=dashboard
GET /?view=new                  # editor のみ
GET /?view=contract&id=C-XXX
GET /?view=templates            # editor のみ
GET /?view=audit                # editor のみ
GET /?view=editors              # editor のみ
```

非editor が editor 専用画面の URL を直接叩いた場合は、ダッシュボードへリダイレクトする。

### doPost エンドポイント

```javascript
// 契約関連
POST { action: 'createContract', params: {...} }       // editor only
POST { action: 'updateContract', id, params }          // editor only
POST { action: 'sendSignatureRequest', id }            // editor only
POST { action: 'syncStatus', id }                      // editor only
POST { action: 'sendReminder', id }                    // editor only
POST { action: 'withdrawContract', id }                // editor only

// 読み取り系
POST { action: 'getContract', id }                     // 全員
POST { action: 'listContracts', filters }              // 全員
POST { action: 'getAuditLog', filters }                // editor only

// テンプレート関連
POST { action: 'createTemplate', params }              // editor only
POST { action: 'updateTemplate', id, params }          // editor only
POST { action: 'listTemplates' }                       // 全員

// エディタ管理
POST { action: 'addEditor', email, name }              // editor only
POST { action: 'removeEditor', email }                 // editor only
POST { action: 'listEditors' }                         // editor only
POST { action: 'getCurrentUser' }                      // 全員（UI 制御用）
```

レスポンスは常に JSON:

```javascript
{
  success: true,
  data: {...},
  message: '...'
}
// or
{
  success: false,
  error: { code: '...', message: '...' }
}
```

### 重要な内部 API

```javascript
// ContractManager.gs
ContractManager.create(params) -> contractId
ContractManager.get(id) -> contract object
ContractManager.list(filters) -> array
ContractManager.updateStatus(id, newStatus) -> void

// ESignature.gs
ESignature.sendRequest(contractId, signers) -> requestId
ESignature.getStatus(requestId) -> status string
ESignature.cancelRequest(requestId) -> void

// AuditLog.gs (must call after every state change)
AuditLog.log({
  actor_email,
  action,
  contract_id,
  before_state,
  after_state,
  description
})
```

---

## セキュリティ

### スコープ宣言

`appsscript.json` で必要最小限のスコープを宣言：

```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/script.container.ui",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/userinfo.email"
  ]
}
```

### Web App デプロイ設定

- Execute as: User accessing the web app（実行ユーザー権限）
- Who has access: Anyone within the organization（組織内全員）

これにより、Drive のフォルダ権限がそのまま反映される。
非editor のユーザーがアプリの権限チェックをバイパスしようとしても、Drive 側で書き込みが拒否される。

### 改ざん検知

- audit_log の onEdit トリガー
- ledger の主キー保護
- スプレッドシート全体への共有権限を最小化

### 個人情報の取り扱い

- 契約データは利用者の Google Drive 内に保管
- 外部 API への送信は eSignature のみ
- ログに署名者の個人情報は記録するが、Drive 外に出ない

---

## テスト戦略

### v1.0 の最低限

- 手動テスト（テストケース一覧を docs/testing.md に整備）
- ユニットテストはなし（GAS の制約とコスト対効果で見送り）

### v2.0 以降

- gas-mock-globals + Jest で主要関数のユニットテスト
- 契約作成フローのE2Eテスト（手動）

---

## OSS としての公開方針

### ライセンス

MIT License

### README に書くこと

- プロジェクト概要
- 主要機能
- スクリーンショット / GIF
- セットアップ手順（5分以内で完了する想定）
- アーキテクチャ図
- 制約・注意事項
- 貢献方法
- ライセンス

### セットアップの簡単さ

利用者向けセットアップ手順（**Apps Script プロジェクトのコピーリンク方式**）:

```
1. README のセットアップリンクをクリック
   → 自分の Google Drive に Apps Script プロジェクトがコピーされる
2. Apps Script エディタで initializeApp() を1回実行（権限承認）
3. 「デプロイ」→「ウェブアプリ」として公開
   - Execute as: User accessing the web app
   - Who has access: Anyone within the organization
4. 表示された Web App URL をブックマーク
```

**目標: 2分以内、ブラウザのみで完結**。clasp も Node.js も不要。

#### コピーリンクの仕組み

- メンテナ（OSS リポジトリ管理者）が「正式版 Apps Script プロジェクト」を 1 つ Drive に保有する
- そのプロジェクトの URL に `/copy` を付けたリンクを README に掲載する  
  例: `https://script.google.com/d/{SCRIPT_ID}/copy`
- 利用者がクリックすると「コピーを作成」ダイアログが開き、自分の Drive にプロジェクト一式がコピーされる
- Apps Script は HTML/CSS を含む全ファイルを丸ごとコピーするため、`src/` 配下が一括で配布される

#### 正式版プロジェクトの同期

- GitHub の `main` ブランチが**コードの真実**
- 正式版 Apps Script プロジェクトは「配布用ミラー」として位置づける
- リリース時に GitHub Actions で `clasp push` を実行し、正式版プロジェクトへ反映する
- 利用者は手元のコピーを使い続け、アップデートが必要なら再度コピーリンクから取り直す（破壊的変更時はデータ移行手順を README に明記）

#### 開発者向け（コントリビューター）

開発・デバッグ時は従来通り clasp を使う:

```
1. git clone
2. clasp login
3. clasp clone <自分の検証用 SCRIPT_ID>
4. clasp push
```

利用者向けと開発者向けで導線を分け、利用者には clasp の存在を一切見せない。

### SCRIPT_ID 管理

#### 基本方針

- SCRIPT_ID は**公開情報**（コピーリンクに丸見え）。秘匿しない
- 真実の所在は **`release.config.json` の 1 ファイルのみ**
- README には実 ID を埋め込んだコピーリンクを直接記載する（クリック即起動のため、placeholder は使わない）

#### ファイルレイアウト

| ファイル | 状態 | 役割 |
|---------|------|------|
| `release.config.json` | git 管理 | `scriptId` / `webAppUrl` / `version` を保持。**唯一の真実** |
| `README.md` | git 管理 | 実 ID を埋め込んだコピーリンク（`https://script.google.com/d/{SCRIPT_ID}/copy`）を直接記載 |
| `.clasp.production.json` | git 管理 | CI が `clasp push` 時に `.clasp.json` にコピーする配布用設定。`scriptId` は `release.config.json` と一致させる |
| `.clasp.json` | **gitignore** | 各開発者の検証用 SCRIPT_ID。コミットしない |
| `.gitignore` | git 管理 | `.clasp.json` を除外する設定を含める |

#### `release.config.json` のスキーマ

```json
{
  "scriptId": "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789AbCdEfGhIj",
  "webAppUrl": "https://script.google.com/a/macros/{domain}/s/.../exec",
  "version": "1.0.0",
  "releasedAt": "2026-05-15T00:00:00+09:00"
}
```

`scriptId` は配布用「正式版 Apps Script プロジェクト」のもの。
開発者個人の検証用 SCRIPT_ID はここに書かない（`.clasp.json` に各自で持つ）。

#### CI 連携（GitHub Actions）

`main` ブランチへの push をトリガーとして:

1. `release.config.json` を読み取り、`scriptId` を取得
2. `.clasp.production.json` の内容を `.clasp.json` として配置
3. CI シークレットから `clasprc.json`（認証情報）を復元
4. `clasp push` を実行 → 正式版 Apps Script プロジェクトが更新される

CI シークレットに必要なもの: `CLASPRC_JSON`（メンテナの clasp ログイン情報）。
`scriptId` 自体はシークレットではないので、`release.config.json` から普通に読む。

#### フォーク利用者の手順

別組織が gassign を独自運用する場合に書き換える箇所は **2 つだけ**:

1. `release.config.json` の `scriptId` を自組織の正式版プロジェクト ID に変更
2. README のコピーリンクの SCRIPT_ID を同じ値に置換

CONTRIBUTING.md にこの 2 箇所を明記する。スクリプトでの一括置換例も載せる:

```bash
# フォーク後、SCRIPT_ID を自分のプロジェクトに置き換える
NEW_ID="自分のSCRIPT_ID"
jq ".scriptId = \"$NEW_ID\"" release.config.json > tmp && mv tmp release.config.json
sed -i.bak "s|/d/[^/]*/copy|/d/$NEW_ID/copy|g" README.md
```

#### 禁止事項

- **`.clasp.json` をコミットしない** — 開発者ごとに違う検証用プロジェクトを指すため、コミットすると上書き合戦になる
- **README に placeholder（`{{SCRIPT_ID}}` 等）を残さない** — 利用者がリンクをクリックして失敗する事故を防ぐ
- **SCRIPT_ID を 2 箇所以上に手で書かない** — `release.config.json` を起点に、他は CI かフォーク手順で同期する

### 想定される質問への準備

- Google eSignature が使えないプランの場合は？ → README で必要プランを明示
- 社員に Workspace アカウントがない外部ベンダーは？ → eSignature の仕様で外部メールでも署名可能と説明
- 既存の契約書をインポートしたい → v2.0 機能として記載
- 法的効力は？ → 電子サイン (eSignature) と電子署名 (electronic signature) の違いを明示
- アップデートが出たらどうする？ → コピーリンクから再コピーして、新プロジェクトにデータ移行する手順を README に明記

---

## 既知の制約と対処

| 制約 | 対処 |
|------|------|
| GAS の実行時間制限 (6分) | 大量バッチ処理は分割実行 |
| Drive API のレート制限 | リトライ + 指数バックオフ |
| Google eSignature の機能制限（DocuSign 比） | 複雑な条件分岐ワークフローは v1.0 では非対応 |
| Workspace Business Standard 以上が必要 | README で明示、Individual プランは対象外 |
| 月間処理件数 | 月100件超は ScriptProperties キャッシュ等の最適化が必要、v1.0 は10件想定 |

---

## 設計上の禁止事項

実装中に「やりたくなる」が、やってはいけないこと：

1. **ledger を直接 UI で編集させない**  
   常に Web App 経由で操作する。手で書き換えると audit_log との整合性が崩れる。

2. **status を直接書き換えない**  
   `ContractManager.updateStatus()` を経由する。これが audit_log を確実に書く。

3. **eSignature の状態を信用しすぎない**  
   ledger の status はあくまでキャッシュ。重要な処理（PDFダウンロードなど）の前は再同期する。

4. **テンプレ Docs を直接削除しない**  
   削除ではなく `active = FALSE` で論理削除する。過去契約からの参照を保つため。

5. **エラーメッセージにシステム情報を漏らさない**  
   ファイルパス、ID、スタックトレースをユーザーに見せない。  
   内部ログには出すが、UI には汎用メッセージを表示。

6. **承認フローを v1.0 で実装しようとしない**  
   sator では現状不要、追加するなら v2.0 以降。スコープを増やさない。

7. **編集系の API で requireEditor() を忘れない**  
   契約変更、テンプレ編集、editor 追加削除など、すべての書き込み系 API は冒頭で `requireEditor()` を呼ぶ。  
   読み取り系（getContract, listContracts）には呼ばない。  
   ただし `getAuditLog` は監査ログが editor 限定のため例外的に `requireEditor()` を呼ぶ。

8. **editors を 0人にできるロジックを書かない**  
   `removeEditor()` は editors が1人の時にエラーを返す。最後の editor が自分自身を削除しようとした時もエラー。

9. **viewer ロールを実装しない**  
   editor じゃない人は暗黙的に閲覧者として扱う。明示的なロールは v1.0 では作らない。

10. **ロール（admin/member）を導入しない**  
    v1.0 は二値（editor or not）のみ。v2.0 まで複雑化を避ける。

---

## Claude Code への指示

### 開発を始める時

1. このファイル（CLAUDE.md）と関連ドキュメントをすべて読み込む
2. Phase 1 から順に実装する
3. 各 Phase 完了時に動作確認を行い、報告する
4. 設計に疑問が生じたら、勝手に判断せず質問する

### 実装時の判断基準

迷った時の判断軸（優先順）：

1. **シンプルさ** — 機能を増やすより、機能を絞る
2. **OSS 公開耐性** — 他社が使えるように、設定で吸収できる構造に
3. **データ整合性** — audit_log への記録を忘れない
4. **Google 標準機能の活用** — 自前実装より Google に任せる

### よく使うパターン

#### 操作のラッピング

```javascript
function someAction(params) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    // 1. 事前状態を取得
    const before = ContractManager.get(params.id);
    
    // 2. 実際の処理
    const result = doActualWork(params);
    
    // 3. 事後状態を取得
    const after = ContractManager.get(params.id);
    
    // 4. 監査ログに記録
    AuditLog.log({
      actor_email: Session.getActiveUser().getEmail(),
      action: 'contract_xxx',
      contract_id: params.id,
      before_state: before,
      after_state: after,
      description: '...'
    });
    
    return result;
  } catch (e) {
    Logger.log(e.stack);
    throw new Error('処理に失敗しました');
  } finally {
    lock.releaseLock();
  }
}
```

#### 設定値の取得

```javascript
function getSomeSetting() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('config_general_xxx');
  if (cached) return cached;
  
  const value = Config.get('general', 'xxx');
  cache.put('config_general_xxx', value, 600); // 10分
  return value;
}
```

#### Web App からのレスポンス

```javascript
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
```

---

## 参考: 議論で却下された案

設計プロセスで検討して採用しなかった案を記録（再度議論しないため）。

| 検討した案 | 却下理由 |
|------------|----------|
| Sheets を直接 UI として使う | 誤操作のリスク高、保護管理が複雑 |
| Firestore + Firebase Functions | 導入ハードルが高く OSS 配布に不向き |
| 有効期限切れステータス | 自動更新前提の業界では発生しない |
| 解約・終了ステータス | sator 業界では発生頻度ほぼゼロ |
| 解約通知期限のアラート | 解約概念が業務にないため不要 |
| 停滞アラート (30日+) | 月10件規模では過剰 |
| effective_date / expiry_date カラム | 契約書本文に書けば十分、システム管理不要 |
| 社内承認フロー | sator では捺印者=社長のみで完結 |
| 相手先ごとのフォルダ分け | 表記ゆれで管理が破綻、年月別が安定 |
| viewer ロール | editor 以外は暗黙的に閲覧者扱い、明示的なロール不要 |
| ロール（admin/member/viewer） | 二値（editor or not）で十分、複雑化を避ける |
| 契約ごとの visibility 設定 | v2.0 まで保留、v1.0 では全 editor が全契約にアクセス可 |
| 契約 watchers / owner 概念 | YAGNI、必要になった時点で v2.0 で追加 |

---

## 質問・相談先

実装で不明点があれば、以下の順で確認：

1. このドキュメント (CLAUDE.md) を再確認
2. docs/ 配下の関連ドキュメントを確認
3. オーナー（瀬野陽介）に質問

設計判断で迷う時は、必ず質問する。勝手に拡張しない。

---

## バージョン履歴

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0-draft | 2026-04-30 | 初版作成、Phase 1 開始前 |
| 1.0.1-draft | 2026-05-01 | プロダクト名を gassign に決定、マルチユーザ対応（editors）を v1.0 に統合、矛盾整理 |
