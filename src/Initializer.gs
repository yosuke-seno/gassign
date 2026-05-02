/**
 * Initializer.gs
 * One-time setup script to initialize gassign.
 * gassign の初期セットアップスクリプト（初回のみ実行）。
 *
 * Run initializeApp() once from the Apps Script editor after copying the project.
 * プロジェクトをコピーした後、Apps Script エディタから initializeApp() を1回だけ実行する。
 */

/**
 * Initialize the gassign application.
 * gassign アプリケーションを初期化する。
 *
 * Creates the Drive folder structure, Spreadsheets, and registers the running
 * user as the first editor. Safe to call only once — throws if already initialized.
 * Drive フォルダ構成・スプレッドシートを作成し、実行ユーザーを最初の editor として登録する。
 * 初期化済みの場合は例外を投げる。
 *
 * @throws {Error} If already initialized, or if user email cannot be retrieved
 */
function initializeApp() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    Logger.log('gassign の初期化を開始します...');

    const props = PropertiesService.getScriptProperties();
    if (props.getProperty('ROOT_FOLDER_ID')) {
      throw new Error('すでに初期化済みです。再初期化する場合は resetApp() を実行してください。');
    }

    const ownerEmail = Session.getActiveUser().getEmail();
    if (!ownerEmail) {
      throw new Error(
        'ユーザーのメールアドレスを取得できません。' +
        'スクリプトの実行権限が "User accessing the web app" になっているか確認してください。'
      );
    }

    // 1. Create root folder and sub-folders
    const rootFolder = DriveApp.createFolder('gassign');
    const rootFolderId = rootFolder.getId();

    const systemFolderId = DriveHelper.createFolder('_system', rootFolderId);
    const templatesFolderId = DriveHelper.createFolder('templates', rootFolderId);
    const contractsFolderId = DriveHelper.createFolder('contracts', rootFolderId);
    DriveHelper.createFolder('archive', rootFolderId);

    Logger.log('Drive フォルダを作成しました: ' + DriveHelper.getFolderUrl(rootFolderId));

    // 2. Create Spreadsheets inside _system
    const ledgerId = Initializer._createLedger(systemFolderId);
    const auditLogId = Initializer._createAuditLog(systemFolderId);
    const configId = Initializer._createConfig(systemFolderId, ownerEmail);

    Logger.log('スプレッドシートを作成しました');

    // 3. Persist all IDs to ScriptProperties
    props.setProperties({
      ROOT_FOLDER_ID: rootFolderId,
      SYSTEM_FOLDER_ID: systemFolderId,
      TEMPLATES_FOLDER_ID: templatesFolderId,
      CONTRACTS_FOLDER_ID: contractsFolderId,
      LEDGER_ID: ledgerId,
      AUDIT_LOG_ID: auditLogId,
      CONFIG_ID: configId
    });

    Logger.log('ScriptProperties に ID を保存しました');

    // 4. Install triggers
    installAuditLogTrigger();
    installDailySyncTrigger();

    // 5. Record initialization in audit_log
    AuditLog.log({
      actor_email: ownerEmail,
      actor_type: 'system',
      action: 'system_initialized',
      target_type: 'system',
      target_id: rootFolderId,
      after_state: {
        root_folder_id: rootFolderId,
        owner: ownerEmail,
        ledger_id: ledgerId,
        audit_log_id: auditLogId,
        config_id: configId
      },
      description: 'gassign を初期化しました。オーナー: ' + ownerEmail
    });

    Logger.log('');
    Logger.log('✅ 初期化が完了しました！');
    Logger.log('オーナー: ' + ownerEmail);
    Logger.log('ルートフォルダ: ' + DriveHelper.getFolderUrl(rootFolderId));
    Logger.log('');
    Logger.log('次のステップ: Apps Script エディタで「デプロイ」→「ウェブアプリ」として公開してください。');
  } catch (e) {
    Logger.log('❌ 初期化に失敗しました: ' + e.message);
    Logger.log(e.stack);
    throw e;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Reset the application by clearing all ScriptProperties.
 * ScriptProperties をクリアしてアプリをリセットする。
 *
 * WARNING: This does NOT delete Drive files or Spreadsheets.
 * 警告: Drive ファイルやスプレッドシートは削除しない。
 * Only use for development/testing purposes.
 * 開発・テスト用途のみ。
 */
function resetApp() {
  PropertiesService.getScriptProperties().deleteAllProperties();
  Config.clearCache();
  Logger.log('ScriptProperties をクリアしました。initializeApp() で再初期化できます。');
}

const Initializer = {
  /**
   * Create the ledger Spreadsheet with the contracts sheet.
   * 台帳スプレッドシートを作成し contracts シートを初期化する。
   *
   * @param {string} systemFolderId
   * @returns {string} Spreadsheet ID
   */
  _createLedger(systemFolderId) {
    const ssId = DriveHelper.createSpreadsheet('ledger', systemFolderId);
    const ss = SpreadsheetApp.openById(ssId);
    const sheet = ss.getActiveSheet();
    sheet.setName('contracts');

    const headers = [
      'id', 'created_at', 'updated_at', 'creator_email', 'status', 'title',
      'template_id', 'counterparty_name', 'counterparty_rep',
      'counterparty_signer_email', 'counterparty_signer_name',
      'internal_signer_email', 'internal_signer_name',
      'folder_id', 'doc_id', 'signed_pdf_id', 'esignature_request_id',
      'internal_signed_at', 'counterparty_signed_at', 'sent_at', 'completed_at',
      'template_variables', 'notes', 'tags'
    ];
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);

    // Warn-only protection on header row to prevent accidental edits
    const protection = sheet.getRange('1:1').protect();
    protection.setDescription('ヘッダー行（変更禁止）');
    protection.setWarningOnly(true);

    return ssId;
  },

  /**
   * Create the audit_log Spreadsheet with the logs sheet.
   * 監査ログスプレッドシートを作成し logs シートを初期化する。
   *
   * @param {string} systemFolderId
   * @returns {string} Spreadsheet ID
   */
  _createAuditLog(systemFolderId) {
    const ssId = DriveHelper.createSpreadsheet('audit_log', systemFolderId);
    const ss = SpreadsheetApp.openById(ssId);
    const sheet = ss.getActiveSheet();
    sheet.setName('logs');

    const headers = [
      'log_id', 'timestamp', 'actor_email', 'actor_type',
      'action', 'contract_id', 'target_type', 'target_id',
      'before_state', 'after_state', 'metadata', 'description'
    ];
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);

    return ssId;
  },

  /**
   * Create the config Spreadsheet with all 5 sheets.
   * config スプレッドシートを作成し5シートを初期化する。
   *
   * @param {string} systemFolderId
   * @param {string} ownerEmail
   * @returns {string} Spreadsheet ID
   */
  _createConfig(systemFolderId, ownerEmail) {
    const ssId = DriveHelper.createSpreadsheet('config', systemFolderId);
    const ss = SpreadsheetApp.openById(ssId);

    const generalSheet = ss.getActiveSheet();
    generalSheet.setName('general');
    Initializer._setupGeneralSheet(generalSheet);

    Initializer._setupSignersSheet(ss.insertSheet('signers'));
    Initializer._setupEditorsSheet(ss.insertSheet('editors'), ownerEmail);
    Initializer._setupNotificationsSheet(ss.insertSheet('notifications'));
    Initializer._setupTemplatesSheet(ss.insertSheet('templates'));

    return ssId;
  },

  /**
   * Populate the general sheet with default key-value settings.
   * general シートにデフォルト設定を書き込む。
   *
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   */
  _setupGeneralSheet(sheet) {
    const now = new Date().toISOString();
    [
      ['our_company_name', '（会社名を入力してください）'],
      ['our_company_address', '（住所を入力してください）'],
      ['our_representative', '（代表者名を入力してください）'],
      ['next_contract_id', 1],
      ['app_version', '1.0.0'],
      ['initialized_at', now]
    ].forEach(row => sheet.appendRow(row));
  },

  /**
   * Set up the signers sheet with header row.
   * signers シートにヘッダー行を設定する。
   *
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   */
  _setupSignersSheet(sheet) {
    sheet.appendRow(['signer_id', 'role', 'name', 'email', 'applies_to', 'priority', 'active']);
    sheet.setFrozenRows(1);
  },

  /**
   * Set up the editors sheet and register the owner as the first editor.
   * editors シートを設定し、オーナーを最初の editor として登録する。
   *
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @param {string} ownerEmail
   */
  _setupEditorsSheet(sheet, ownerEmail) {
    sheet.appendRow(['email', 'name', 'added_at', 'added_by', 'active']);
    sheet.setFrozenRows(1);
    sheet.appendRow([ownerEmail, '', new Date().toISOString(), 'system', true]);
  },

  /**
   * Set up the notifications sheet with default event settings.
   * notifications シートをデフォルトのイベント設定で初期化する。
   *
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   */
  _setupNotificationsSheet(sheet) {
    sheet.appendRow(['event', 'enabled', 'recipient', 'template']);
    sheet.setFrozenRows(1);
    [
      ['contract_sent', true, 'creator', '署名依頼を送信しました'],
      ['internal_signed', true, 'creator', '社内署名が完了しました'],
      ['completed', true, 'creator,signer', '契約が締結されました']
    ].forEach(row => sheet.appendRow(row));
  },

  /**
   * Set up the templates sheet with header row.
   * templates シートにヘッダー行を設定する。
   *
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   */
  _setupTemplatesSheet(sheet) {
    sheet.appendRow([
      'template_id', 'name', 'category', 'docs_id',
      'description', 'usage_count', 'active'
    ]);
    sheet.setFrozenRows(1);
  }
};
