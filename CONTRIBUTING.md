# Contributing to gassign

このドキュメントは、gassign の開発に参加する方向けのガイドです。

---

## 開発環境のセットアップ

### 必要なもの

- Node.js 16+
- Google Workspace Business Standard 以上のアカウント
- Google Apps Script API の有効化（後述）

### 手順

#### 1. リポジトリをクローン

```bash
git clone https://github.com/sator-inc/gassign.git
cd gassign
```

#### 2. 依存パッケージをインストール

```bash
npm install
```

#### 3. clasp をセットアップ

```bash
npm install -g @google/clasp
clasp login
```

Google Apps Script API を有効にしてください:  
https://script.google.com/home/usersettings

#### 4. 自分の検証用 Apps Script プロジェクトを作成

```bash
cd src
clasp create --type webapp --title "gassign-dev"
```

これで `src/.clasp.json` が生成されます（`.gitignore` 対象のため、絶対にコミットしないでください）。

#### 5. プッシュして動作確認

```bash
clasp push
```

Apps Script エディタから `initializeApp()` を実行して、Drive にデータが作成されることを確認してください。

---

## 開発フロー

### 日常の開発

```bash
# ファイルを編集した後
cd src
clasp push

# Apps Script エディタでテスト
```

### Lint の実行

```bash
npm run lint
```

### Pull Request を出す前に

1. `npm run lint` がエラーなしで通ること
2. 手動テストで主要フロー（契約作成 → 署名依頼 → 締結）が動作すること
3. 変更内容を PR 説明に記載すること

---

## コーディング規約

CLAUDE.md の「コーディング規約」セクションに従ってください。主要ポイント:

- 関数名: camelCase
- 定数: UPPER_SNAKE_CASE
- インデント: スペース 2
- セミコロン: 必須
- JSDoc: 公開関数には必ず付ける
- すべての状態変更操作は `AuditLog.log()` を呼ぶ

---

## フォークして自組織で運用する場合

別組織が gassign を自組織向けにデプロイする場合、書き換えが必要な箇所は **2つだけ** です。

### 手順

#### 1. 自分の Apps Script プロジェクトを作成

```bash
cd src
clasp create --type webapp --title "gassign"
# → src/.clasp.json に scriptId が生成される
```

生成された `scriptId` をメモします。

#### 2. release.config.json と README を更新

```bash
NEW_ID="生成されたSCRIPT_ID"

# release.config.json を更新
jq ".scriptId = \"$NEW_ID\"" release.config.json > tmp.json && mv tmp.json release.config.json

# README のコピーリンクを更新
sed -i.bak "s|REPLACE_WITH_PRODUCTION_SCRIPT_ID|$NEW_ID|g" README.md
rm README.md.bak
```

#### 3. .clasp.production.json も更新

```bash
jq ".scriptId = \"$NEW_ID\"" .clasp.production.json > tmp.json && mv tmp.json .clasp.production.json
```

これで CI の `clasp push` も自分のプロジェクトに向きます。

### CI シークレットの設定

GitHub Actions の deploy ワークフローを使う場合、以下のシークレットを設定してください:

- `CLASPRC_JSON`: `~/.clasprc.json` の中身（`clasp login` 後に生成される）

---

## Issue / Pull Request のガイドライン

### バグ報告

- 再現手順を具体的に書いてください
- GAS のエラーログ（`Logger.log` の出力）があれば貼ってください
- どの画面・どの操作で発生したかを明記してください

### 機能追加の提案

- CLAUDE.md の「Phase」設計と「設計上の禁止事項」を先に確認してください
- v1.0 のスコープ外の機能（ロール、承認フロー等）は v2.0 の Issue として立ててください

### Pull Request

- 1 PR = 1 変更。複数の無関係な変更を混ぜないでください
- タイトルは日本語または英語どちらでも構いません
- `npm run lint` を通してから出してください

---

## ライセンス

このプロジェクトへの貢献は MIT License のもとで公開されます。
