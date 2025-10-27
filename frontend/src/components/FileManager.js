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
import authService from '../services/authService';
import ThemeToggle from './ThemeToggle';

const FileManager = ({ user, onLogout }) => {
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
  const [viewMode, setViewMode] = useState('list');
  const fileInputRef = useRef(null);

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

  const navigateToFolder = (folder) => {
    setCurrentFolder(folder.id);
    setPath([...path, folder]);
  };

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

  const handleDownload = async (resource) => {
    try {
      await downloadFile(resource.id, resource.name);
    } catch (err) {
      setError('Failed to download file');
      console.error(err);
    }
  };

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

  const openShareDialog = (resource) => {
    setSelectedResource(resource);
    setShowShareDialog(true);
    setShareUserId('');
    setSharePermission('viewer');
  };

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

  const openRenameDialog = (resource) => {
    setSelectedResource(resource);
    setNewName(resource.name);
    setShowRenameDialog(true);
  };

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

  const handleLogout = async () => {
    await authService.logout();
    onLogout();
  };

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

  const getFileIcon = (resource) => {
    if (resource.type === 'folder') {
      return (
        <svg className="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
      );
    }
    return (
      <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
      </svg>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-light-bg dark:bg-dark-bg">
      <nav className="bg-light-surface dark:bg-dark-surface border-b border-light-border dark:border-dark-border">
        <div className="px-4 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-semibold text-light-text dark:text-dark-text">Cygnus Files</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-light-bg dark:bg-dark-bg">
              <div className="w-7 h-7 bg-gradient-to-br from-light-primary to-light-primary-hover dark:from-dark-primary dark:to-dark-primary-hover rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-sm font-medium text-light-text dark:text-dark-text">{user.username}</span>
            </div>
            
            <ThemeToggle />
            
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-48 bg-light-surface dark:bg-dark-surface border-r border-light-border dark:border-dark-border flex flex-col">
          <div className="p-3">
            <h2 className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-2">Quick Access</h2>
            <div className="space-y-1">
              <button
                onClick={() => navigateToPath(-1)}
                className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  currentFolder === null
                    ? 'bg-light-primary/10 dark:bg-dark-primary/10 text-light-primary dark:text-dark-primary'
                    : 'text-light-text dark:text-dark-text hover:bg-light-bg dark:hover:bg-dark-bg'
                }`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
                <span>All Files</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="bg-light-surface dark:bg-dark-surface border-b border-light-border dark:border-dark-border px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1 text-sm">
                <button onClick={() => navigateToPath(-1)} className="px-2 py-1 rounded hover:bg-light-bg dark:hover:bg-dark-bg text-light-text dark:text-dark-text">
                  All Files
                </button>
                {path.map((folder, index) => (
                  <React.Fragment key={folder.id}>
                    <svg className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    <button onClick={() => navigateToPath(index)} className="px-2 py-1 rounded hover:bg-light-bg dark:hover:bg-dark-bg text-light-text dark:text-dark-text">
                      {folder.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>

              <div className="flex items-center space-x-2">
                <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-light-primary/10 dark:bg-dark-primary/10 text-light-primary dark:text-dark-primary' : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg'}`}>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button onClick={() => setViewMode('list')} className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-light-primary/10 dark:bg-dark-primary/10 text-light-primary dark:text-dark-primary' : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg'}`}>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-light-surface dark:bg-dark-surface border-b border-light-border dark:border-dark-border px-4 py-2 flex items-center space-x-2">
            <button onClick={() => setShowCreateFolder(true)} className="flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium text-light-text dark:text-dark-text bg-light-bg dark:bg-dark-bg hover:bg-light-border dark:hover:bg-dark-border rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              </svg>
              <span>New Folder</span>
            </button>
            <button onClick={() => fileInputRef.current.click()} className="flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium text-white bg-light-primary dark:bg-dark-primary hover:bg-light-primary-hover dark:hover:bg-dark-primary-hover rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              <span>Upload</span>
            </button>
            <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" />
            <button onClick={loadResources} className="p-1.5 text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
              </div>
              <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 dark:hover:text-red-300">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}

          <div className="flex-1 overflow-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex items-center space-x-2 text-light-text-secondary dark:text-dark-text-secondary">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Loading...</span>
                </div>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {resources.map((resource) => (
                  <div
                    key={resource.id}
                    className="group relative p-3 rounded-lg hover:bg-light-surface dark:hover:bg-dark-surface border border-transparent hover:border-light-border dark:hover:border-dark-border transition-all cursor-pointer"
                    onDoubleClick={() => resource.type === 'folder' && navigateToFolder(resource)}
                  >
                    <div className="flex flex-col items-center">
                      {getFileIcon(resource)}
                      <p className="mt-2 text-sm text-center text-light-text dark:text-dark-text truncate w-full">{resource.name}</p>
                      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                        {resource.type === 'file' ? formatFileSize(resource.file_size) : 'Folder'}
                      </p>
                    </div>
                  </div>
                ))}
                {resources.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center py-16 text-light-text-secondary dark:text-dark-text-secondary">
                    <svg className="w-16 h-16 mb-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1H8a3 3 0 00-3 3v1.5a1.5 1.5 0 01-3 0V6z" clipRule="evenodd" />
                      <path d="M6 12a2 2 0 012-2h8a2 2 0 012 2v2a2 2 0 01-2 2H2h2a2 2 0 002-2v-2z" />
                    </svg>
                    <p className="text-lg font-medium">This folder is empty</p>
                    <p className="text-sm">Upload files or create folders to get started</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-light-surface dark:bg-dark-surface rounded-lg border border-light-border dark:border-dark-border overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-light-border dark:border-dark-border">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Owner</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Size</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Modified</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resources.map((resource) => (
                      <tr
                        key={resource.id}
                        className="border-b border-light-border dark:border-dark-border hover:bg-light-bg dark:hover:bg-dark-bg cursor-pointer"
                        onDoubleClick={() => resource.type === 'folder' && navigateToFolder(resource)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0">
                              {resource.type === 'folder' ? (
                                <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                                </svg>
                              ) : (
                                <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <span className="text-sm text-light-text dark:text-dark-text">{resource.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-light-text dark:text-dark-text">{resource.owner}</td>
                        <td className="px-4 py-3 text-sm text-light-text dark:text-dark-text">
                          {resource.type === 'file' ? formatFileSize(resource.file_size) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-light-text dark:text-dark-text">
                          {new Date(resource.updated_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex space-x-2">
                            {resource.type === 'file' && (
                              <button onClick={() => handleDownload(resource)} className="text-blue-600 dark:text-blue-400 hover:underline text-sm">Download</button>
                            )}
                            <button onClick={() => openRenameDialog(resource)} className="text-yellow-600 dark:text-yellow-400 hover:underline text-sm">Rename</button>
                            <button onClick={() => openShareDialog(resource)} className="text-green-600 dark:text-green-400 hover:underline text-sm">Share</button>
                            <button onClick={() => openPermissions(resource)} className="text-purple-600 dark:text-purple-400 hover:underline text-sm">Permissions</button>
                            <button onClick={() => handleDelete(resource)} className="text-red-600 dark:text-red-400 hover:underline text-sm">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {resources.length === 0 && (
                      <tr>
                        <td colSpan="5" className="px-4 py-8 text-center text-light-text-secondary dark:text-dark-text-secondary">
                          This folder is empty
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreateFolder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-xl max-w-md w-full mx-4 border border-light-border dark:border-dark-border">
            <h2 className="text-xl font-bold mb-4 text-light-text dark:text-dark-text">Create New Folder</h2>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="w-full p-2 border border-light-border dark:border-dark-border rounded mb-4 bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text"
              onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowCreateFolder(false)}
                className="px-4 py-2 bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text rounded hover:bg-light-border dark:hover:bg-dark-border"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                className="px-4 py-2 bg-light-primary dark:bg-dark-primary text-white rounded hover:bg-light-primary-hover dark:hover:bg-dark-primary-hover"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {showShareDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-xl max-w-md w-full mx-4 border border-light-border dark:border-dark-border">
            <h2 className="text-xl font-bold mb-4 text-light-text dark:text-dark-text">
              Share "{selectedResource?.name}"
            </h2>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-light-text dark:text-dark-text">
                User ID
              </label>
              <input
                type="number"
                value={shareUserId}
                onChange={(e) => setShareUserId(e.target.value)}
                placeholder="Enter user ID"
                className="w-full p-2 border border-light-border dark:border-dark-border rounded bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-light-text dark:text-dark-text">
                Permission Level
              </label>
              <select
                value={sharePermission}
                onChange={(e) => setSharePermission(e.target.value)}
                className="w-full p-2 border border-light-border dark:border-dark-border rounded bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text"
              >
                <option value="viewer">Viewer (Read only)</option>
                <option value="editor">Editor (Read & Write)</option>
                <option value="owner">Owner (Full control)</option>
              </select>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowShareDialog(false)}
                className="px-4 py-2 bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text rounded hover:bg-light-border dark:hover:bg-dark-border"
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

      {showPermissions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-xl max-w-2xl w-full mx-4 border border-light-border dark:border-dark-border">
            <h2 className="text-xl font-bold mb-4 text-light-text dark:text-dark-text">
              Permissions for "{selectedResource?.name}"
            </h2>
            <table className="min-w-full mb-4">
              <thead>
                <tr className="border-b border-light-border dark:border-dark-border">
                  <th className="px-4 py-2 text-left text-light-text dark:text-dark-text">User</th>
                  <th className="px-4 py-2 text-left text-light-text dark:text-dark-text">Permission</th>
                  <th className="px-4 py-2 text-left text-light-text dark:text-dark-text">Actions</th>
                </tr>
              </thead>
              <tbody>
                {permissions.map((perm) => (
                  <tr key={perm.id} className="border-b border-light-border dark:border-dark-border">
                    <td className="px-4 py-2 text-light-text dark:text-dark-text">{perm.username}</td>
                    <td className="px-4 py-2 text-light-text dark:text-dark-text capitalize">{perm.permission_level}</td>
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
                className="px-4 py-2 bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text rounded hover:bg-light-border dark:hover:bg-dark-border"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showRenameDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-xl max-w-md w-full mx-4 border border-light-border dark:border-dark-border">
            <h2 className="text-xl font-bold mb-4 text-light-text dark:text-dark-text">
              Rename "{selectedResource?.name}"
            </h2>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New name"
              className="w-full p-2 border border-light-border dark:border-dark-border rounded mb-4 bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text"
              onKeyPress={(e) => e.key === 'Enter' && handleRename()}
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowRenameDialog(false)}
                className="px-4 py-2 bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text rounded hover:bg-light-border dark:hover:bg-dark-border"
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                className="px-4 py-2 bg-light-primary dark:bg-dark-primary text-white rounded hover:bg-light-primary-hover dark:hover:bg-dark-primary-hover"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileManager;
