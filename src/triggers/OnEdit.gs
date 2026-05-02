/**
 * triggers/OnEdit.gs
 * Tamper detection for the audit_log spreadsheet.
 * 監査ログスプレッドシートの改ざん検知トリガー。
 *
 * Install via installAuditLogTrigger() — called automatically by initializeApp().
 * installAuditLogTrigger() でインストールする（initializeApp() から自動で呼ばれる）。
 */

/**
 * Prevent edits to existing rows in the audit_log logs sheet.
 * Reverts the change and logs the tampering attempt.
 * audit_log の logs シートの既存行への編集を禁止する。
 * 変更をリバートし、不正試行を記録する。
 *
 * Installed as an installable onEdit trigger on the audit_log spreadsheet.
 * audit_log スプレッドシートにインストールされた onEdit トリガーとして動作する。
 *
 * NOTE: This fires only on user edits, not on programmatic writes (appendRow, setValue).
 * 注意: ユーザー操作による編集のみトリガーされ、スクリプトによる書き込みは対象外。
 *
 * @param {GoogleAppsScript.Events.SheetsOnEdit} e
 */
function onEditProtectAuditLog(e) {
  const sheet = e.source.getActiveSheet();
  if (sheet.getName() !== 'logs') return;

  const editedRow = e.range.getRow();
  const lastRow = sheet.getLastRow();

  // The last row is a newly appended entry — allow only that (defensive; shouldn't happen
  // via user UI since users don't normally append, but guard anyway)
  if (editedRow === lastRow) return;

  // Revert the attempted edit
  if (e.oldValue !== undefined) {
    e.range.setValue(e.oldValue);
  } else {
    e.range.clearContent();
  }

  // Record the tampering attempt
  try {
    const actorEmail = Session.getActiveUser().getEmail() || '(不明)';
    AuditLog.log({
      actor_email: actorEmail,
      actor_type: 'user',
      action: 'permission_denied',
      target_type: 'audit_log',
      target_id: 'logs',
      metadata: {
        row: editedRow,
        column: e.range.getColumn(),
        attempted_value: e.value
      },
      description: '監査ログへの不正な編集が試みられました（行 ' + editedRow + '）'
    });
  } catch (err) {
    Logger.log('[OnEdit] 改ざん試行のログ記録に失敗: ' + err.message);
  }
}

/**
 * Install the installable onEdit trigger for the audit_log spreadsheet.
 * audit_log スプレッドシートに onEdit トリガーをインストールする。
 *
 * Removes any existing duplicate before installing to stay idempotent.
 * 重複を避けるため既存のトリガーを先に削除する。
 *
 * Called automatically by initializeApp().
 * initializeApp() から自動で呼ばれる。
 *
 * @throws {Error} If AUDIT_LOG_ID is not set
 */
function installAuditLogTrigger() {
  const auditLogId = PropertiesService.getScriptProperties().getProperty('AUDIT_LOG_ID');
  if (!auditLogId) throw new Error('AUDIT_LOG_ID が未設定です');

  // Remove existing triggers for this handler to stay idempotent
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'onEditProtectAuditLog') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('onEditProtectAuditLog')
    .forSpreadsheet(auditLogId)
    .onEdit()
    .create();

  Logger.log('audit_log の保護トリガーをインストールしました');
}
