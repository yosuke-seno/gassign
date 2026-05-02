# セットアップガイド（詳細版）

このドキュメントは、gassign を Google Workspace に導入するための詳細なセットアップ手順です。  
最短手順は [README.md](../README.md) のクイックスタートを参照してください。

トラブルシューティングが必要な場合や、初めてGASを触る方は、こちらの詳細版を読みながら進めることをおすすめします。

---

## 全体像

gassign のインストールでは、3つの場所で作業します：

```
[あなたのPC]
  └─ Node.js + clasp(GASとローカルを繋ぐツール)
       ↓ push
  └─ ローカルのソースコード(git clone したもの)
       ↓ アップロード
[Google のクラウド]
  └─ Apps Script プロジェクト
       ↓ 実行(initializeApp)
  └─ あなたの Google Drive
       └─ gassign/ フォルダ一式が自動生成される
       ↓ アクセス
  └─ Web App URL(ブラウザでアクセス)
```

所要時間の目安：

| 経験レベル | 所要時間 |
|------------|----------|
| Apps Script 経験あり | 10〜15 分 |
| Apps Script 未経験、Node.js 経験あり | 20〜30 分 |
| Apps Script も Node.js も未経験 | 45〜60 分 |

---

## STEP 0: 事前準備

### Google Workspace のプラン確認

