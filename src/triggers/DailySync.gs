/**
 * triggers/DailySync.gs
 * Daily status synchronization with the eSignature API.
 * eSignature API との毎日のステータス同期。
 *
 * Install the trigger once by calling installDailySyncTrigger().
 * installDailySyncTrigger() を1回呼んでトリガーをインストールする。
 */

/**
 * Sync eSignature statuses for all in-progress contracts.
 * 進行中の全契約の eSignature ステータスを同期する。
 *
 * Called daily by the time-based trigger (installed at 9:00 JST).
 * 毎朝 9:00 JST のタイムベーストリガーから呼ばれる。
 */
function dailySyncStatuses() {
  Logger.log('[DailySync] ステータス同期を開始します...');

  const inProgress = ContractManager.list({ status: 'internal_signing' })
    .concat(ContractManager.list({ status: 'external_signing' }));

  if (inProgress.length === 0) {
    Logger.log('[DailySync] 同期対象の契約はありません');
    return;
  }

  let synced = 0, changed = 0;

  inProgress.forEach(function(contract) {
    try {
      const result = DailySync.syncContract(contract);
      synced++;
      if (result.changed) changed++;
    } catch (e) {
      Logger.log('[DailySync] 契約 ' + contract.id + ' の同期に失敗: ' + e.message);
      AuditLog.log({
        actor_email: 'system',
        actor_type: 'system',
        action: 'sync_executed',
        contract_id: contract.id,
        target_type: 'contract',
        target_id: contract.id,
        metadata: { error: e.message },
        description: 'ステータス同期中にエラーが発生しました: ' + contract.id
      });
    }
  });

  AuditLog.log({
    actor_email: 'system',
    actor_type: 'system',
    action: 'sync_executed',
    target_type: 'system',
    target_id: 'daily_sync',
    after_state: { synced: synced, changed: changed },
    description: 'ステータス同期が完了しました。対象: ' + synced + '件、変更: ' + changed + '件'
  });

  Logger.log('[DailySync] 完了。対象: ' + synced + '件、変更: ' + changed + '件');
}

const DailySync = {
  /**
   * Sync a single contract's eSignature status and update the ledger if changed.
   * 1件の契約の eSignature ステータスを同期し、変更があれば台帳を更新する。
   *
   * @param {Object} contract - Contract object from ContractManager
   * @returns {{changed: boolean, newStatus: string|null}}
   */
  syncContract(contract) {
    if (!contract.esignature_request_id || !contract.doc_id) {
      return { changed: false, newStatus: null };
    }

    const result = ESignature.getStatus(contract.esignature_request_id, contract.doc_id);
    const newStatus = result.status;

    if (newStatus === contract.status) {
      return { changed: false, newStatus: newStatus };
    }

    Logger.log('[DailySync] ' + contract.id + ': ' + contract.status + ' → ' + newStatus);

    const additionalFields = {};
    if (newStatus === 'external_signing') {
      additionalFields.internal_signed_at = new Date().toISOString();
    } else if (newStatus === 'signed') {
      additionalFields.counterparty_signed_at = new Date().toISOString();
      additionalFields.completed_at = new Date().toISOString();
      if (result.signedPdfId) {
        additionalFields.signed_pdf_id = result.signedPdfId;
      }
    }

    ContractManager.updateStatus(contract.id, newStatus, additionalFields);

    // Send notifications based on the new status
    const updated = ContractManager.get(contract.id);
    if (newStatus === 'external_signing') {
      Notifier.sendOnInternalSigned(updated);
    } else if (newStatus === 'signed') {
      Notifier.sendOnCompleted(updated);
    } else if (newStatus === 'rejected') {
      Notifier.sendOnRejected(updated);
    }

    return { changed: true, newStatus: newStatus };
  }
};

/**
 * Install the daily time-based trigger for status synchronization.
 * ステータス同期用の毎日タイムベーストリガーをインストールする。
 *
 * Runs dailySyncStatuses() every day at 9:00 AM JST.
 * 毎日 JST 9:00 に dailySyncStatuses() を実行する。
 *
 * Removes any existing duplicate before installing (idempotent).
 * 重複を避けるため既存のトリガーを先に削除する。
 */
function installDailySyncTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'dailySyncStatuses') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('dailySyncStatuses')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .inTimezone('Asia/Tokyo')
    .create();

  Logger.log('dailySyncStatuses トリガーをインストールしました（毎日 9:00 JST）');
}
