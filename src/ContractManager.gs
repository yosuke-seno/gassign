/**
 * ContractManager.gs
 * Contract CRUD and status transitions.
 * 契約の CRUD とステータス遷移。
 *
 * All write operations require editor permission and record to AuditLog.
 * すべての書き込み操作は editor 権限が必要で AuditLog に記録する。
 */

const ContractManager = {
  /** Column indices for ledger contracts sheet (0-based) */
  COL: {
    id: 0,
    created_at: 1,
    updated_at: 2,
    creator_email: 3,
    status: 4,
    title: 5,
    template_id: 6,
    counterparty_name: 7,
    counterparty_rep: 8,
    counterparty_signer_email: 9,
    counterparty_signer_name: 10,
    internal_signer_email: 11,
    internal_signer_name: 12,
    folder_id: 13,
    doc_id: 14,
    signed_pdf_id: 15,
    esignature_request_id: 16,
    internal_signed_at: 17,
    counterparty_signed_at: 18,
    sent_at: 19,
    completed_at: 20,
    template_variables: 21,
    notes: 22,
    tags: 23
  },

  VALID_STATUSES: ['draft', 'internal_signing', 'external_signing', 'signed', 'rejected'],

  /** Status transition → audit action mapping */
  STATUS_ACTION_MAP: {
    internal_signing: 'contract_sent',
    external_signing: 'contract_internal_signed',
    signed: 'contract_completed',
    rejected: 'contract_rejected'
  },

  /**
   * Get the ledger Spreadsheet.
   * 台帳スプレッドシートを取得する。
   *
   * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
   */
  _getSS() {
    const id = PropertiesService.getScriptProperties().getProperty('LEDGER_ID');
    if (!id) throw new Error('LEDGER_ID が設定されていません。initializeApp() を実行してください。');
    return SpreadsheetApp.openById(id);
  },

  /**
   * Get the contracts sheet.
   * contracts シートを取得する。
   *
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  _getSheet() {
    return ContractManager._getSS().getSheetByName('contracts');
  },

  /**
   * Convert a row array to a contract object.
   * 行配列を契約オブジェクトに変換する。
   *
   * @param {Array} row
   * @returns {Object}
   */
  _rowToContract(row) {
    const c = ContractManager.COL;
    return {
      id: row[c.id],
      created_at: row[c.created_at],
      updated_at: row[c.updated_at],
      creator_email: row[c.creator_email],
      status: row[c.status],
      title: row[c.title],
      template_id: row[c.template_id],
      counterparty_name: row[c.counterparty_name],
      counterparty_rep: row[c.counterparty_rep],
      counterparty_signer_email: row[c.counterparty_signer_email],
      counterparty_signer_name: row[c.counterparty_signer_name],
      internal_signer_email: row[c.internal_signer_email],
      internal_signer_name: row[c.internal_signer_name],
      folder_id: row[c.folder_id],
      doc_id: row[c.doc_id],
      signed_pdf_id: row[c.signed_pdf_id],
      esignature_request_id: row[c.esignature_request_id],
      internal_signed_at: row[c.internal_signed_at],
      counterparty_signed_at: row[c.counterparty_signed_at],
      sent_at: row[c.sent_at],
      completed_at: row[c.completed_at],
      template_variables: row[c.template_variables]
        ? JSON.parse(row[c.template_variables])
        : {},
      notes: row[c.notes],
      tags: row[c.tags]
    };
  },

  /**
   * Find the 1-based row index of a contract by ID (skipping header row).
   * 契約 ID で 1-based 行インデックスを返す（ヘッダー行を除く）。
   *
   * @param {Array[]} data - All sheet values including header
   * @param {string} id - Contract ID
   * @returns {number} 1-based row index, or -1 if not found
   */
  _findRowIndex(data, id) {
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) return i;
    }
    return -1;
  },

  /**
   * Create a new contract record.
   * 新規契約レコードを作成する。
   *
   * @param {Object} params
   * @param {string} params.title
   * @param {string} params.counterparty_name
   * @param {string} params.counterparty_signer_email
   * @param {string} params.counterparty_signer_name
   * @param {string} params.internal_signer_email
   * @param {string} params.internal_signer_name
   * @param {string} [params.template_id]
   * @param {string} [params.counterparty_rep]
   * @param {Object} [params.template_variables]
   * @param {string} [params.folder_id]
   * @param {string} [params.doc_id]
   * @param {string} [params.notes]
   * @param {string} [params.tags]
   * @returns {string} Contract ID (e.g., "C-001")
   */
  create(params) {
    requireEditor();

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const contractId = Config.getNextContractId();
      const now = new Date().toISOString();
      const actorEmail = Session.getActiveUser().getEmail();
      const c = ContractManager.COL;

      const row = new Array(24).fill('');
      row[c.id] = contractId;
      row[c.created_at] = now;
      row[c.updated_at] = now;
      row[c.creator_email] = actorEmail;
      row[c.status] = 'draft';
      row[c.title] = params.title;
      row[c.template_id] = params.template_id || '';
      row[c.counterparty_name] = params.counterparty_name;
      row[c.counterparty_rep] = params.counterparty_rep || '';
      row[c.counterparty_signer_email] = params.counterparty_signer_email;
      row[c.counterparty_signer_name] = params.counterparty_signer_name;
      row[c.internal_signer_email] = params.internal_signer_email;
      row[c.internal_signer_name] = params.internal_signer_name;
      row[c.folder_id] = params.folder_id || '';
      row[c.doc_id] = params.doc_id || '';
      row[c.template_variables] = params.template_variables
        ? JSON.stringify(params.template_variables)
        : '';
      row[c.notes] = params.notes || '';
      row[c.tags] = params.tags || '';

      ContractManager._getSheet().appendRow(row);

      AuditLog.log({
        actor_email: actorEmail,
        actor_type: 'user',
        action: 'contract_created',
        contract_id: contractId,
        target_type: 'contract',
        target_id: contractId,
        after_state: { status: 'draft', title: params.title },
        description: '契約を作成しました: ' + params.title
      });

      return contractId;
    } catch (e) {
      Logger.log(e.stack);
      throw new Error('契約の作成に失敗しました: ' + e.message);
    } finally {
      lock.releaseLock();
    }
  },

  /**
   * Get a contract by ID.
   * ID で契約を取得する。
   *
   * @param {string} id - Contract ID
   * @returns {Object|null} Contract object, or null if not found
   */
  get(id) {
    const sheet = ContractManager._getSheet();
    const data = sheet.getDataRange().getValues();
    const idx = ContractManager._findRowIndex(data, id);
    if (idx === -1) return null;
    return ContractManager._rowToContract(data[idx]);
  },

  /**
   * List contracts with optional filters.
   * フィルタ付きで契約一覧を返す。
   *
   * @param {Object} [filters]
   * @param {string} [filters.status]
   * @param {string} [filters.creator_email]
   * @returns {Array<Object>}
   */
  list(filters) {
    const sheet = ContractManager._getSheet();
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    let contracts = data.slice(1)
      .filter(row => row[ContractManager.COL.id])
      .map(row => ContractManager._rowToContract(row));

    if (filters) {
      if (filters.status) {
        contracts = contracts.filter(c => c.status === filters.status);
      }
      if (filters.creator_email) {
        contracts = contracts.filter(c => c.creator_email === filters.creator_email);
      }
    }

    return contracts;
  },

  /**
   * Update editable fields of a contract.
   * 契約の編集可能フィールドを更新する。
   * Only allowed when status is 'draft'.
   * status が 'draft' の時のみ許可。
   *
   * @param {string} id - Contract ID
   * @param {Object} params - Fields to update
   */
  update(id, params) {
    requireEditor();

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sheet = ContractManager._getSheet();
      const data = sheet.getDataRange().getValues();
      const idx = ContractManager._findRowIndex(data, id);
      if (idx === -1) throw new Error('契約が見つかりません: ' + id);

      const before = ContractManager._rowToContract(data[idx]);
      if (before.status !== 'draft') {
        throw new Error('draft 以外の契約は編集できません（現在のステータス: ' + before.status + '）');
      }

      const c = ContractManager.COL;
      const updatableFields = [
        'title', 'template_id', 'counterparty_name', 'counterparty_rep',
        'counterparty_signer_email', 'counterparty_signer_name',
        'internal_signer_email', 'internal_signer_name',
        'folder_id', 'doc_id', 'notes', 'tags'
      ];

      updatableFields.forEach(field => {
        if (params[field] !== undefined) {
          sheet.getRange(idx + 1, c[field] + 1).setValue(params[field]);
        }
      });

      if (params.template_variables !== undefined) {
        sheet.getRange(idx + 1, c.template_variables + 1)
          .setValue(JSON.stringify(params.template_variables));
      }

      sheet.getRange(idx + 1, c.updated_at + 1).setValue(new Date().toISOString());

      AuditLog.log({
        actor_email: Session.getActiveUser().getEmail(),
        actor_type: 'user',
        action: 'contract_edited',
        contract_id: id,
        target_type: 'contract',
        target_id: id,
        before_state: before,
        after_state: ContractManager.get(id),
        description: '契約を編集しました: ' + id
      });
    } catch (e) {
      Logger.log(e.stack);
      throw new Error('契約の更新に失敗しました: ' + e.message);
    } finally {
      lock.releaseLock();
    }
  },

  /**
   * Update the status of a contract (and optionally other fields).
   * 契約のステータスを更新する（他フィールドの同時更新も可）。
   * This is the only way to change contract status — never write directly to the sheet.
   * ステータス変更はこの関数経由のみ。シートへの直接書き込みは禁止。
   *
   * @param {string} id - Contract ID
   * @param {string} newStatus - New status value
   * @param {Object} [additionalFields] - Other fields to update at the same time (e.g., sent_at)
   */
  updateStatus(id, newStatus, additionalFields) {
    requireEditor();

    if (!ContractManager.VALID_STATUSES.includes(newStatus)) {
      throw new Error('無効なステータスです: ' + newStatus);
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sheet = ContractManager._getSheet();
      const data = sheet.getDataRange().getValues();
      const idx = ContractManager._findRowIndex(data, id);
      if (idx === -1) throw new Error('契約が見つかりません: ' + id);

      const before = ContractManager._rowToContract(data[idx]);
      const c = ContractManager.COL;
      const now = new Date().toISOString();

      sheet.getRange(idx + 1, c.status + 1).setValue(newStatus);
      sheet.getRange(idx + 1, c.updated_at + 1).setValue(now);

      if (additionalFields) {
        Object.entries(additionalFields).forEach(([field, value]) => {
          if (c[field] !== undefined) {
            sheet.getRange(idx + 1, c[field] + 1).setValue(value);
          }
        });
      }

      AuditLog.log({
        actor_email: Session.getActiveUser().getEmail(),
        actor_type: 'user',
        action: ContractManager.STATUS_ACTION_MAP[newStatus] || 'contract_edited',
        contract_id: id,
        target_type: 'contract',
        target_id: id,
        before_state: { status: before.status },
        after_state: { status: newStatus },
        description: 'ステータスを変更しました: ' + before.status + ' → ' + newStatus
      });
    } catch (e) {
      Logger.log(e.stack);
      throw new Error('ステータスの更新に失敗しました: ' + e.message);
    } finally {
      lock.releaseLock();
    }
  }
};