[Google Admin Console](https://admin.google.com/) にログインし、現在のプランを確認します。

- ✅ **Business Standard 以上** であることを確認
- ❌ Individual / Business Starter は eSignature が使えないため動作しません

確認方法: 管理コンソール → 支払い → サブスクリプション

### Google アカウントの確認

gassign を導入する Google Workspace の **管理者権限を持つアカウント** にログインしておきます。

```
例: seno@sator-inc.com (Workspace 管理者)
```

個人 Gmail (`@gmail.com`) では動作しません。Workspace アカウントが必要です。

### Node.js のインストール確認

ターミナルで以下を実行します：

```bash
node --version
```

`v16.0.0` 以上が表示されれば OK です。

```
例: v20.10.0
```

未インストールの場合は [nodejs.org](https://nodejs.org/) から LTS 版をダウンロードしてインストールしてください。

---

## STEP 1: clasp をインストール

clasp（Command Line Apps Script）は、ローカルのコードを GAS に同期するツールです。

```bash
npm install -g @google/clasp
```

### よくあるエラーと対処

#### macOS / Linux で `EACCES: permission denied` エラー

```bash
sudo npm install -g @google/clasp
```

#### Windows でエラーが出る

PowerShell を **管理者として実行** で起動してから再実行してください。

### インストール確認

```bash
clasp --version
```

```
例: 2.4.2
```

---

## STEP 2: clasp で Google にログイン

```bash
clasp login
```

ブラウザが自動で開き、Google アカウント選択画面が表示されます。

### 認証フロー

1. **Workspace アカウントを選択**（`@sator-inc.com` など、`@gmail.com` ではない）
2. 「Google clasp - The Apps Script CLI が Google アカウントへのアクセスをリクエストしています」が表示
3. **「許可」をクリック**

### Apps Script API を有効化

初回セットアップでは、もう1つ重要な手順があります。

[Apps Script API 設定ページ](https://script.google.com/home/usersettings) にアクセスし、以下を切り替えます：

```
Google Apps Script API: ◯ オン
```

**この設定がオフだと、後の `clasp push` が失敗します。** 必ず先にオンにしておきましょう。

---

## STEP 3: gassign リポジトリを取得

```bash
# 任意の作業ディレクトリへ移動
cd ~/projects  # または任意の場所

# クローン
git clone https://github.com/sator-inc/gassign.git
cd gassign
```

### ディレクトリ構成の確認

```bash
ls -la
```

以下のような構成が見えれば OK です：

```
gassign/
├── README.md
├── CLAUDE.md
├── LICENSE
├── docs/
├── src/
│   ├── appsscript.json
│   ├── Code.gs
│   ├── ContractManager.gs
│   ├── ... (他の .gs ファイル)
│   └── views/
│       └── *.html
└── templates/
```

---

## STEP 4: Apps Script プロジェクトを作成

`src/` ディレクトリに移動して、新しい Apps Script プロジェクトを作成します：

```bash
cd src
clasp create --type webapp --title "gassign"
```

### このコマンドが行うこと

1. 新規 Apps Script プロジェクトを Google アカウント上に作成
2. `.clasp.json` というファイルが `src/` に生成される（プロジェクトIDを保持）
3. 既存の `appsscript.json` と `.gs` ファイルが連携される

### 生成された `.clasp.json` を確認

```bash
cat .clasp.json
```

このような内容が見えるはずです：

```json
{"scriptId":"1AbCdEfGhIjKlMnOp...","rootDir":"./"}
```

この `scriptId` がプロジェクトの一意の識別子です。**このファイルは git にコミットしないでください**（リポジトリには既に `.gitignore` に含まれています）。

---

## STEP 5: コードを Apps Script にプッシュ

```bash
clasp push
```

ローカルの全てのファイル（`.gs` と `.html`）が Apps Script プロジェクトにアップロードされます。

### 期待される出力

```
└─ src/Code.gs
└─ src/ContractManager.gs
└─ src/Auth.gs
└─ src/Config.gs
... (他のファイル)
└─ src/views/Dashboard.html
... (他のHTML)
Pushed 15 files.
```

### よくあるエラー

#### File extension '.gs' is not valid

`appsscript.json` の `filePushOrder` 設定で解決します。リポジトリには既に正しい設定が入っているはずなので、エラーが出る場合は以下を確認：

1. リポジトリを再度クローンし直す
2. `appsscript.json` を直接編集していないか確認

#### ScriptId is not specified

`.clasp.json` が生成されていない可能性があります。STEP 4 を再実行してください。

---

## STEP 6: Apps Script エディタを開く

```bash
clasp open
```

ブラウザで Apps Script エディタが開きます。

### スコープを確認

エディタ左側の **「歯車アイコン」**（プロジェクト設定）をクリックし、`appsscript.json` の内容を確認：

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

これらの権限が必要です：
- Drive、Sheets、Docs、Gmail への読み書き
- ユーザーの Email アドレス取得（権限判定のため）

---

## STEP 7: 初期化スクリプトを実行

ここが**最も重要な手順**です。

### 初期化の実行

Apps Script エディタで：

1. 左上のファイル一覧から **`Initializer.gs`** を選択
2. エディタ上部の関数選択ドロップダウンで **`initializeApp`** を選択
3. **「実行」ボタン**をクリック

### 初回実行時の認証ダイアログ

初めて実行する時、以下のダイアログが順番に表示されます。

#### ダイアログ1: 「承認が必要です」

```
このプロジェクトでは、お客様のデータへのアクセス権限が必要です。
[権限を確認]
```

→ **「権限を確認」** をクリック

#### ダイアログ2: アカウント選択

→ **Workspace アカウント** を選択

#### ダイアログ3: 「このアプリは Google で確認されていません」

これが**最大のつまずきポイント**です。以下のような警告画面が表示されます：

```
gassign が Google で確認されていないため、
信頼できる開発者であることをご確認ください
```

突破方法：

1. 画面下部の **「詳細」** をクリック
2. **「gassign（安全ではないページ）に移動」** をクリック

これは OSS なので Google の確認を経ていないことによる警告です。**自分でデプロイした自分のコードなので、安全です**。

#### ダイアログ4: アクセス権限の付与

```
gassign が以下を許可するようリクエストしています：
- Google ドライブのファイルの表示、編集、作成、削除
- Google スプレッドシートの表示と管理
... など
[許可]
```

→ **「許可」** をクリック

### 実行結果の確認

エディタ下部の「実行ログ」に成功メッセージが表示されるはずです：

```
[ログ] gassign の初期化を開始します...
[ログ] Drive にルートフォルダを作成しました
[ログ] _system フォルダを作成しました
[ログ] templates フォルダを作成しました
[ログ] contracts フォルダを作成しました
[ログ] ledger スプレッドシートを作成しました
[ログ] audit_log スプレッドシートを作成しました
[ログ] config スプレッドシートを作成しました
[ログ] サンプルテンプレート 5件を配置しました
[ログ] 初期 editor として seno@sator-inc.com を登録しました
[ログ] 初期化完了！
```

### 初期化結果を Drive で確認

[Google Drive](https://drive.google.com) を開き、ルートに `gassign/` フォルダがあるか確認してください：

```
gassign/
├── _system/
│   ├── ledger
│   ├── audit_log
│   └── config
├── templates/
│   ├── 秘密保持契約_NDA
│   ├── 業務委託契約_準委任型
│   └── ... (5つのサンプル)
├── contracts/
└── archive/
```

ここまで来れば、**インフラの準備は完了**です。

---

## STEP 8: Web App としてデプロイ

ここからは「実際にアクセスできる URL」を作る作業です。

### デプロイ設定

Apps Script エディタの右上から：

1. **「デプロイ」** ボタンをクリック
2. **「新しいデプロイ」** を選択
3. 種類選択で歯車アイコン → **「Web アプリ」** を選択

### 設定値

| 項目 | 推奨値 |
|------|--------|
| **説明** | `gassign v1.0 初回デプロイ` |
| **次のユーザーとして実行** | **アクセスしているユーザー** |
| **アクセスできるユーザー** | **組織内のすべてのユーザー** |

#### ⚠️ 重要

「次のユーザーとして実行」が **「アクセスしているユーザー」** であることを必ず確認してください。  

「自分(オーナー)として実行」を選ぶと、すべての操作がオーナー権限で実行されることになり、アプリの権限制御が機能しなくなります。

### デプロイ実行

「デプロイ」ボタンをクリック → 完了画面で **Web アプリの URL** が表示されます：

```
ウェブアプリ
URL: https://script.google.com/macros/s/AKfyc...../exec
```

このURLを **コピーしてブックマーク** してください。チーム全員にも共有することになります。

---

## STEP 9: 初回アクセスと動作確認

### Web App にアクセス

ブラウザで先ほどの URL を開きます。

### 期待される画面

正常にインストールできていれば、ダッシュボード画面が表示されます：

```
┌────────────────────────────────────────────┐
│ gassign        [テンプレ管理] [+ 新規契約]   │
│ sator-inc.com                              │
├────────────────────────────────────────────┤
│ 作成中: 0 / 社内署名待ち: 0 / 相手先署名待ち: 0│
├────────────────────────────────────────────┤
│ 最近の契約                                   │
│  (まだ契約はありません)                       │
└────────────────────────────────────────────┘
```

契約はまだないので空ですが、UI が正常に表示されればセットアップ成功です。

---

## STEP 10: 動作テスト（推奨）

実際の運用前に、テスト契約を1件作って動作確認することを強く推奨します。

### テスト手順

1. **「+ 新規契約」** をクリック
2. テンプレート: **「秘密保持契約 (NDA)」** を選択
3. 情報入力：
   - 件名: `テスト契約_削除可`
   - 相手先: `テスト株式会社`
   - 相手先署名者: **自分の別アドレス**（個人 Gmail など）
   - 社内署名者: 自分自身
4. 確認画面 → 送信
5. 自分のメールアドレスに署名依頼が届くか確認

これで一通り動作することが確認できます。テスト契約は後でステータスを「却下」にして取り下げてください。

---

## STEP 11: チームメンバーを追加（複数人で使う場合）

複数人で gassign を使う場合の設定。社内ツールとして運用する場合は必須です。

### 11-1. editor の追加

Web App の **「エディタ管理」** をクリック → **「+ エディタ追加」**

```
メールアドレス: tanaka@sator-inc.com
名前: 田中
[追加]
```

editors として追加されたユーザーは、契約作成・編集・送信などの全機能を利用できます。

### 11-2. Drive 共有設定の調整

Drive で `gassign/` フォルダを右クリック → **「共有」**

推奨設定：

| フォルダ | 編集権限 | 閲覧権限 |
|----------|----------|----------|
| `gassign/` | editors と同じメンバー | 組織内全員 |
| `gassign/_system/` | editors のみ | editors のみ |
| `gassign/contracts/` | editors のみ | 組織内全員 |
| `gassign/templates/` | editors のみ | 組織内全員 |

`_system/` フォルダは隠しスプレッドシート（ledger / audit_log / config）を含むため、editors のみがアクセスできるようにしてください。

これにより、アプリの権限制御 + Drive の権限制御の **二重防御** が実現されます。

### 11-3. URL を共有

Web App URL をチームメンバーに共有（Slack、メールなど）。  
組織内全員がアクセス可能ですが、editor じゃない人は閲覧モードになります。

---

## トラブルシューティング

インストール時によく遭遇する問題と対処法。

### 問題: clasp push で 401 / 403 エラー

```
Error: User has not enabled the Apps Script API.
```

**対処**: [Apps Script API 設定](https://script.google.com/home/usersettings) で API を有効化してから再試行。

### 問題: 「Google eSignature の機能が見つからない」エラー

`ESignature.gs` の実行時にエラーが出る場合：

**原因**: Workspace プランが Business Standard 未満  
**対処**: プランをアップグレード。Individual / Starter プランでは利用不可です。

### 問題: 「このアプリは確認されていません」が突破できない

「詳細」ボタンが見つからない場合：

**対処**: ブラウザの拡張機能（広告ブロッカー等）が干渉していることがあります。  
シークレットモードで再試行 or 拡張機能を一時無効化してください。

### 問題: ダッシュボードが空白で何も表示されない

**原因**: HTML ファイルが正しくプッシュされていない  
**対処**: 

```bash
clasp push --force
```

`--force` オプションで全ファイルを再アップロード。

### 問題: editors のリストが空で誰もログインできない

**原因**: 初期化時に editor の自動登録が失敗  
**対処**: Apps Script エディタで `addInitialEditor()` を手動実行：

```javascript
// 一時的にエディタから実行
function addInitialEditor() {
  const myEmail = Session.getActiveUser().getEmail();
  EditorManager.addEditor({
    email: myEmail,
    name: '管理者',
    addedBy: 'system'
  });
}
```

### 問題: Web App にアクセスすると「アクセス権限がありません」

**原因**: Web App の「アクセスできるユーザー」設定が「自分のみ」になっている  
**対処**: 「デプロイを管理」から設定を「組織内のすべてのユーザー」に変更。

### 問題: editor として追加したのに権限が反映されない

**原因**: ScriptCache が古い情報を保持している  
**対処**: 数分待つ、またはブラウザを再読み込み。  
それでも解決しない場合、Apps Script エディタで `clearCache()` を実行：

```javascript
function clearCache() {
  CacheService.getScriptCache().removeAll(['editors']);
}
```

---

## 定期的なメンテナンス

### コードを最新版に更新する

upstream の gassign に新しいバージョンが出たら：

```bash
cd ~/projects/gassign
git pull origin main
cd src
clasp push
```

その後、Apps Script でデプロイを更新：

1. 「デプロイ」→「デプロイを管理」
2. 既存デプロイの編集アイコンをクリック
3. バージョンを「新しいバージョン」に変更
4. デプロイ

URL は変わりません。チームメンバーへの再共有は不要です。

### バックアップ

毎月の自動バックアップが `gassign/_system/backups/` に作成されますが、念のため定期的に Drive 全体をエクスポートすることを推奨します。

[Google Takeout](https://takeout.google.com/) で Drive のバックアップを定期取得してください。

### ログの確認

監査ログは Web App の「監査ログ」画面から閲覧できます。  
不審な操作がないか、定期的に確認することを推奨します。

---

## アンインストール

gassign を削除する場合：

### 1. Web App のデプロイを削除

Apps Script エディタの「デプロイ」→「デプロイを管理」→ 既存デプロイの「アーカイブ」

### 2. Apps Script プロジェクトを削除

[Apps Script](https://script.google.com/) のプロジェクト一覧から gassign を削除。

### 3. Drive のフォルダを削除

Drive の `gassign/` フォルダを削除（**契約データもすべて消えるので、必要なら事前にバックアップを取得**）。

### 4. ローカルの clasp 設定を削除（オプション）

```bash
clasp logout
```

---

## 関連ドキュメント

- [README.md](../README.md) - プロジェクト概要とクイックスタート
- [docs/architecture.md](architecture.md) - アーキテクチャ詳細
- [docs/templates.md](templates.md) - テンプレート作成ガイド
- [docs/troubleshooting.md](troubleshooting.md) - トラブルシューティング
- [CLAUDE.md](../CLAUDE.md) - 開発者向けドキュメント

---

## サポート

問題が解決しない場合は：

1. [GitHub Issues](https://github.com/sator-inc/gassign/issues) で質問・報告
2. カスタマイズや導入支援が必要な場合は [seno@sator-inc.com](mailto:seno@sator-inc.com) まで
