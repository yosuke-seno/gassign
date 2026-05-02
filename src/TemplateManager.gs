/**
 * TemplateManager.gs
 * Template CRUD — stored in config spreadsheet's templates sheet.
 * テンプレートの CRUD — config スプレッドシートの templates シートで管理。
 */

const TemplateManager = {
  COL: {
    template_id:  0,
    name:         1,
    category:     2,
    docs_id:      3,
    description:  4,
    usage_count:  5,
    active:       6
  },

  /**
   * Get the templates sheet from the config spreadsheet.
   * config スプレッドシートの templates シートを取得する。
   *
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  _getSheet() {
    const id = PropertiesService.getScriptProperties().getProperty('CONFIG_ID');
    if (!id) throw new Error('CONFIG_ID が設定されていません。initializeApp() を実行してください。');
    return SpreadsheetApp.openById(id).getSheetByName('templates');
  },

  /**
   * Convert a row array to a template object.
   * 行配列をテンプレートオブジェクトに変換する。
   *
   * @param {Array} row
   * @returns {Object}
   */
  _rowToTemplate(row) {
    const c = TemplateManager.COL;
    return {
      template_id:  row[c.template_id],
      name:         row[c.name],
      category:     row[c.category] || '',
      docs_id:      row[c.docs_id],
      description:  row[c.description] || '',
      usage_count:  Number(row[c.usage_count]) || 0,
      active:       row[c.active] === true || row[c.active] === 'TRUE'
    };
  },

  /**
   * Generate the next template ID.
   * 次のテンプレート ID を生成する。
   *
   * @returns {string} e.g. "T-001"
   */
  _generateId() {
    const data = TemplateManager._getSheet().getDataRange().getValues();
    const count = data.slice(1).filter(row => row[0]).length;
    return 'T-' + String(count + 1).padStart(3, '0');
  },

  /**
   * List all active templates.
   * アクティブなテンプレート一覧を返す。
   *
   * @returns {Array<Object>}
   */
  list() {
    return TemplateManager.listAll().filter(t => t.active);
  },

  /**
   * List all templates including inactive.
   * 非アクティブを含む全テンプレートを返す。
   *
   * @returns {Array<Object>}
   */
  listAll() {
    const data = TemplateManager._getSheet().getDataRange().getValues();
    if (data.length <= 1) return [];
    return data.slice(1)
      .filter(row => row[0])
      .map(row => TemplateManager._rowToTemplate(row));
  },

  /**
   * Get a template by ID (including inactive).
   * ID でテンプレートを取得する（非アクティブも含む）。
   *
   * @param {string} id - Template ID
   * @returns {Object|null}
   */
  get(id) {
    const data = TemplateManager._getSheet().getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) return TemplateManager._rowToTemplate(data[i]);
    }
    return null;
  },

  /**
   * Register a new template.
   * 新しいテンプレートを登録する。
   *
   * @param {Object} params
   * @param {string} params.name - Display name
   * @param {string} params.docs_id - Google Docs template file ID
   * @param {string} [params.category]
   * @param {string} [params.description]
   * @returns {string} Template ID
   */
  create(params) {
    requireEditor();

    const templateId = TemplateManager._generateId();
    TemplateManager._getSheet().appendRow([
      templateId,
      params.name,
      params.category || '',
      params.docs_id,
      params.description || '',
      0,
      true
    ]);

    AuditLog.log({
      actor_email: Session.getActiveUser().getEmail(),
      actor_type: 'user',
      action: 'template_created',
      target_type: 'template',
      target_id: templateId,
      after_state: { name: params.name, docs_id: params.docs_id },
      description: 'テンプレートを登録しました: ' + params.name
    });

    return templateId;
  },

  /**
   * Update template metadata.
   * テンプレートのメタデータを更新する。
   *
   * @param {string} id - Template ID
   * @param {Object} params - Fields to update
   */
  update(id, params) {
    requireEditor();

    const sheet = TemplateManager._getSheet();
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        const c = TemplateManager.COL;
        const before = TemplateManager._rowToTemplate(data[i]);
        if (params.name !== undefined)        sheet.getRange(i + 1, c.name + 1).setValue(params.name);
        if (params.category !== undefined)    sheet.getRange(i + 1, c.category + 1).setValue(params.category);
        if (params.docs_id !== undefined)     sheet.getRange(i + 1, c.docs_id + 1).setValue(params.docs_id);
        if (params.description !== undefined) sheet.getRange(i + 1, c.description + 1).setValue(params.description);

        AuditLog.log({
          actor_email: Session.getActiveUser().getEmail(),
          actor_type: 'user',
          action: 'template_edited',
          target_type: 'template',
          target_id: id,
          before_state: before,
          description: 'テンプレートを更新しました: ' + id
        });
        return;
      }
    }
    throw new Error('テンプレートが見つかりません: ' + id);
  },

  /**
   * Soft-delete a template by setting active = FALSE.
   * active = FALSE を設定してテンプレートを論理削除する。
   *
   * @param {string} id - Template ID
   */
  delete(id) {
    requireEditor();

    const sheet = TemplateManager._getSheet();
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        sheet.getRange(i + 1, TemplateManager.COL.active + 1).setValue(false);
        AuditLog.log({
          actor_email: Session.getActiveUser().getEmail(),
          actor_type: 'user',
          action: 'template_deleted',
          target_type: 'template',
          target_id: id,
          description: 'テンプレートを削除しました: ' + id
        });
        return;
      }
    }
    throw new Error('テンプレートが見つかりません: ' + id);
  },

  /**
   * Increment the usage count for a template.
   * テンプレートの使用回数をインクリメントする。
   *
   * @param {string} id - Template ID
   */
  incrementUsageCount(id) {
    const sheet = TemplateManager._getSheet();
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        const current = Number(data[i][TemplateManager.COL.usage_count]) || 0;
        sheet.getRange(i + 1, TemplateManager.COL.usage_count + 1).setValue(current + 1);
        return;
      }
    }
  }
};
