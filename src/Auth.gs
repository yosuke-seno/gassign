/**
 * Auth.gs
 * Permission checking for editor access.
 * editor 権限チェック。
 */

/**
 * Check if the current user has editor permission.
 * 現在のユーザーが editor 権限を持つかチェックする。
 *
 * @returns {boolean}
 */
function canEdit() {
  const email = Session.getActiveUser().getEmail();
  if (!email) return false;
  return Config.getEditors().some(e => e.email === email && e.active === true);
}

/**
 * Throw if the current user is not an editor.
 * editor でなければ例外を投げる。
 * Call this at the top of every write-side API function.
 * すべての書き込み系 API 関数の冒頭で呼ぶこと。
 *
 * @throws {Error} If the current user is not an active editor
 */
function requireEditor() {
  if (!canEdit()) {
    try {
      const email = Session.getActiveUser().getEmail() || '(不明)';
      AuditLog.log({
        actor_email: email,
        actor_type: 'user',
        action: 'permission_denied',
        target_type: 'system',
        target_id: 'web_app',
        description: '編集権限のない操作が試みられました'
      });
    } catch (e) {
      Logger.log('permission_denied のログ記録に失敗: ' + e.message);
    }
    throw new Error('この操作には編集権限が必要です。管理者にお問い合わせください。');
  }
}

/**
 * Get the current user's email and edit permission.
 * 現在のユーザーのメールアドレスと編集権限を返す。
 *
 * @returns {{email: string, canEdit: boolean}}
 */
function getCurrentUser() {
  const email = Session.getActiveUser().getEmail();
  return {
    email: email || '',
    canEdit: canEdit()
  };
}
