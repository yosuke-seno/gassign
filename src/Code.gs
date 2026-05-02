/**
 * Code.gs
 * Web App entry point: doGet / doPost routing.
 * Web App エントリポイント: doGet/doPost ルーティング。
 */

/** Views that require editor permission */
const EDITOR_ONLY_VIEWS = ['new', 'templates', 'audit', 'editors'];

/**
 * Handle GET requests and serve the appropriate HTML view.
 * GET リクエストを処理し対応する HTML ビューを返す。
 *
 * @param {GoogleAppsScript.Events.DoGet} e
 * @returns {GoogleAppsScript.HTML.HtmlOutput}
 */
function doGet(e) {
  const params = e.parameter || {};
  const requestedView = params.view || 'dashboard';
  const user = getCurrentUser();

  // Redirect non-editors away from editor-only views
  const view = (EDITOR_ONLY_VIEWS.includes(requestedView) && !user.canEdit)
    ? 'dashboard'
    : requestedView;

  try {
    return buildPage(view, params, user);
  } catch (err) {
    Logger.log(err.stack);
    return HtmlService.createHtmlOutput(
      '<style>body{font-family:sans-serif;padding:2rem}</style>' +
      '<h2>エラーが発生しました</h2><p>管理者にお問い合わせください。</p>'
    ).setTitle('gassign — エラー');
  }
}

/**
 * Handle POST requests as a JSON API.
 * POST リクエストを JSON API として処理する。
 *
 * @param {GoogleAppsScript.Events.DoPost} e
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const result = dispatch(body);
    return jsonResponse({ success: true, data: result });
  } catch (err) {
    Logger.log(err.stack);
    return jsonResponse({ success: false, error: { message: err.message } });
  }
}

/**
 * Route an API action to the appropriate handler.
 * API アクションを対応するハンドラにルーティングする。
 *
 * @param {Object} body - Parsed POST body with `action` field
 * @returns {*} Handler return value
 */
function dispatch(body) {
  const action = body.action;

  switch (action) {
    // --- Contract ---
    case 'createContractWithDoc': return createContractWithDoc(body.params);
    case 'updateContract':        return ContractManager.update(body.id, body.params);
    case 'getContract':           return ContractManager.get(body.id);
    case 'listContracts':         return ContractManager.list(body.filters);
    case 'updateStatus':          return ContractManager.updateStatus(body.id, body.status, body.additionalFields);

    // --- Template ---
    case 'createTemplate':        return TemplateManager.create(body.params);
    case 'updateTemplate':        return TemplateManager.update(body.id, body.params);
    case 'deleteTemplate':        return TemplateManager.delete(body.id);
    case 'listTemplates':         return TemplateManager.list();
    case 'getTemplate':           return TemplateManager.get(body.id);

    // --- Docs ---
    case 'extractVariables':      return DocsHelper.extractVariables(body.docId);

    // --- eSignature / contract actions ---
    case 'sendSignatureRequest':  return sendSignatureRequestApi(body.id);
    case 'syncContractStatus':    return syncContractStatusApi(body.id);
    case 'withdrawContract':      return withdrawContractApi(body.id, body.reason);
    case 'sendReminder':          return sendReminderApi(body.id);

    // --- Editor management ---
    case 'addEditor':    return EditorManager.add(body.email, body.name);
    case 'removeEditor': return EditorManager.remove(body.email);
    case 'listEditors':  return EditorManager.list();

    // --- Audit log ---
    case 'getAuditLog':           return getAuditLogApi(body.filters);

    // --- User ---
    case 'getCurrentUser':        return getCurrentUser();

    default:
      throw new Error('不明なアクション: ' + action);
  }
}

// ---------------------------------------------------------------------------
// Composite operations
// ---------------------------------------------------------------------------

/**
 * Create a contract along with its Drive folder and Docs document.
 * Drive フォルダと Docs ドキュメントを作成してから契約レコードを登録する。
 *
 * Flow:
 *   1. Create contract record (gets ID)
 *   2. Create YYYY/MM subfolder under contracts/
 *   3. Create contract-specific folder
 *   4. Copy template Doc and replace variables
 *   5. Update contract with folder_id and doc_id
 *
 * @param {Object} params - Same params as ContractManager.create(), plus template_variables
 * @returns {string} Contract ID
 */
