/**
 * Config.gs
 * Configuration read/write with in-memory caching.
 * 設定の読み書きとインメモリキャッシュ管理。
 */

const Config = {
  /** @type {Object|null} */
  _generalCache: null,
  /** @type {Array|null} */
  _editorsCache: null,

  /**
   * Get the config Spreadsheet.
   * config スプレッドシートを取得する。
   *
   * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
   * @throws {Error} If CONFIG_ID is not set
   */
  _getSpreadsheet() {
    const id = PropertiesService.getScriptProperties().getProperty('CONFIG_ID');
    if (!id) throw new Error('CONFIG_ID が設定されていません。initializeApp() を実行してください。');
    return SpreadsheetApp.openById(id);
  },

  /**
   * Get a value from the general settings sheet.
   * general シートから設定値を取得する。
   *
   * @param {string} key - Setting key
   * @returns {*} Value, or null if not found
   */
  getGeneral(key) {
    if (!Config._generalCache) {
      Config._loadGeneralCache();
    }
    const val = Config._generalCache[key];
    return val !== undefined ? val : null;
  },

  /**
   * Load all general settings into the in-memory cache.
   * general シートの全設定をインメモリキャッシュに読み込む。
   */
  _loadGeneralCache() {
    const sheet = Config._getSpreadsheet().getSheetByName('general');
    const data = sheet.getDataRange().getValues();
    Config._generalCache = {};
    data.forEach(row => {
      if (row[0]) Config._generalCache[String(row[0])] = row[1];
    });
  },

  /**
   * Set a value in the general settings sheet.
   * general シートに設定値を書き込む。
   *
   * @param {string} key - Setting key
   * @param {*} value - Value to set
   */
  setGeneral(key, value) {
    const sheet = Config._getSpreadsheet().getSheetByName('general');
    const data = sheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]) === key) {
        sheet.getRange(i + 1, 2).setValue(value);
        Config._generalCache = null;
        return;
      }
    }
    sheet.appendRow([key, value]);
    Config._generalCache = null;
  },

  /**
   * Get the next contract ID string and increment the counter.
   * Must be called inside a LockService lock.
   * 次の契約 ID を返しカウンタをインクリメントする。LockService のロック内で呼ぶこと。
   *
   * @returns {string} e.g. "C-001"
   * @throws {Error} If next_contract_id row is missing
   */
  getNextContractId() {
    const sheet = Config._getSpreadsheet().getSheetByName('general');
    const data = sheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]) === 'next_contract_id') {
        const current = parseInt(data[i][1], 10);
        sheet.getRange(i + 1, 2).setValue(current + 1);
        Config._generalCache = null;
        return 'C-' + String(current).padStart(3, '0');
      }
    }
    throw new Error('next_contract_id が general シートに存在しません');
  },

  /**
   * Get all editors (both active and inactive).
   * 全 editor を取得する（active / inactive を問わず）。
   *
   * @returns {Array<{email: string, name: string, added_at: string, added_by: string, active: boolean}>}
   */
  getEditors() {
    if (Config._editorsCache) return Config._editorsCache;

    const sheet = Config._getSpreadsheet().getSheetByName('editors');
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      Config._editorsCache = [];
      return Config._editorsCache;
    }

    Config._editorsCache = data.slice(1)
      .filter(row => row[0])
      .map(row => ({
        email: String(row[0]),
        name: String(row[1] || ''),
        added_at: row[2] ? String(row[2]) : '',
        added_by: String(row[3] || ''),
        active: row[4] === true || row[4] === 'TRUE'
      }));

    return Config._editorsCache;
  },

  /**
   * Add a new editor to the editors sheet.
   * editors シートに editor を追加する。
   *
   * @param {string} email - Editor email
   * @param {string} name - Editor display name
   * @param {string} addedBy - Email of the user performing the addition
   * @throws {Error} If the email already exists as an active editor
   */
  addEditor(email, name, addedBy) {
    const existing = Config.getEditors().find(e => e.email === email && e.active);
    if (existing) throw new Error('すでに editor として登録されています: ' + email);

    const sheet = Config._getSpreadsheet().getSheetByName('editors');
    const now = new Date().toISOString();
    sheet.appendRow([email, name, now, addedBy, true]);
    Config._editorsCache = null;
  },

  /**
   * Deactivate an editor in the editors sheet.
   * editors シートの editor を無効化（論理削除）する。
   *
   * @param {string} email - Email of the editor to remove
   * @throws {Error} If editor not found or is the last active editor
   */
  removeEditor(email) {
    const activeEditors = Config.getEditors().filter(e => e.active);
    if (activeEditors.length <= 1) {
      throw new Error('editors が1人しかいないため削除できません。先に別の editor を追加してください。');
    }

    const sheet = Config._getSpreadsheet().getSheetByName('editors');
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === email) {
        sheet.getRange(i + 1, 5).setValue(false);
        Config._editorsCache = null;
        return;
      }
    }
    throw new Error('指定された editor が見つかりません: ' + email);
  },

  /**
   * Get all active signers from the signers sheet.
   * signers シートからアクティブな署名者一覧を取得する。
   *
   * @returns {Array<{signer_id: string, role: string, name: string, email: string, applies_to: string, priority: number, active: boolean}>}
   */
  getSigners() {
    const sheet = Config._getSpreadsheet().getSheetByName('signers');
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    return data.slice(1)
      .filter(row => row[0])
      .map(row => ({
        signer_id:  String(row[0]),
        role:       String(row[1] || ''),
        name:       String(row[2] || ''),
        email:      String(row[3] || ''),
        applies_to: String(row[4] || ''),
        priority:   Number(row[5]) || 0,
        active:     row[6] === true || row[6] === 'TRUE'
      }))
      .filter(s => s.active);
  },

  /**
   * Invalidate all in-memory caches.
   * 全インメモリキャッシュを無効化する。
   */
  clearCache() {
    Config._generalCache = null;
    Config._editorsCache = null;
  }
};
