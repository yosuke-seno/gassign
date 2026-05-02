/**
 * AuditLog.gs
 * Append-only operation log.
 * 追記専用の操作ログ。
 *
 * Every state-changing operation must call AuditLog.log().
 * すべての状態変更操作は AuditLog.log() を呼ぶこと。
 */

const AuditLog = {
  /**
   * Append one log entry to the audit_log spreadsheet.
   * 監査ログスプレッドシートに1件追記する。
   *
   * @param {Object} params
   * @param {string} params.actor_email - Actor's email
   * @param {string} [params.actor_type='user'] - 'user', 'system', or 'api'
   * @param {string} params.action - Action enum (see CLAUDE.md for valid values)
   * @param {string} [params.contract_id] - Related contract ID
   * @param {string} [params.target_type] - Type of the affected object
   * @param {string} [params.target_id] - ID of the affected object
   * @param {*} [params.before_state] - State before the action (serialized to JSON)
   * @param {*} [params.after_state] - State after the action (serialized to JSON)
   * @param {*} [params.metadata] - Additional context (serialized to JSON)
   * @param {string} params.description - Human-readable description in Japanese
   */
  log(params) {
    const id = PropertiesService.getScriptProperties().getProperty('AUDIT_LOG_ID');
    if (!id) {
      Logger.log('[AuditLog] AUDIT_LOG_ID が未設定のためスキップ: ' + (params.action || ''));
      return;
    }

    try {
      const ss = SpreadsheetApp.openById(id);
      const sheet = ss.getSheetByName('logs');
      if (!sheet) {
        Logger.log('[AuditLog] logs シートが見つかりません');
        return;
      }

      const row = [
        AuditLog._generateLogId(),
        new Date().toISOString(),
        params.actor_email || '',
        params.actor_type || 'user',
        params.action || '',
        params.contract_id || '',
        params.target_type || '',
        params.target_id || '',
        params.before_state ? JSON.stringify(params.before_state) : '',
        params.after_state ? JSON.stringify(params.after_state) : '',
        params.metadata ? JSON.stringify(params.metadata) : '',
        params.description || ''
      ];

      sheet.appendRow(row);
    } catch (e) {
      // Never let logging failure crash the caller
      Logger.log('[AuditLog] ログ追記に失敗しました: ' + e.message);
      Logger.log(e.stack);
    }
  },

  /**
   * List audit log entries with optional filters.
   * 監査ログをフィルタ付きで取得する。
   *
   * @param {Object} [filters]
   * @param {string} [filters.contract_id] - Filter by contract ID
   * @param {string} [filters.action] - Filter by action type
   * @param {number} [filters.limit=200] - Maximum rows to return
   * @returns {Array<Object>}
   */
  list(filters) {
    const id = PropertiesService.getScriptProperties().getProperty('AUDIT_LOG_ID');
    if (!id) return [];

    const ss = SpreadsheetApp.openById(id);
    const sheet = ss.getSheetByName('logs');
    if (!sheet || sheet.getLastRow() <= 1) return [];

    const data = sheet.getDataRange().getValues();
    const limit = (filters && filters.limit) || 200;
    let rows = data.slice(1)
      .filter(row => row[0])
      .map(row => ({
        log_id:       row[0],
        timestamp:    row[1],
        actor_email:  row[2],
        actor_type:   row[3],
        action:       row[4],
        contract_id:  row[5],
        target_type:  row[6],
        target_id:    row[7],
        before_state: row[8],
        after_state:  row[9],
        metadata:     row[10],
        description:  row[11]
      }));

    if (filters) {
      if (filters.contract_id) {
        rows = rows.filter(r => r.contract_id === filters.contract_id);
      }
      if (filters.action) {
        rows = rows.filter(r => r.action === filters.action);
      }
    }

    // Return most recent first, capped at limit
    return rows.reverse().slice(0, limit);
  },

  /**
   * Generate a unique log ID.
   * ユニークなログ ID を生成する。
   *
   * @returns {string} e.g. "LOG-20260501-143022-A3F7"
   */
  _generateLogId() {
    const datePart = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd-HHmmss');
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return 'LOG-' + datePart + '-' + rand;
  }
};
