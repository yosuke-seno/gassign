/**
 * DocsHelper.gs
 * Google Docs operations: template variable extraction and substitution.
 * Google Docs 操作: テンプレート変数の抽出と置換。
 *
 * Template variables use {{key}} syntax.
 * テンプレート変数は {{key}} 記法を使用する。
 */

const DocsHelper = {
  /**
   * Extract all unique variable names ({{key}}) from a Google Doc.
   * Google Doc から全ユニーク変数名を抽出する。
   *
   * @param {string} docId - Google Docs file ID
   * @returns {string[]} Sorted array of variable names (without braces)
   */
  extractVariables(docId) {
    const doc = DocumentApp.openById(docId);
    const text = doc.getBody().getText();
    const variables = new Set();
    const re = /\{\{([^}]+)\}\}/g;
    let match;
    while ((match = re.exec(text)) !== null) {
      variables.add(match[1].trim());
    }
    return Array.from(variables).sort();
  },

  /**
   * Replace all {{key}} placeholders in a Google Doc in place.
   * Google Doc の全 {{key}} プレースホルダーをインプレースで置換する。
   *
   * @param {string} docId - Google Docs file ID to modify
   * @param {Object<string, string>} variables - Key-value substitution map
   */
  replaceVariables(docId, variables) {
    const doc = DocumentApp.openById(docId);
    const body = doc.getBody();
    Object.entries(variables).forEach(([key, value]) => {
      body.replaceText('\\{\\{' + key + '\\}\\}', String(value || ''));
    });
    doc.saveAndClose();
  },

  /**
   * Copy a template Doc into a folder and replace variables.
   * テンプレート Docs をコピーしてフォルダに配置後、変数を置換する。
   *
   * @param {string} templateDocId - Source template Docs file ID
   * @param {string} newName - Name for the new document
   * @param {string} folderId - Destination Drive folder ID
   * @param {Object<string, string>} variables - Template variable substitutions
   * @returns {string} New document ID
   */
  createFromTemplate(templateDocId, newName, folderId, variables) {
    const newDocId = DriveHelper.copyFile(templateDocId, newName, folderId);
    if (variables && Object.keys(variables).length > 0) {
      DocsHelper.replaceVariables(newDocId, variables);
    }
    return newDocId;
  }
};
