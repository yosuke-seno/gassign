/**
 * ESignature.gs
 * Google Workspace eSignature API wrapper (Drive API v2beta).
 * Google Workspace eSignature API ラッパー。
 *
 * Requires Google Workspace Business Standard or above.
 * Google Workspace Business Standard 以上が必要。
 *
 * API reference:
 *   https://developers.google.com/drive/api/reference/rest/v2beta/files/requestSignature
 */

const ESignature = {
  BASE_URL: 'https://www.googleapis.com/drive/v2beta',

  /**
   * Send a signature request for a contract.
   * 契約の署名依頼を送信する。
   *
   * Signing order: internal signer (1) → counterparty signer (2).
   * 署名順序: 社内署名者（1番目）→ 相手先（2番目）。
   *
   * @param {Object} contract - Contract object from ContractManager.get()
   * @param {string} [emailMessage] - Custom message included in the signature request email
   * @returns {string} eSignature request ID
   * @throws {Error} If the API call fails or doc_id is missing
   */
  sendRequest(contract, emailMessage) {
    if (!contract.doc_id) {
      throw new Error('契約書ドキュメント (doc_id) が未設定です。先に契約書を作成してください。');
    }

    const payload = {
      signers: [
        {
          email: contract.internal_signer_email,
          role: 'SIGNER',
          signingOrder: 1
        },
        {
          email: contract.counterparty_signer_email,
          role: 'SIGNER',
          signingOrder: 2
        }
      ],
      message: emailMessage || ESignature._buildEmailMessage(contract)
    };

    const url = ESignature.BASE_URL + '/files/' + contract.doc_id + '/requestSignature';
    const res = ESignature._fetch(url, 'POST', payload);

    if (!res.id) {
      throw new Error('eSignature リクエスト ID を取得できませんでした。レスポンス: ' + JSON.stringify(res));
    }

    Logger.log('[ESignature] 署名依頼を送信しました。requestId: ' + res.id);
    return res.id;
  },

  /**
   * Get the current status of a signature request.
   * 署名依頼の現在のステータスを取得する。
   *
   * @param {string} requestId - eSignature request ID
   * @param {string} docId - Google Docs file ID (required by the API endpoint)
   * @returns {{status: string, signedPdfId: string|null, signers: Array}} Parsed status
   */
  getStatus(requestId, docId) {
    const url = ESignature.BASE_URL + '/files/' + docId + '/signatureRequests/' + requestId;
    const res = ESignature._fetch(url, 'GET', null);

    return {
      status: ESignature._mapApiState(res.state, res.signers || []),
      signedPdfId: res.signedDocumentFileId || null,
      signers: (res.signers || []).map(function(s) {
        return { email: s.email, state: s.state, signingOrder: s.signingOrder };
      }),
      rawState: res.state
    };
  },

  /**
   * Cancel a signature request.
   * 署名依頼をキャンセルする。
   *
   * @param {string} requestId - eSignature request ID
   * @param {string} docId - Google Docs file ID
   */
  cancelRequest(requestId, docId) {
    const url = ESignature.BASE_URL + '/files/' + docId + '/signatureRequests/' + requestId + '/cancel';
    ESignature._fetch(url, 'POST', {});
    Logger.log('[ESignature] 署名依頼をキャンセルしました。requestId: ' + requestId);
  },

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Map the API's state string (and per-signer states) to our internal status enum.
   * API の state 文字列を内部ステータス enum にマップする。
   *
   * @param {string} apiState - e.g. 'IN_PROGRESS', 'COMPLETED', 'DECLINED', 'CANCELED'
   * @param {Array} signers - Per-signer state objects
   * @returns {string} Our status enum value
   */
  _mapApiState(apiState, signers) {
    switch (apiState) {
      case 'COMPLETED':
        return 'signed';
      case 'DECLINED':
      case 'CANCELED':
        return 'rejected';
      case 'IN_PROGRESS': {
        // Check if the first signer (internal) has already signed
        const firstSigner = signers.find(function(s) { return s.signingOrder === 1; });
        if (firstSigner && firstSigner.state === 'SIGNED') {
          return 'external_signing';
        }
        return 'internal_signing';
      }
      default:
        return 'internal_signing'; // PENDING or unknown → treat as internal_signing
    }
  },

  /**
   * Build the default email message body for a signature request.
   * 署名依頼メールのデフォルト本文を生成する。
   *
   * @param {Object} contract
   * @returns {string}
   */
  _buildEmailMessage(contract) {
    const companyName = Config.getGeneral('our_company_name') || '';
    return '「' + contract.title + '」の署名をお願いいたします。\n\n' +
           '送信者: ' + companyName + '\n' +
           '契約 ID: ' + contract.id;
  },

  /**
   * Execute an authenticated HTTP request against the Drive API.
   * Drive API への認証済み HTTP リクエストを実行する。
   *
   * @param {string} url - Full request URL
   * @param {string} method - 'GET' | 'POST' | 'DELETE'
   * @param {Object|null} body - Request body (JSON-serialized if not null)
   * @returns {Object} Parsed JSON response
   * @throws {Error} If the HTTP status is not 2xx
   */
  _fetch(url, method, body) {
    const options = {
      method: method,
      headers: {
        'Authorization': 'Bearer ' + ScriptApp.getOAuthToken(),
        'Content-Type': 'application/json'
      },
      muteHttpExceptions: true
    };
    if (body !== null) {
      options.payload = JSON.stringify(body);
    }

    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    const text = response.getContentText();

    if (code < 200 || code >= 300) {
      Logger.log('[ESignature] API エラー ' + code + ': ' + text);
      throw new Error('eSignature API エラー (' + code + '): ' + text);
    }

    return text ? JSON.parse(text) : {};
  }
};
