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
 * List resources in a folder.
 *
 * @param {number|null} parentId - Parent folder ID (null for root).
 * @returns {Promise<Object>} Response with resources list.
 */
export const listResources = async (parentId = null) => {
  const url = parentId
    ? `${API_URL}/api/files/list?parent_id=${parentId}`
    : `${API_URL}/api/files/list`;

  const response = await fetch(url, {
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
 * @param {number} resourceId - Resource ID.
 * @param {string} fileName - File name for download.
 * @returns {Promise<void>}
 */
export const downloadFile = async (resourceId, fileName) => {
  const response = await fetch(`${API_URL}/api/files/download/${resourceId}`, {
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
 * Get resource details.
 *
 * @param {number} resourceId - Resource ID.
 * @returns {Promise<Object>} Response with resource data.
 */
export const getResource = async (resourceId) => {
  const response = await fetch(`${API_URL}/api/files/${resourceId}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  return response.json();
};

/**
 * Update resource (rename/move).
 *
 * @param {number} resourceId - Resource ID.
 * @param {Object} data - Update data (name, parent_id).
 * @returns {Promise<Object>} Response with updated resource data.
 */
export const updateResource = async (resourceId, data) => {
  const response = await fetch(`${API_URL}/api/files/${resourceId}`, {
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
 * Delete a resource.
 *
 * @param {number} resourceId - Resource ID.
 * @returns {Promise<Object>} Response with success message.
 */
export const deleteResource = async (resourceId) => {
  const response = await fetch(`${API_URL}/api/files/${resourceId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  return response.json();
};

/**
 * Share a resource with another user.
 *
 * @param {number} resourceId - Resource ID.
 * @param {number} userId - User ID to share with.
 * @param {string} permissionLevel - Permission level (owner, editor, viewer).
 * @returns {Promise<Object>} Response with success message.
 */
export const shareResource = async (resourceId, userId, permissionLevel) => {
  const response = await fetch(`${API_URL}/api/files/${resourceId}/share`, {
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
 * Get permissions for a resource.
 *
 * @param {number} resourceId - Resource ID.
 * @returns {Promise<Object>} Response with permissions list.
 */
export const getPermissions = async (resourceId) => {
  const response = await fetch(`${API_URL}/api/files/${resourceId}/share`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  return response.json();
};

/**
 * Remove a user's permission.
 *
 * @param {number} resourceId - Resource ID.
 * @param {number} userId - User ID to remove permission from.
 * @returns {Promise<Object>} Response with success message.
 */
export const removePermission = async (resourceId, userId) => {
  const response = await fetch(
    `${API_URL}/api/files/${resourceId}/share/${userId}`,
    {
      method: "DELETE",
      headers: getAuthHeaders(),
    }
  );

  return response.json();
};
