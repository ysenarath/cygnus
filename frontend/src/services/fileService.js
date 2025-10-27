/**
 * File management service for API calls.
 *
 * This module provides functions to interact with the file management API.
 */

import config from "../config/config";

const API_URL = config.backendUrl;

/**
 * Get authentication headers with JWT token.
 * 
 * @returns {Object} Headers object with authorization token.
 */
const getAuthHeaders = () => {
  const token = sessionStorage.getItem('access_token');
  return {
    'Authorization': `Bearer ${token}`
  };
};

/**
 * List nodes in a folder with pagination support.
 *
 * @param {number|null} parentId - Parent folder ID (null for root).
 * @param {number} page - Page number (default: 1).
 * @param {number} pageSize - Number of items per page (default: 50).
 * @returns {Promise<Object>} Response with nodes list and pagination metadata.
 */
export const listNodes = async (parentId = null, page = 1, pageSize = 50) => {
  const params = new URLSearchParams();
  if (parentId) {
    params.append('parent_id', parentId);
  }
  params.append('page', page);
  params.append('page_size', pageSize);

  const response = await fetch(`${API_URL}/api/files/list?${params}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  return response.json();
};

/**
 * Create a new folder.
 *
 * @param {string} name - Folder name.
 * @param {number|null} parentId - Parent folder ID.
 * @returns {Promise<Object>} Response with created folder data.
 */
export const createFolder = async (name, parentId = null) => {
  const response = await fetch(`${API_URL}/api/files/folders`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, parent_id: parentId }),
  });

  return response.json();
};

/**
 * Upload a file.
 *
 * @param {File} file - File to upload.
 * @param {number|null} parentId - Parent folder ID.
 * @returns {Promise<Object>} Response with uploaded file data.
 */
export const uploadFile = async (file, parentId = null) => {
  const formData = new FormData();
  formData.append("file", file);
  if (parentId) {
    formData.append("parent_id", parentId);
  }

  const response = await fetch(`${API_URL}/api/files/upload`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });

  return response.json();
};

/**
 * Download a file.
 *
 * @param {number} nodeId - Node ID.
 * @param {string} fileName - File name for download.
 * @returns {Promise<void>}
 */
export const downloadFile = async (nodeId, fileName) => {
  const response = await fetch(`${API_URL}/api/files/download/${nodeId}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  if (response.ok) {
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } else {
    throw new Error("Failed to download file");
  }
};

/**
 * Get node details.
 *
 * @param {number} nodeId - Node ID.
 * @returns {Promise<Object>} Response with node data.
 */
export const getNode = async (nodeId) => {
  const response = await fetch(`${API_URL}/api/files/${nodeId}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  return response.json();
};

/**
 * Update node (rename/move).
 *
 * @param {number} nodeId - Node ID.
 * @param {Object} data - Update data (name, parent_id).
 * @returns {Promise<Object>} Response with updated node data.
 */
export const updateNode = async (nodeId, data) => {
  const response = await fetch(`${API_URL}/api/files/${nodeId}`, {
    method: "PUT",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  return response.json();
};

/**
 * Delete a node.
 *
 * @param {number} nodeId - Node ID.
 * @returns {Promise<Object>} Response with success message.
 */
export const deleteNode = async (nodeId) => {
  const response = await fetch(`${API_URL}/api/files/${nodeId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  return response.json();
};

/**
 * Share a node with another user.
 *
 * @param {number} nodeId - Node ID.
 * @param {number} userId - User ID to share with.
 * @param {string} permissionLevel - Permission level (owner, editor, viewer).
 * @returns {Promise<Object>} Response with success message.
 */
export const shareNode = async (nodeId, userId, permissionLevel) => {
  const response = await fetch(`${API_URL}/api/files/${nodeId}/share`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: userId,
      permission_level: permissionLevel,
    }),
  });

  return response.json();
};

/**
 * Get permissions for a node.
 *
 * @param {number} nodeId - Node ID.
 * @returns {Promise<Object>} Response with permissions list.
 */
export const getPermissions = async (nodeId) => {
  const response = await fetch(`${API_URL}/api/files/${nodeId}/share`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  return response.json();
};

/**
 * Remove a user's permission.
 *
 * @param {number} nodeId - Node ID.
 * @param {number} userId - User ID to remove permission from.
 * @returns {Promise<Object>} Response with success message.
 */
export const removePermission = async (nodeId, userId) => {
  const response = await fetch(
    `${API_URL}/api/files/${nodeId}/share/${userId}`,
    {
      method: "DELETE",
      headers: getAuthHeaders(),
    }
  );

  return response.json();
};
