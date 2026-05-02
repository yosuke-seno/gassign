# gassign

> Google Workspace で動く、シンプルな契約管理システム  
> A simple contract management system that runs on Google Workspace

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Apps Script](https://img.shields.io/badge/Apps%20Script-V8-4285F4)](https://developers.google.com/apps-script)
[![Status](https://img.shields.io/badge/status-v1.0-green)](https://github.com/sator-inc/gassign)

---

## [▶ gassign をコピーして使い始める](https://script.google.com/d/REPLACE_WITH_PRODUCTION_SCRIPT_ID/copy)

> クリックするだけで自分の Drive に Apps Script プロジェクトがコピーされます。  
> Node.js 不要・clasp 不要。ブラウザだけで 2 分以内に起動できます。  
> 詳しくは [クイックスタート（コピーリンク方式）](#クイックスタートコピーリンク方式2分) を参照してください。

---

## このプロジェクトについて

**gassign** は、Google Apps Script だけで動く契約管理 OSS です。  
Google Drive と Google eSignature を組み合わせて、freee Sign や クラウドサインのような契約管理を、自社の Workspace 内で完結させます。

サーバー不要・データベース不要・月額費用なし。Workspace に既に払っているプラン料金以外、追加コストはかかりません。

### 何ができるか

- 契約書をテンプレートから素早く作成
- Google eSignature で電子署名（社内 → 相手先の2段階）
- 契約の状態を一目で把握できるダッシュボード
- 全操作の監査ログ（改ざん検知付き）
- データはすべて自社 Drive に保管（外部 SaaS にアップロード不要）

### 何ができないか

正直に書きます。以下の用途には向きません：

- 月100件を超える大量処理（月10件規模を想定）
- 電子署名法第3条に基づく厳密な電子署名（タイムスタンプ認証局未対応）
- 複雑な多段階承認ワークフロー
- DocuSign / Adobe Sign レベルの高度な署名機能

これらが必要な場合は、freee Sign やクラウドサインなどの専用 SaaS をおすすめします。

---

## なぜ作ったか

中小企業の契約管理には、以下のジレンマがあります：

- **紙とハンコは効率が悪い** — 押印のために出社、郵送、保管場所の確保
- **専用 SaaS は月額コストが重い** — 月数件なのに固定費を払い続ける
- **Excel と Drive の手作業管理は限界** — 抜け漏れ、検索性、属人化

gassign は、**「Google Workspace を既に使っているなら、契約管理もそこで完結すべき」** という思想で作られています。Google が提供する eSignature 機能をフルに活用し、自分たちで作るのは「契約台帳」と「ワークフロー」だけ。これだけで実用的な契約管理システムが組めます。

---

## プロダクト名の由来

**gassign** = **G**oogle **A**pps **S**cript + **Sign**

技術スタックそのものを名前にしました。GAS（Google Apps Script）製の契約署名（Sign）システムです。

英語の `assign`（割り当てる、任命する）にも掛かっており、「契約を assign する」という二重の意味も込められています。

読み方: **ジー・アサイン**（公式推奨）または ガッ・サイン

---

## スクリーンショット

### ダッシュボード

ボールが「自分にあるか / 社内にあるか / 先方にあるか」が一目で分かる構成。

> ![Dashboard](docs/screenshots/dashboard.png)

### 新規契約作成

3ステップで完結。月10件なら毎回1分以内で作成できます。

> ![New Contract](docs/screenshots/new-contract.png)

### 契約詳細

ステータスごとに表示されるアクションが変わるので、迷子になりません。

> ![Contract Detail](docs/screenshots/contract-detail.png)

---

## 動作要件

### 必須

- **Google Workspace Business Standard 以上**  
  Google eSignature 機能の利用に必要です。Individual / Business Starter プランでは動作しません。
- **Node.js 16+** （セットアップ時のみ、`clasp` 利用のため）

### 推奨

- macOS / Linux（Windows でも動作しますが、本リポジトリでの動作確認は macOS 中心）

### 利用可能な Workspace プラン

| プラン | 動作 |
|--------|------|
| Individual | × |
| Business Starter | × |
| Business Standard | ◯ |
| Business Plus | ◯ |
| Enterprise Standard | ◯ |
| Enterprise Plus | ◯ |

---

## クイックスタート（コピーリンク方式・2分）

> **Node.js も clasp も不要です。** ブラウザだけで完結します。

### 1. コピーリンクをクリック

**[▶ gassign をコピーして使い始める](https://script.google.com/d/REPLACE_WITH_PRODUCTION_SCRIPT_ID/copy)**

「コピーを作成」ダイアログが開きます。「コピーを作成」を押すと、自分の Drive に Apps Script プロジェクトがコピーされます。

### 2. 初期化を実行

コピーされた Apps Script エディタが開きます。`Initializer.gs` の `initializeApp()` 関数を選択して実行します。

- 権限承認ダイアログが表示されます。「許可」を押してください
- 実行後、Drive に `gassign/` フォルダ一式と隠し Spreadsheet が自動作成されます

### 3. Web App としてデプロイ

「デプロイ」→「新しいデプロイ」から Web App として公開：

- 種類: **Web App**
- 次のユーザーとして実行: **アクセスしているユーザー**
- アクセスできるユーザー: **組織内** （推奨）

発行された URL にアクセスするとダッシュボードが開きます。

### つまずいた場合は

[詳細セットアップガイド (docs/setup.md)](docs/setup.md) を参照してください。権限承認の手順やトラブルシューティングを丁寧に解説しています。

---

## クイックスタート（clasp 方式・開発者向け）

> 自前のプロジェクトで管理したい場合や、コードを改変して使いたい場合はこちら。

```bash
git clone https://github.com/sator-inc/gassign.git
cd gassign
npm install -g @google/clasp
clasp login
cd src
clasp create --type webapp --title "gassign"
clasp push
```

[Apps Script のエディタ](https://script.google.com) を開き、`initializeApp()` を1回実行してください。

実行すると、以下が自動作成されます：

- Drive 内に `gassign/` フォルダ一式
- 隠し Spreadsheet（ledger / audit_log / config）
- サンプルテンプレート（NDA、業務委託契約 など）

### 5. Web App としてデプロイ

Apps Script エディタの「デプロイ」→「新しいデプロイ」から Web App として公開：

- 種類: **Web App**
- 説明: 任意
- 次のユーザーとして実行: **アクセスしているユーザー**
- アクセスできるユーザー: **組織内** (推奨) または **自分のみ**

発行された URL にアクセスすれば、ダッシュボードが開きます。

### 6. チームで使う場合の共有設定（任意）

複数人で gassign を使う場合は、Drive の共有設定とアプリの editors 設定を組み合わせて運用します。

#### Drive フォルダの推奨共有設定

| フォルダ | 編集権限 | 閲覧権限 |
|----------|----------|----------|
| `gassign/` | editors と同じメンバー | 組織内全員 |
| `gassign/_system/` | editors のみ | editors のみ |
| `gassign/contracts/` | editors のみ | 組織内全員 |
| `gassign/templates/` | editors のみ | 組織内全員 |

`_system/` フォルダは隠しスプレッドシート（ledger / audit_log / config）を含むため、editors のみがアクセスできるようにしてください。

#### editors の追加

Web App にアクセスし、「エディタ管理」画面から編集権限を持つユーザーを追加できます。

- editor: 契約作成、編集、送信、テンプレ管理が可能
- 非editor: 契約の閲覧、PDF ダウンロード、監査ログ閲覧のみ

**重要**: 初期化を実行したユーザー（オーナー）が最初の editor として自動登録されます。

### つまずいた場合は

クイックスタートで以下のような問題に遭遇した場合は、[詳細セットアップガイド (docs/setup.md)](docs/setup.md) を参照してください：

- `clasp push` がエラーになる
- 「このアプリは Google で確認されていません」が表示される
- ダッシュボードが空白になる
- 認証ダイアログの突破方法がわからない

詳細版にはトラブルシューティングと解決策がまとまっています。

---

## 使い方

### 新しい契約書を作成する

1. ダッシュボード右上の **「+ 新規契約」** をクリック
2. テンプレートを選択（NDA、業務委託 など）
3. 相手先情報、署名者、テンプレ変数を入力
4. 確認画面で内容を確認 → 送信

送信後、社内署名者（社長など）に署名依頼メールが自動送信されます。社内署名が完了すると、自動的に相手先に署名依頼が転送されます。

### 契約の状態を確認する

ダッシュボードから契約をクリックすると詳細画面が開きます：

- 現在のステータス（作成中 / 社内署名待ち / 相手先署名待ち / 締結済 / 却下）
- 操作履歴
- 利用可能なアクション（再同期、リマインダー、取り下げなど）

### テンプレートを追加する

1. ダッシュボード右上の **「テンプレ管理」** をクリック
2. 「+ 新規テンプレ」で新しいテンプレートを作成
3. 開かれた Google Docs に契約書本文を記述
4. 変数部分は `{{variable_name}}` で記述（例: `{{counterparty_name}}`）

### 編集権限を管理する

複数人で gassign を使う場合の権限管理：

1. ダッシュボード右上の **「エディタ管理」** をクリック
2. 「+ エディタ追加」で編集可能なメールアドレスを登録
3. 不要になった editor は削除可能（ただし最後の1人は削除不可）

**権限の階層は二値**:
- **editor** (登録済み): 全機能を利用可能
- **非editor** (未登録): 閲覧のみ

ロール（admin/member など）の概念は **意図的に持ちません**。シンプルさを優先しています。複雑な権限管理が必要な場合は、Drive の共有設定と組み合わせてください。

---

## アーキテクチャ

```
ブラウザ
    ↓ HTTPS
GAS Web App (HtmlService)
    ↓
GAS Backend
    ↓
┌────────┬────────┬────────┬────────┐
│ Drive  │ Docs   │ eSign  │ Gmail  │
│ API    │ API    │ ature  │ API    │
└────────┴────────┴────────┴────────┘
    ↓
Spreadsheet (ledger / audit_log / config)
```

### 設計の哲学

**真実は Google が持つ、自分たちは参照を持つだけ**

- 契約書本文 → Google Docs に保管、`doc_id` だけ管理
- 署名状態 → Google eSignature が真実、ローカルにはキャッシュのみ
- 操作履歴 → 改ざん不可な追記専用ログ

詳細は [docs/architecture.md](docs/architecture.md) を参照してください。

---

## ステータス

5つのステータスで契約のライフサイクルを表現します：

| ステータス | 意味 | 次のアクション |
|------------|------|----------------|
| 作成中 | 編集中、まだ送信していない | 作成者 |
| 社内署名待ち | 社内署名者の署名待ち | 社内署名者 |
| 相手先署名待ち | 相手先の署名待ち | 相手先 |
| 締結済 | 全員署名完了 | なし |
| 却下 | 取り下げ・拒否 | なし |

---

## ロードマップ

### v1.0（✅ リリース済み）

- [x] アーキテクチャ設計
- [x] データモデル設計
- [x] Phase 1: コア基盤（Initializer / Config / Auth / AuditLog / ContractManager / DriveHelper）
- [x] Phase 2: 契約作成フロー（Dashboard / NewContract / ContractDetail）
- [x] Phase 3: 署名連携（ESignature / DailySync / Notifier）
- [x] Phase 4: 管理機能（Templates / AuditLog / Editors 画面、リマインダー、取り下げ）
- [x] Phase 5: OSS 公開準備（README / GitHub Actions / サンプルテンプレート）

### v1.1（予定）

- [ ] 多言語対応（英語）
- [ ] 既存契約のインポート機能
- [ ] Slack 通知連携

### v2.0（構想）

- [ ] ロール（admin/member）の導入
- [ ] 契約ごとの visibility 設定
- [ ] 部署/チーム概念
- [ ] 承認フロー
- [ ] クラウドサイン / GMOサイン との API 連携（法的署名対応）
- [ ] 全文検索機能
- [ ] 契約間の関連管理（親契約・付属覚書）

---

## よくある質問

### Q. 法的に有効な電子署名ですか？

Google eSignature は **電子サイン（eSignature）** を提供しますが、日本の電子署名法第3条に基づく厳密な「電子署名」とは要件が異なります。

- 商取引上の合意形成: 問題なく利用可能
- 不動産取引、相続、訴訟など厳密な本人性が求められる契約: 電子認証局を経由する専用サービス（クラウドサイン、GMOサイン等）の利用を推奨

法的要件は契約の性質や裁判所の判断によって変わるため、重要契約については弁護士に相談することをおすすめします。

### Q. 相手先も Google アカウントが必要ですか？

不要です。Google eSignature は、Google アカウントを持たない外部メールアドレスからでも署名可能です。

### Q. 既存の契約書を取り込めますか？

v1.0 では未対応です。v1.1 でインポート機能を予定しています。

### Q. データはどこに保存されますか？

すべて自社の Google Drive 内に保存されます。外部のサーバーやデータベースにアップロードされることはありません。

### Q. 月額費用はかかりますか？

gassign 自体は無料の OSS です。Google Workspace の月額料金以外、追加コストはありません。

### Q. 月100件以上の契約を処理できますか？

設計上は可能ですが、v1.0 では月10件規模を想定しています。100件超を想定する場合、ScriptProperties のキャッシュ最適化やバッチ処理の調整が必要です。Issue でご相談ください。

### Q. 複数人で使えますか？

はい、組織内の複数人で利用可能です。  
編集権限は **editors** という二値の仕組みで管理します（ロール概念はありません）：

- editor: 全機能利用可能
- 非editor: 閲覧のみ

詳しくは「[編集権限を管理する](#編集権限を管理する)」を参照してください。

### Q. 部署ごと・チームごとに権限を分けたいです

v1.1 ではそこまでの権限管理はできません。**全 editor は全契約にアクセス可能** です。

部署別の権限分離が必要な場合は：
- Drive の共有設定で `contracts/` フォルダを部署ごとに分ける
- 部署別に gassign をデプロイする
- v2.0 を待つ（ロード機能を予定）

のいずれかをご検討ください。

### Q. オンプレミス環境で動かせますか？

Google Workspace に依存するため、オンプレミスでの動作はできません。Workspace を契約していない組織は対象外です。

### Q. なぜ "gassign" という名前？

**G**oogle **A**pps **S**cript + **Sign** の合成です。  
英語の `assign`（割り当てる）にも掛かっています。  
詳しくは上記の「プロダクト名の由来」セクションを参照してください。

### Q. 開発に貢献したいです

[CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。Issue や Pull Request を歓迎します。

---

## ドキュメント

- [セットアップ詳細手順](docs/setup.md) ✅
- [アーキテクチャ解説](docs/architecture.md) ✅
- [API リファレンス](docs/api.md) (準備中)
- [テンプレート作成ガイド](docs/templates.md) (準備中)
- [トラブルシューティング](docs/troubleshooting.md) (準備中、setup.md 内に基本的な内容あり)
- [貢献ガイドライン](CONTRIBUTING.md) ✅
- [Claude Code 開発指針](CLAUDE.md) ✅（コントリビューター向け）

---

## ライセンス

MIT License — 詳細は [LICENSE](LICENSE) を参照してください。

商用利用、改変、再配布、自由に行えます。

---

## 開発・サポート

このプロジェクトは [sator株式会社](https://sator-inc.com) によって開発されています。

- **OSS としての利用**: 自由にどうぞ。Issue や PR は歓迎します。
- **カスタマイズ・導入支援が必要な場合**: [seno@sator-inc.com](mailto:seno@sator-inc.com) までお気軽にご相談ください。
- **不具合報告**: [GitHub Issues](https://github.com/sator-inc/gassign/issues) へお願いします。

---

## 謝辞

このプロジェクトは、以下の素晴らしいプロダクトと文化なしには成立しませんでした：

- [Google Apps Script](https://developers.google.com/apps-script) — サーバーレスな実行環境
- [clasp](https://github.com/google/clasp) — GAS のローカル開発体験
- [Anthropic Claude](https://claude.ai) — 設計と実装支援

---

## English

**gassign** = **G**oogle **A**pps **S**cript + **Sign**

A simple contract management system that runs entirely on Google Workspace.
Built with Google Apps Script. Powered by Google eSignature.

This README is currently primarily in Japanese, as the initial target audience is Japanese small-to-medium businesses. An English version is planned for v1.1.

For now, please refer to:
- [Architecture overview](docs/architecture.md) (in Japanese, but diagrams are universal)
- [API reference](docs/api.md) (function names and signatures are in English)

If you'd like to contribute English documentation, please open an Issue or PR.

---

<sub>Made with ❤️ in Tokyo by sator</sub>
