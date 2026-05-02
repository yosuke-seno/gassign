/**
 * EditorManager.gs
 * Add and remove editors with permission checks and audit logging.
 * 権限チェックと監査ログ付きの editor 追加・削除。
 *
 * Business invariants enforced here (not in Config.gs):
 *   - editors must always have at least one active member
 *   - a user cannot remove themselves
 * ここで守るビジネス不変条件:
 *   - editor は常に最低 1 人アクティブである必要がある
 *   - 自分自身は削除できない
 */

const EditorManager = {
  /**
   * List all editors (active and inactive).
   * 全 editor を返す（active/inactive 問わず）。
   *
   * @returns {Array<{email:string, name:string, added_at:string, added_by:string, active:boolean}>}
   */
  list() {
    requireEditor();
    return Config.getEditors();
  },

  /**
   * Add a new editor.
   * 新しい editor を追加する。
   *
   * @param {string} email - New editor's email address
   * @param {string} name - New editor's display name
   * @throws {Error} If the email is already an active editor
   */
  add(email, name) {
    requireEditor();

    if (!email || !email.includes('@')) {
      throw new Error('有効なメールアドレスを入力してください');
    }

    const actorEmail = Session.getActiveUser().getEmail();
    Config.addEditor(email, name || '', actorEmail);

    AuditLog.log({
      actor_email: actorEmail,
      actor_type: 'user',
      action: 'editor_added',
      target_type: 'editor',
      target_id: email,
      after_state: { email: email, name: name },
      description: 'editor を追加しました: ' + email
    });
  },

  /**
   * Remove (deactivate) an editor.
   * editor を削除（無効化）する。
   *
   * @param {string} email - Email of the editor to remove
   * @throws {Error} If trying to remove self, or if this is the last active editor
   */
  remove(email) {
    requireEditor();

    const actorEmail = Session.getActiveUser().getEmail();
    if (email === actorEmail) {
      throw new Error('自分自身を editors から削除することはできません');
    }

    // Config.removeEditor already checks the "last editor" invariant
    Config.removeEditor(email);

    AuditLog.log({
      actor_email: actorEmail,
      actor_type: 'user',
      action: 'editor_removed',
      target_type: 'editor',
      target_id: email,
      before_state: { email: email, active: true },
      after_state: { email: email, active: false },
      description: 'editor を削除しました: ' + email
    });
  }
};
