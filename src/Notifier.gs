/**
 * Notifier.gs
 * Email notifications via Gmail.
 * Gmail によるメール通知。
 *
 * Notification settings are read from config.notifications sheet.
 * 通知設定は config.notifications シートから読み込む。
 */

const Notifier = {
  /**
   * Notify when a signature request is sent.
   * 署名依頼送信時に通知する。
   *
   * @param {Object} contract
   */
  sendOnContractSent(contract) {
    if (!Notifier._isEnabled('contract_sent')) return;

    const subject = '【gassign】署名依頼を送信しました: ' + contract.title;
    const body = Notifier._buildBody([
      '以下の契約の署名依頼を送信しました。',
      '',
      '件名:     ' + contract.title,
      '契約 ID:  ' + contract.id,
      '相手先:   ' + contract.counterparty_name,
      '社内署名者: ' + contract.internal_signer_name + ' <' + contract.internal_signer_email + '>',
      '相手先署名者: ' + contract.counterparty_signer_name + ' <' + contract.counterparty_signer_email + '>',
      '送信日時: ' + Notifier._now()
    ]);

    Notifier._sendTo('contract_sent', contract, subject, body);
  },

  /**
   * Notify when internal signing is completed.
   * 社内署名完了時に通知する。
   *
   * @param {Object} contract
   */
  sendOnInternalSigned(contract) {
    if (!Notifier._isEnabled('internal_signed')) return;

    const subject = '【gassign】社内署名が完了しました: ' + contract.title;
    const body = Notifier._buildBody([
      '社内署名が完了しました。相手先への署名依頼が自動送信されています。',
      '',
      '件名:     ' + contract.title,
      '契約 ID:  ' + contract.id,
      '相手先:   ' + contract.counterparty_name,
      '署名待ち: ' + contract.counterparty_signer_name + ' <' + contract.counterparty_signer_email + '>',
      '完了日時: ' + Notifier._now()
    ]);

    Notifier._sendTo('internal_signed', contract, subject, body);
  },

  /**
   * Notify when the contract is fully signed by all parties.
   * 全員の署名が完了して契約が締結された時に通知する。
   *
   * @param {Object} contract
   */
  sendOnCompleted(contract) {
    if (!Notifier._isEnabled('completed')) return;

    const subject = '【gassign】契約が締結されました: ' + contract.title;
    const body = Notifier._buildBody([
      'すべての署名が完了し、契約が締結されました。',
      '',
      '件名:     ' + contract.title,
      '契約 ID:  ' + contract.id,
      '相手先:   ' + contract.counterparty_name,
      '締結日時: ' + Notifier._now(),
      '',
      '署名済み PDF は Google Drive でご確認いただけます。'
    ]);

    Notifier._sendTo('completed', contract, subject, body);
  },

  /**
   * Notify when a contract is rejected or withdrawn.
   * 契約が却下・取り下げになった時に通知する。
   *
   * @param {Object} contract
   * @param {string} [reason]
   */
  sendOnRejected(contract, reason) {
    const subject = '【gassign】契約が取り下げられました: ' + contract.title;
    const lines = [
      '以下の契約が取り下げ・却下されました。',
      '',
      '件名:    ' + contract.title,
      '契約 ID: ' + contract.id,
      '日時:    ' + Notifier._now()
    ];
    if (reason) lines.push('理由:    ' + reason);

    const body = Notifier._buildBody(lines);
    try {
      GmailApp.sendEmail(contract.creator_email, subject, body);
    } catch (e) {
      Logger.log('[Notifier] 却下通知の送信に失敗: ' + e.message);
    }
  },

  /**
   * Send a reminder email to the current pending signer.
   * 現在署名待ちの署名者にリマインダーを送る。
   *
   * @param {Object} contract
   */
  sendReminder(contract) {
    const isInternal = contract.status === 'internal_signing';
    const signerEmail = isInternal
      ? contract.internal_signer_email
      : contract.counterparty_signer_email;
    const signerName = isInternal
      ? contract.internal_signer_name
      : contract.counterparty_signer_name;

    const subject = '【gassign】署名のご依頼（リマインダー）: ' + contract.title;
    const body = Notifier._buildBody([
      signerName + ' 様',
      '',
      '以下の契約書について、まだ署名が完了していません。',
      'お手数ですが、署名のお手続きをお願いいたします。',
      '',
      '件名:    ' + contract.title,
      '契約 ID: ' + contract.id,
      '送信日時: ' + Notifier._now()
    ]);

    try {
      GmailApp.sendEmail(signerEmail, subject, body);
      Logger.log('[Notifier] リマインダーを送信しました: ' + signerEmail);
    } catch (e) {
      Logger.log('[Notifier] リマインダーの送信に失敗: ' + e.message);
      throw e;
    }
  },

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Check if a notification event is enabled in the config.
   * 設定でイベントの通知が有効かチェックする。
   *
   * @param {string} event
   * @returns {boolean}
   */
  _isEnabled(event) {
    try {
      const id = PropertiesService.getScriptProperties().getProperty('CONFIG_ID');
      if (!id) return true; // fallback: enabled

      const sheet = SpreadsheetApp.openById(id).getSheetByName('notifications');
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === event) {
          return data[i][1] === true || data[i][1] === 'TRUE';
        }
      }
      return true; // not found → enabled by default
    } catch (e) {
      Logger.log('[Notifier] 通知設定の読み込みに失敗: ' + e.message);
      return true;
    }
  },

  /**
   * Get recipient addresses for a notification event.
   * 通知イベントの送信先アドレスを取得する。
   *
   * recipient column values: 'creator' | 'signer' | 'creator,signer'
   *
   * @param {string} event
   * @param {Object} contract
   * @returns {string[]}
   */
  _getRecipients(event, contract) {
    try {
      const id = PropertiesService.getScriptProperties().getProperty('CONFIG_ID');
      if (!id) return [contract.creator_email];

      const sheet = SpreadsheetApp.openById(id).getSheetByName('notifications');
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] !== event) continue;

        const recipientConfig = String(data[i][2] || 'creator');
        const addrs = new Set();
        recipientConfig.split(',').forEach(function(r) {
          r = r.trim();
          if (r === 'creator') addrs.add(contract.creator_email);
          if (r === 'signer') {
            if (contract.internal_signer_email) addrs.add(contract.internal_signer_email);
            if (contract.counterparty_signer_email) addrs.add(contract.counterparty_signer_email);
          }
        });
        return Array.from(addrs).filter(Boolean);
      }
    } catch (e) {
      Logger.log('[Notifier] 受信者設定の読み込みに失敗: ' + e.message);
    }
    return [contract.creator_email];
  },

  /**
   * Send notification emails to all configured recipients for an event.
   * イベントに設定された全受信者に通知メールを送る。
   *
   * @param {string} event
   * @param {Object} contract
   * @param {string} subject
   * @param {string} body
   */
  _sendTo(event, contract, subject, body) {
    const recipients = Notifier._getRecipients(event, contract);
    recipients.forEach(function(addr) {
      try {
        GmailApp.sendEmail(addr, subject, body);
        Logger.log('[Notifier] メールを送信しました: ' + addr + ' / ' + subject);
      } catch (e) {
        Logger.log('[Notifier] メール送信に失敗: ' + addr + ' - ' + e.message);
      }
    });
  },

  /**
   * Build a plain-text email body with a standard footer.
   * 標準フッター付きのプレーンテキストメール本文を生成する。
   *
   * @param {string[]} lines
   * @returns {string}
   */
  _buildBody(lines) {
    return lines.join('\n') +
      '\n\n---\n' +
      'このメールは gassign から自動送信されています。\n' +
      '返信不要です。';
  },

  /**
   * Return the current time in JST as a human-readable string.
   * 現在時刻を JST で可読形式で返す。
   *
   * @returns {string}
   */
  _now() {
    return Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
  }
};