function createContractWithDoc(params) {
  requireEditor();

  const contractId = ContractManager.create(params);

  try {
    const props = PropertiesService.getScriptProperties();
    const contractsFolderId = props.getProperty('CONTRACTS_FOLDER_ID');

    // Build YYYY/MM path
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const monthFolderId = DriveHelper.getOrCreateFolder(mm, DriveHelper.getOrCreateFolder(yyyy, contractsFolderId));

    // Create contract-specific folder: C-XXX_counterparty_kind
    const folderName = contractId + '_' + (params.counterparty_name || '').replace(/[/\\:*?"<>|]/g, '_');
    const contractFolderId = DriveHelper.createFolder(folderName, monthFolderId);

    // Copy template Doc and replace variables
    let docId = '';
    const template = params.template_id ? TemplateManager.get(params.template_id) : null;
    if (template && template.docs_id) {
      const docName = contractId + '_' + (params.counterparty_name || '') + '_' + (template.name || '');
      docId = DocsHelper.createFromTemplate(template.docs_id, docName, contractFolderId, params.template_variables || {});
      TemplateManager.incrementUsageCount(params.template_id);
    }

    // Update the contract record with Drive references
    ContractManager.update(contractId, { folder_id: contractFolderId, doc_id: docId });

  } catch (e) {
    Logger.log('[createContractWithDoc] Drive/Docs 作成に失敗: ' + e.stack);
    // Contract record exists but without folder/doc — non-fatal, user can retry
  }

  return contractId;
}

/**
 * Send a signature request for a contract via eSignature API.
 * eSignature API で契約の署名依頼を送信する。
 *
 * Updates status to internal_signing and notifies the creator.
 * ステータスを internal_signing に更新し、作成者に通知する。
 *
 * @param {string} contractId
 * @returns {{requestId: string}}
 */
function sendSignatureRequestApi(contractId) {
  requireEditor();

  const contract = ContractManager.get(contractId);
  if (!contract) throw new Error('契約が見つかりません: ' + contractId);
  if (contract.status !== 'draft') {
    throw new Error('draft 状態の契約のみ送信できます（現在: ' + contract.status + '）');
  }
  if (!contract.doc_id) {
    throw new Error('契約書ドキュメントがありません。契約書を作成してから送信してください。');
  }

  const requestId = ESignature.sendRequest(contract);

  ContractManager.updateStatus(contractId, 'internal_signing', {
    sent_at: new Date().toISOString(),
    esignature_request_id: requestId
  });

  const updated = ContractManager.get(contractId);
  Notifier.sendOnContractSent(updated);

  return { requestId: requestId };
}

/**
 * Withdraw a contract by cancelling the eSignature request and setting status to rejected.
 * eSignature 依頼をキャンセルしてステータスを rejected に更新する。
 *
 * @param {string} contractId
 * @param {string} [reason] - Reason for withdrawal
 */
function withdrawContractApi(contractId, reason) {
  requireEditor();

  const contract = ContractManager.get(contractId);
  if (!contract) throw new Error('契約が見つかりません: ' + contractId);

  const withdrawable = ['internal_signing', 'external_signing'];
  if (!withdrawable.includes(contract.status)) {
    throw new Error('この状態の契約は取り下げられません（現在: ' + contract.status + '）');
  }

  // Cancel eSignature request if one exists
  if (contract.esignature_request_id && contract.doc_id) {
    try {
      ESignature.cancelRequest(contract.esignature_request_id, contract.doc_id);
    } catch (e) {
      Logger.log('[withdrawContract] eSignature キャンセルに失敗（続行）: ' + e.message);
    }
  }

  ContractManager.updateStatus(contractId, 'rejected', {});

  const updated = ContractManager.get(contractId);
  Notifier.sendOnRejected(updated, reason || '');

  return { success: true };
}

/**
 * Send a reminder email to the current pending signer.
 * 現在署名待ちの署名者にリマインダーを送る。
 *
 * @param {string} contractId
 */
function sendReminderApi(contractId) {
  requireEditor();

  const contract = ContractManager.get(contractId);
  if (!contract) throw new Error('契約が見つかりません: ' + contractId);

  const remindable = ['internal_signing', 'external_signing'];
  if (!remindable.includes(contract.status)) {
    throw new Error('この状態の契約にはリマインダーを送信できません（現在: ' + contract.status + '）');
  }

  Notifier.sendReminder(contract);

  AuditLog.log({
    actor_email: Session.getActiveUser().getEmail(),
    actor_type: 'user',
    action: 'contract_reminded',
    contract_id: contractId,
    target_type: 'contract',
    target_id: contractId,
    description: 'リマインダーを送信しました: ' + contractId
  });

  return { success: true };
}

/**
 * Manually sync a single contract's eSignature status.
 * 1件の契約の eSignature ステータスを手動で同期する。
 *
 * @param {string} contractId
 * @returns {{changed: boolean, newStatus: string|null}}
 */
function syncContractStatusApi(contractId) {
  requireEditor();

  const contract = ContractManager.get(contractId);
  if (!contract) throw new Error('契約が見つかりません: ' + contractId);

  return DailySync.syncContract(contract);
}

/**
 * Get audit log entries (editor only).
 * 監査ログを取得する（editor 限定）。
 *
 * @param {Object} [filters]
 * @param {string} [filters.contract_id]
 * @returns {Array<Object>}
 */
function getAuditLogApi(filters) {
  requireEditor();
  return AuditLog.list(filters);
}

// ---------------------------------------------------------------------------
// HTML rendering helpers
// ---------------------------------------------------------------------------

/**
 * Build and return an HtmlOutput for the given view.
 * 指定ビューの HtmlOutput を構築して返す。
 *
 * @param {string} view
 * @param {Object} params - URL parameters
 * @param {{email: string, canEdit: boolean}} user
 * @returns {GoogleAppsScript.HTML.HtmlOutput}
 */
function buildPage(view, params, user) {
  const viewMap = {
    dashboard:  'views/Dashboard',
    new:        'views/NewContract',
    contract:   'views/ContractDetail',
    templates:  'views/Templates',
    audit:      'views/AuditLog',
    editors:    'views/Editors'
  };

  const file = viewMap[view] || viewMap['dashboard'];
  const tmpl = HtmlService.createTemplateFromFile(file);
  tmpl.currentUser = user;
  tmpl.params = params;

  // Inject view-specific server-side data
  switch (view) {
    case 'dashboard':
      tmpl.contracts = ContractManager.list();
      break;
    case 'new':
      tmpl.templates = TemplateManager.list();
      tmpl.signers = Config.getSigners();
      break;
    case 'contract': {
      const contract = params.id ? ContractManager.get(params.id) : null;
      tmpl.contract = contract;
      tmpl.contractLogs = contract ? AuditLog.list({ contract_id: params.id }) : [];
      break;
    }
    case 'templates':
      tmpl.templates = TemplateManager.listAll();
      break;
    case 'audit':
      tmpl.logs = AuditLog.list({ limit: 200 });
      break;
    case 'editors':
      tmpl.editors = Config.getEditors();
      break;
  }

  return tmpl.evaluate()
    .setTitle('gassign')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Return the raw HTML content of a file (used in server-side template includes).
 * ファイルの HTML 内容を返す（サーバーサイドテンプレートの include で使用）。
 *
 * Usage in .html files: <?!= include('views/shared/Styles') ?>
 *
 * @param {string} filename - File path without .html extension
 * @returns {string}
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Single server-side entry point for google.script.run calls from the frontend.
 * フロントエンドの google.script.run から呼ばれる単一のサーバーエントリポイント。
 *
 * Usage: google.script.run.withSuccessHandler(cb).callServer('action', payload)
 *
 * @param {string} action - Action name
 * @param {Object} [payload] - Additional parameters
 * @returns {*} Handler return value
 */
function callServer(action, payload) {
  return dispatch(Object.assign({ action: action }, payload || {}));
}

/**
 * Wrap data as a JSON ContentService response.
 * データを JSON ContentService レスポンスにラップする。
 *
 * @param {Object} data
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
