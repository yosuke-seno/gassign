/**
 * DriveHelper.gs
 * Google Drive operations wrapper.
 * Google Drive 操作のラッパ。
 */

const DriveHelper = {
  /**
   * Create a new folder inside a parent folder.
   * 親フォルダ内に新しいフォルダを作成する。
   *
   * @param {string} name - Folder name
   * @param {string} parentFolderId - Parent folder ID
   * @returns {string} New folder ID
   */
  createFolder(name, parentFolderId) {
    const parent = DriveApp.getFolderById(parentFolderId);
    const folder = parent.createFolder(name);
    return folder.getId();
  },

  /**
   * Get an existing folder by name, or create it if not found.
   * 既存フォルダを名前で取得し、なければ作成する。
   *
   * @param {string} name - Folder name
   * @param {string} parentFolderId - Parent folder ID
   * @returns {string} Folder ID
   */
  getOrCreateFolder(name, parentFolderId) {
    const parent = DriveApp.getFolderById(parentFolderId);
    const iter = parent.getFoldersByName(name);
    if (iter.hasNext()) {
      return iter.next().getId();
    }
    return DriveHelper.createFolder(name, parentFolderId);
  },

  /**
   * Copy a file into a folder with a new name.
   * ファイルを指定フォルダにコピーする。
   *
   * @param {string} fileId - Source file ID
   * @param {string} newName - Name for the copy
   * @param {string} parentFolderId - Destination folder ID
   * @returns {string} New file ID
   */
  copyFile(fileId, newName, parentFolderId) {
    const file = DriveApp.getFileById(fileId);
    const parent = DriveApp.getFolderById(parentFolderId);
    const copy = file.makeCopy(newName, parent);
    return copy.getId();
  },

  /**
   * Move a file to a new parent folder.
   * ファイルを新しい親フォルダに移動する。
   *
   * @param {string} fileId - File ID to move
   * @param {string} newParentFolderId - Destination folder ID
   */
  moveFile(fileId, newParentFolderId) {
    const file = DriveApp.getFileById(fileId);
    const newParent = DriveApp.getFolderById(newParentFolderId);
    file.moveTo(newParent);
  },

  /**
   * Create a new Google Spreadsheet in a specific folder.
   * 指定フォルダ内に Google スプレッドシートを作成する。
   *
   * @param {string} name - Spreadsheet name
   * @param {string} parentFolderId - Parent folder ID
   * @returns {string} Spreadsheet ID
   */
  createSpreadsheet(name, parentFolderId) {
    const ss = SpreadsheetApp.create(name);
    const ssFile = DriveApp.getFileById(ss.getId());
    const parent = DriveApp.getFolderById(parentFolderId);
    ssFile.moveTo(parent);
    return ss.getId();
  },

  /**
   * Create a new Google Docs document in a specific folder.
   * 指定フォルダ内に Google Docs ドキュメントを作成する。
   *
   * @param {string} name - Document name
   * @param {string} parentFolderId - Parent folder ID
   * @returns {string} Document ID
   */
  createDocument(name, parentFolderId) {
    const doc = DocumentApp.create(name);
    const docFile = DriveApp.getFileById(doc.getId());
    const parent = DriveApp.getFolderById(parentFolderId);
    docFile.moveTo(parent);
    return doc.getId();
  },

  /**
   * Get a folder URL from its ID.
   * フォルダ ID から URL を取得する。
   *
   * @param {string} folderId - Folder ID
   * @returns {string} Folder URL
   */
  getFolderUrl(folderId) {
    return 'https://drive.google.com/drive/folders/' + folderId;
  }
};
