import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  listResources,
  createFolder,
  uploadFile,
  downloadFile,
  deleteResource,
  shareResource,
  getPermissions,
  removePermission,
  updateResource
} from '../services/fileService';

/**
 * FileManager component for managing files and folders.
 * 
 * @returns {JSX.Element} FileManager component.
 */
const FileManager = () => {
  const [resources, setResources] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [path, setPath] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedResource, setSelectedResource] = useState(null);
  const [shareUserId, setShareUserId] = useState('');
  const [sharePermission, setSharePermission] = useState('viewer');
  const [permissions, setPermissions] = useState([]);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const fileInputRef = useRef(null);

  /**
   * Load resources from the current folder.
   */
  const loadResources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listResources(currentFolder);
      if (response.resources) {
        setResources(response.resources);
      } else if (response.message) {
        setError(response.message);
      }
    } catch (err) {
      setError('Failed to load resources');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [currentFolder]);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  /**
   * Navigate to a folder.
   * 
   * @param {Object} folder - Folder resource to navigate to.
   */
  const navigateToFolder = (folder) => {
    setCurrentFolder(folder.id);
    setPath([...path, folder]);
  };

  /**
   * Navigate to a specific path index.
   * 
   * @param {number} index - Path index to navigate to (-1 for root).
   */
  const navigateToPath = (index) => {
    if (index === -1) {
      setCurrentFolder(null);
      setPath([]);
    } else {
      const newPath = path.slice(0, index + 1);
      setCurrentFolder(newPath[newPath.length - 1].id);
      setPath(newPath);
    }
  };

  /**
   * Handle folder creation.
   */
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      setError('Folder name is required');
      return;
    }

    try {
      const response = await createFolder(newFolderName, currentFolder);
      if (response.folder) {
        setShowCreateFolder(false);
        setNewFolderName('');
        loadResources();
      } else if (response.message) {
        setError(response.message);
      }
    } catch (err) {
      setError('Failed to create folder');
      console.error(err);
    }
  };

  /**
   * Handle file upload.
   * 
   * @param {Event} e - File input change event.
   */
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    try {
      const response = await uploadFile(file, currentFolder);
      if (response.file) {
        loadResources();
      } else if (response.message) {
        setError(response.message);
      }
    } catch (err) {
      setError('Failed to upload file');
      console.error(err);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  /**
   * Handle file download.
   * 
   * @param {Object} resource - Resource to download.
   */
  const handleDownload = async (resource) => {
    try {
      await downloadFile(resource.id, resource.name);
    } catch (err) {
      setError('Failed to download file');
      console.error(err);
    }
  };

  /**
   * Handle resource deletion.
   * 
   * @param {Object} resource - Resource to delete.
   */
  const handleDelete = async (resource) => {
    if (!window.confirm(`Are you sure you want to delete "${resource.name}"?`)) {
      return;
    }

    try {
      const response = await deleteResource(resource.id);
      if (response.message && !response.message.includes('Error')) {
        loadResources();
      } else {
        setError(response.message || 'Failed to delete resource');
      }
    } catch (err) {
      setError('Failed to delete resource');
      console.error(err);
    }
  };

  /**
   * Open share dialog for a resource.
   * 
   * @param {Object} resource - Resource to share.
   */
  const openShareDialog = (resource) => {
    setSelectedResource(resource);
    setShowShareDialog(true);
    setShareUserId('');
    setSharePermission('viewer');
  };

  /**
   * Handle resource sharing.
   */
  const handleShare = async () => {
    if (!shareUserId) {
      setError('User ID is required');
      return;
    }

    try {
      const response = await shareResource(
        selectedResource.id,
        parseInt(shareUserId),
        sharePermission
      );
      if (response.message && !response.message.includes('Error')) {
        setShowShareDialog(false);
        setError(null);
        alert(response.message);
      } else {
        setError(response.message || 'Failed to share resource');
      }
    } catch (err) {
      setError('Failed to share resource');
      console.error(err);
    }
  };

  /**
   * Open permissions dialog for a resource.
   * 
   * @param {Object} resource - Resource to view permissions for.
   */
  const openPermissions = async (resource) => {
    setSelectedResource(resource);
    setShowPermissions(true);
    try {
      const response = await getPermissions(resource.id);
      if (response.permissions) {
        setPermissions(response.permissions);
      } else {
        setError(response.message || 'Failed to load permissions');
      }
    } catch (err) {
      setError('Failed to load permissions');
      console.error(err);
    }
  };

  /**
   * Remove a permission.
   * 
   * @param {number} userId - User ID to remove permission from.
   */
  const handleRemovePermission = async (userId) => {
    try {
      const response = await removePermission(selectedResource.id, userId);
      if (response.message && !response.message.includes('Error')) {
        openPermissions(selectedResource);
      } else {
        setError(response.message || 'Failed to remove permission');
      }
    } catch (err) {
      setError('Failed to remove permission');
      console.error(err);
    }
  };

  /**
   * Open rename dialog for a resource.
   * 
   * @param {Object} resource - Resource to rename.
   */
  const openRenameDialog = (resource) => {
    setSelectedResource(resource);
    setNewName(resource.name);
    setShowRenameDialog(true);
  };

  /**
   * Handle resource rename.
   */
  const handleRename = async () => {
    if (!newName.trim()) {
      setError('Name is required');
      return;
    }

    try {
      const response = await updateResource(selectedResource.id, { name: newName });
      if (response.resource) {
        setShowRenameDialog(false);
        loadResources();
      } else {
        setError(response.message || 'Failed to rename resource');
      }
    } catch (err) {
      setError('Failed to rename resource');
      console.error(err);
    }
  };

  /**
   * Format file size for display.
   * 
   * @param {number} bytes - File size in bytes.
   * @returns {string} Formatted file size.
   */
  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  };

  return (
    <div className="container mx-auto p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">File Manager</h1>

        {/* Breadcrumb navigation */}
        <div className="mb-4 flex items-center space-x-2 text-sm">
          <button
            onClick={() => navigateToPath(-1)}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Root
          </button>
          {path.map((folder, index) => (
            <React.Fragment key={folder.id}>
              <span className="text-gray-500 dark:text-gray-400">/</span>
              <button
                onClick={() => navigateToPath(index)}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                {folder.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Action buttons */}
        <div className="mb-4 flex space-x-2">
          <button
            onClick={() => setShowCreateFolder(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            New Folder
          </button>
          <button
            onClick={() => fileInputRef.current.click()}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Upload File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={loadResources}
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
          >
            Refresh
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-100 rounded">
            {error}
            <button onClick={() => setError(null)} className="ml-4 underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Loading indicator */}
        {loading && (
          <div className="mb-4 p-4 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-100 rounded">
            Loading...
          </div>
        )}

        {/* Resources table */}
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white dark:bg-gray-800">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700">
                <th className="px-4 py-2 text-left text-gray-900 dark:text-white">Name</th>
                <th className="px-4 py-2 text-left text-gray-900 dark:text-white">Type</th>
                <th className="px-4 py-2 text-left text-gray-900 dark:text-white">Owner</th>
                <th className="px-4 py-2 text-left text-gray-900 dark:text-white">Size</th>
                <th className="px-4 py-2 text-left text-gray-900 dark:text-white">Modified</th>
                <th className="px-4 py-2 text-left text-gray-900 dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {resources.map((resource) => (
                <tr
                  key={resource.id}
                  className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td className="px-4 py-2">
                    {resource.type === 'folder' ? (
                      <button
                        onClick={() => navigateToFolder(resource)}
                        className="text-blue-600 dark:text-blue-400 hover:underline flex items-center"
                      >
                        <span className="mr-2">📁</span>
                        {resource.name}
                      </button>
                    ) : (
                      <div className="flex items-center text-gray-900 dark:text-white">
                        <span className="mr-2">📄</span>
                        {resource.name}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-900 dark:text-white capitalize">{resource.type}</td>
                  <td className="px-4 py-2 text-gray-900 dark:text-white">{resource.owner}</td>
                  <td className="px-4 py-2 text-gray-900 dark:text-white">
                    {resource.type === 'file' ? formatFileSize(resource.file_size) : '-'}
                  </td>
                  <td className="px-4 py-2 text-gray-900 dark:text-white">
                    {new Date(resource.updated_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex space-x-2">
                      {resource.type === 'file' && (
                        <button
                          onClick={() => handleDownload(resource)}
                          className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                        >
                          Download
                        </button>
                      )}
                      <button
                        onClick={() => openRenameDialog(resource)}
                        className="text-yellow-600 dark:text-yellow-400 hover:underline text-sm"
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => openShareDialog(resource)}
                        className="text-green-600 dark:text-green-400 hover:underline text-sm"
                      >
                        Share
                      </button>
                      <button
                        onClick={() => openPermissions(resource)}
                        className="text-purple-600 dark:text-purple-400 hover:underline text-sm"
                      >
                        Permissions
                      </button>
                      <button
                        onClick={() => handleDelete(resource)}
                        className="text-red-600 dark:text-red-400 hover:underline text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {resources.length === 0 && !loading && (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    No files or folders in this location
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Create folder dialog */}
        {showCreateFolder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
              <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Create New Folder</h2>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                className="w-full p-2 border rounded mb-4 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowCreateFolder(false)}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateFolder}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Share dialog */}
        {showShareDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
              <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
                Share "{selectedResource?.name}"
              </h2>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
                  User ID
                </label>
                <input
                  type="number"
                  value={shareUserId}
                  onChange={(e) => setShareUserId(e.target.value)}
                  placeholder="Enter user ID"
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
                  Permission Level
                </label>
                <select
                  value={sharePermission}
                  onChange={(e) => setSharePermission(e.target.value)}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="viewer">Viewer (Read only)</option>
                  <option value="editor">Editor (Read & Write)</option>
                  <option value="owner">Owner (Full control)</option>
                </select>
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowShareDialog(false)}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleShare}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Share
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Permissions dialog */}
        {showPermissions && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-2xl w-full">
              <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
                Permissions for "{selectedResource?.name}"
              </h2>
              <table className="min-w-full mb-4">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-700">
                    <th className="px-4 py-2 text-left text-gray-900 dark:text-white">User</th>
                    <th className="px-4 py-2 text-left text-gray-900 dark:text-white">Permission</th>
                    <th className="px-4 py-2 text-left text-gray-900 dark:text-white">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {permissions.map((perm) => (
                    <tr key={perm.id} className="border-b dark:border-gray-700">
                      <td className="px-4 py-2 text-gray-900 dark:text-white">{perm.username}</td>
                      <td className="px-4 py-2 text-gray-900 dark:text-white capitalize">{perm.permission_level}</td>
                      <td className="px-4 py-2">
                        {perm.permission_level !== 'owner' && (
                          <button
                            onClick={() => handleRemovePermission(perm.user_id)}
                            className="text-red-600 dark:text-red-400 hover:underline text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end">
                <button
                  onClick={() => setShowPermissions(false)}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rename dialog */}
        {showRenameDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
              <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
                Rename "{selectedResource?.name}"
              </h2>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New name"
                className="w-full p-2 border rounded mb-4 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowRenameDialog(false)}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRename}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Rename
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileManager;
