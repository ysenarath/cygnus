import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  listNodes,
  createFolder,
  uploadFile,
  downloadFile,
  deleteNode,
  shareNode,
  getPermissions,
  removePermission,
  updateNode,
} from "../services/fileService";
import authService from "../services/authService";
import ThemeToggle from "./ThemeToggle";

const FileManager = ({ user, onLogout }) => {
  const [nodes, setNodes] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(() => {
    const saved = localStorage.getItem("currentFolder");
    return saved ? JSON.parse(saved) : null;
  });
  const [path, setPath] = useState(() => {
    const saved = localStorage.getItem("folderPath");
    return saved ? JSON.parse(saved) : [];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: 50,
    total: 0,
    total_pages: 1,
    has_next: false,
    has_prev: false
  });
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedNode, setSelectedNode] = useState(null);
  const [shareUserId, setShareUserId] = useState("");
  const [sharePermission, setSharePermission] = useState("viewer");
  const [permissions, setPermissions] = useState([]);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [moveFolders, setMoveFolders] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [moveCurrentFolder, setMoveCurrentFolder] = useState(null);
  const [movePath, setMovePath] = useState([]);
  const [viewMode, setViewMode] = useState("list");
  const [selectedNodes, setSelectedNodes] = useState([]);
  const fileInputRef = useRef(null);

  const loadNodes = useCallback(async (page = currentPage) => {
    setLoading(true);
    setError(null);
    try {
      const response = await listNodes(currentFolder, page, pageSize);
      if (response.nodes && response.pagination) {
        setNodes(response.nodes);
        setPagination(response.pagination);
        setCurrentPage(response.pagination.page);
      } else if (response.message) {
        setError(response.message);
      }
    } catch (err) {
      setError("Failed to load nodes");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [currentFolder, currentPage, pageSize]);

  useEffect(() => {
    loadNodes(1);
    setCurrentPage(1);
  }, [currentFolder, pageSize]);

  useEffect(() => {
    loadNodes(currentPage);
  }, [currentPage]);

  const navigateToFolder = (folder) => {
    const newPath = [...path, folder];
    setCurrentFolder(folder.id);
    setPath(newPath);
    setSelectedNodes([]);
    localStorage.setItem("currentFolder", JSON.stringify(folder.id));
    localStorage.setItem("folderPath", JSON.stringify(newPath));
  };

  const navigateToPath = (index) => {
    if (index === -1) {
      setCurrentFolder(null);
      setPath([]);
      setSelectedNodes([]);
      localStorage.removeItem("currentFolder");
      localStorage.removeItem("folderPath");
    } else {
      const newPath = path.slice(0, index + 1);
      const folderId = newPath[newPath.length - 1].id;
      setCurrentFolder(folderId);
      setPath(newPath);
      setSelectedNodes([]);
      localStorage.setItem("currentFolder", JSON.stringify(folderId));
      localStorage.setItem("folderPath", JSON.stringify(newPath));
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      setError("Folder name is required");
      return;
    }

    try {
      const response = await createFolder(newFolderName, currentFolder);
      if (response.folder) {
        setShowCreateFolder(false);
        setNewFolderName("");
        loadNodes();
      } else if (response.message) {
        setError(response.message);
      }
    } catch (err) {
      setError("Failed to create folder");
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
        loadNodes();
      } else if (response.message) {
        setError(response.message);
      }
    } catch (err) {
      setError("Failed to upload file");
      console.error(err);
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  const handleDownload = async (node) => {
    try {
      await downloadFile(node.id, node.name);
    } catch (err) {
      setError("Failed to download file");
      console.error(err);
    }
  };

  const handleDelete = async (node) => {
    if (!window.confirm(`Are you sure you want to delete "${node.name}"?`)) {
      return;
    }

    try {
      const response = await deleteNode(node.id);
      if (response.message && !response.message.includes("Error")) {
        loadNodes();
      } else {
        setError(response.message || "Failed to delete node");
      }
    } catch (err) {
      setError("Failed to delete node");
      console.error(err);
    }
  };

  const openShareDialog = (node) => {
    setSelectedNode(node);
    setShowShareDialog(true);
    setShareUserId("");
    setSharePermission("viewer");
  };

  const handleShare = async () => {
    if (!shareUserId) {
      setError("User ID is required");
      return;
    }

    try {
      const response = await shareNode(
        selectedNode.id,
        parseInt(shareUserId),
        sharePermission
      );
      if (response.message && !response.message.includes("Error")) {
        setShowShareDialog(false);
        setError(null);
        alert(response.message);
      } else {
        setError(response.message || "Failed to share node");
      }
    } catch (err) {
      setError("Failed to share node");
      console.error(err);
    }
  };

  const openPermissions = async (node) => {
    setSelectedNode(node);
    setShowPermissions(true);
    try {
      const response = await getPermissions(node.id);
      if (response.permissions) {
        setPermissions(response.permissions);
      } else {
        setError(response.message || "Failed to load permissions");
      }
    } catch (err) {
      setError("Failed to load permissions");
      console.error(err);
    }
  };

  const handleRemovePermission = async (userId) => {
    try {
      const response = await removePermission(selectedNode.id, userId);
      if (response.message && !response.message.includes("Error")) {
        openPermissions(selectedNode);
      } else {
        setError(response.message || "Failed to remove permission");
      }
    } catch (err) {
      setError("Failed to remove permission");
      console.error(err);
    }
  };

  const openRenameDialog = (node) => {
    setSelectedNode(node);
    setNewName(node.name);
    setShowRenameDialog(true);
  };

  const loadMoveFolders = async (folderId, selectedNodeId) => {
    try {
      const response = await listNodes(folderId);
      if (response.nodes) {
        // Filter to only show folders and exclude the selected node
        const folders = response.nodes.filter(
          (n) => n.type === "folder" && n.id !== selectedNodeId
        );
        setMoveFolders(folders);
      }
    } catch (err) {
      setError("Failed to load folders");
      console.error(err);
    }
  };

  const openMoveDialog = async (node) => {
    setSelectedNode(node);
    setSelectedDestination(null);
    setMoveCurrentFolder(null);
    setMovePath([]);
    setShowMoveDialog(true);

    // Load root folders for move destination
    await loadMoveFolders(null, node.id);
  };

  const navigateToMoveFolder = async (folder) => {
    setMoveCurrentFolder(folder.id);
    setMovePath([...movePath, folder]);
    await loadMoveFolders(folder.id, selectedNode?.id || null);
  };

  const navigateToMovePath = async (index) => {
    if (index === -1) {
      setMoveCurrentFolder(null);
      setMovePath([]);
      await loadMoveFolders(null, selectedNode?.id || null);
    } else {
      const newPath = movePath.slice(0, index + 1);
      const folderId = newPath[newPath.length - 1].id;
      setMoveCurrentFolder(folderId);
      setMovePath(newPath);
      await loadMoveFolders(folderId, selectedNode?.id || null);
    }
  };

  const handleMove = async () => {
    try {
      // Use moveCurrentFolder if "Select Current Folder" was chosen, otherwise use selectedDestination
      const destinationId =
        selectedDestination === "current"
          ? moveCurrentFolder
          : selectedDestination;
      
      // If moving from bulk selection, move all selected items
      if (selectedNodes.length > 0) {
        for (const nodeId of selectedNodes) {
          try {
            await updateNode(nodeId, {
              parent_id: destinationId,
            });
          } catch (err) {
            console.error(`Failed to move node ${nodeId}:`, err);
          }
        }
        setShowMoveDialog(false);
        clearSelection();
        loadNodes();
      } else {
        // Single item move from row action
        const response = await updateNode(selectedNode.id, {
          parent_id: destinationId,
        });
        if (response.node) {
          setShowMoveDialog(false);
          loadNodes();
        } else {
          setError(response.message || "Failed to move item");
        }
      }
    } catch (err) {
      setError("Failed to move item");
      console.error(err);
    }
  };

  const handleRename = async () => {
    if (!newName.trim()) {
      setError("Name is required");
      return;
    }

    try {
      const response = await updateNode(selectedNode.id, { name: newName });
      if (response.node) {
        setShowRenameDialog(false);
        loadNodes();
      } else {
        setError(response.message || "Failed to rename node");
      }
    } catch (err) {
      setError("Failed to rename node");
      console.error(err);
    }
  };

  const toggleNodeSelection = (nodeId) => {
    setSelectedNodes((prev) =>
      prev.includes(nodeId)
        ? prev.filter((id) => id !== nodeId)
        : [...prev, nodeId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedNodes.length === nodes.length) {
      setSelectedNodes([]);
    } else {
      setSelectedNodes(nodes.map((node) => node.id));
    }
  };

  const clearSelection = () => {
    setSelectedNodes([]);
  };

  const handleBulkDownload = async () => {
    const selectedFiles = nodes.filter(
      (node) => selectedNodes.includes(node.id) && node.type === "file"
    );
    for (const file of selectedFiles) {
      try {
        await handleDownload(file);
      } catch (err) {
        console.error(`Failed to download ${file.name}:`, err);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (
      !window.confirm(
        `Are you sure you want to delete ${selectedNodes.length} item(s)?`
      )
    ) {
      return;
    }

    for (const nodeId of selectedNodes) {
      const node = nodes.find((n) => n.id === nodeId);
      if (node) {
        try {
          await deleteNode(node.id);
        } catch (err) {
          console.error(`Failed to delete ${node.name}:`, err);
        }
      }
    }
    clearSelection();
    loadNodes();
  };

  const handleBulkShare = () => {
    if (selectedNodes.length === 1) {
      const node = nodes.find((n) => n.id === selectedNodes[0]);
      openShareDialog(node);
    }
  };

  const handleBulkRename = () => {
    if (selectedNodes.length === 1) {
      const node = nodes.find((n) => n.id === selectedNodes[0]);
      openRenameDialog(node);
    }
  };

  const handleBulkMove = async () => {
    if (selectedNodes.length >= 1) {
      // For multiple items, we'll move them all to the same destination
      setSelectedNode(null); // Clear individual selection
      setSelectedDestination(null);
      setMoveCurrentFolder(null);
      setMovePath([]);
      setShowMoveDialog(true);

      // Load root folders for move destination
      // Pass null to not exclude any specific node
      await loadMoveFolders(null, null);
    }
  };

  const handleBulkPermissions = () => {
    if (selectedNodes.length === 1) {
      const node = nodes.find((n) => n.id === selectedNodes[0]);
      openPermissions(node);
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    onLogout();
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "N/A";
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  };

  const getFileIcon = (node) => {
    if (node.type === "folder") {
      return (
        <svg
          className="w-8 h-8 text-blue-500"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
      );
    }
    return (
      <svg
        className="w-8 h-8 text-gray-400"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
          clipRule="evenodd"
        />
      </svg>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-light-bg dark:bg-dark-bg">
      <nav className="bg-light-surface dark:bg-dark-surface border-b border-light-border dark:border-dark-border">
        <div className="px-4 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-semibold text-light-text dark:text-dark-text">
              Cygnus Files
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-light-bg dark:bg-dark-bg">
              <div className="w-7 h-7 bg-gradient-to-br from-light-primary to-light-primary-hover dark:from-dark-primary dark:to-dark-primary-hover rounded-full flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <span className="text-sm font-medium text-light-text dark:text-dark-text">
                {user.username}
              </span>
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
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="bg-light-surface dark:bg-dark-surface border-b border-light-border dark:border-dark-border px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1 text-sm">
                <button
                  onClick={() => navigateToPath(-1)}
                  className="px-2 py-1 rounded hover:bg-light-bg dark:hover:bg-dark-bg text-light-text dark:text-dark-text"
                >
                  All Files
                </button>
                {path.map((folder, index) => (
                  <React.Fragment key={folder.id}>
                    <svg
                      className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <button
                      onClick={() => navigateToPath(index)}
                      className="px-2 py-1 rounded hover:bg-light-bg dark:hover:bg-dark-bg text-light-text dark:text-dark-text"
                    >
                      {folder.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded ${
                    viewMode === "grid"
                      ? "bg-light-primary/10 dark:bg-dark-primary/10 text-light-primary dark:text-dark-primary"
                      : "text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg"
                  }`}
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded ${
                    viewMode === "list"
                      ? "bg-light-primary/10 dark:bg-dark-primary/10 text-light-primary dark:text-dark-primary"
                      : "text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg"
                  }`}
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-light-surface dark:bg-dark-surface border-b border-light-border dark:border-dark-border px-4 py-2">
            {selectedNodes.length > 0 ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-medium text-light-text dark:text-dark-text">
                    {selectedNodes.length} selected
                  </span>
                  <button
                    onClick={clearSelection}
                    className="text-sm text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  {selectedNodes.filter((id) => nodes.find((n) => n.id === id && n.type === "file")).length > 0 && (
                    <button
                      onClick={handleBulkDownload}
                      className="flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium text-light-text dark:text-dark-text bg-light-bg dark:bg-dark-bg hover:bg-light-border dark:hover:bg-dark-border rounded-lg transition-colors"
                      title="Download"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      <span>Download</span>
                    </button>
                  )}
                  <button
                    onClick={handleBulkMove}
                    className="flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium text-light-text dark:text-dark-text bg-light-bg dark:bg-dark-bg hover:bg-light-border dark:hover:bg-dark-border rounded-lg transition-colors"
                    title="Move"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Move</span>
                  </button>
                  {selectedNodes.length === 1 && (
                    <>
                      <button
                        onClick={handleBulkRename}
                        className="flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium text-light-text dark:text-dark-text bg-light-bg dark:bg-dark-bg hover:bg-light-border dark:hover:bg-dark-border rounded-lg transition-colors"
                        title="Rename"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                        <span>Rename</span>
                      </button>
                      <button
                        onClick={handleBulkShare}
                        className="flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium text-light-text dark:text-dark-text bg-light-bg dark:bg-dark-bg hover:bg-light-border dark:hover:bg-dark-border rounded-lg transition-colors"
                        title="Share"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                        </svg>
                        <span>Share</span>
                      </button>
                      <button
                        onClick={handleBulkPermissions}
                        className="flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium text-light-text dark:text-dark-text bg-light-bg dark:bg-dark-bg hover:bg-light-border dark:hover:bg-dark-border rounded-lg transition-colors"
                        title="Permissions"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                        <span>Permissions</span>
                      </button>
                    </>
                  )}
                  <button
                    onClick={handleBulkDelete}
                    className="flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowCreateFolder(true)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium text-light-text dark:text-dark-text bg-light-bg dark:bg-dark-bg hover:bg-light-border dark:hover:bg-dark-border rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  </svg>
                  <span>New Folder</span>
                </button>
                <button
                  onClick={() => fileInputRef.current.click()}
                  className="flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium text-white dark:text-black bg-light-primary dark:bg-dark-primary hover:bg-light-primary-hover dark:hover:bg-dark-primary-hover rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Upload</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => loadNodes(currentPage)}
                  className="p-1.5 text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <svg
                  className="w-5 h-5 text-red-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-sm text-red-700 dark:text-red-400">
                  {error}
                </span>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-500 hover:text-red-700 dark:hover:text-red-300"
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          )}

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-auto p-4">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex items-center space-x-2 text-light-text-secondary dark:text-dark-text-secondary">
                    <svg
                      className="w-5 h-5 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>Loading...</span>
                  </div>
                </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {nodes.map((node) => (
                  <div
                    key={node.id}
                    className={`group relative p-3 rounded-lg hover:bg-light-surface dark:hover:bg-dark-surface border transition-all cursor-pointer ${
                      selectedNodes.includes(node.id) 
                        ? "bg-light-primary/5 dark:bg-dark-primary/5 border-light-primary dark:border-dark-primary" 
                        : "border-transparent hover:border-light-border dark:hover:border-dark-border"
                    }`}
                    onDoubleClick={() =>
                      node.type === "folder" && navigateToFolder(node)
                    }
                  >
                    <div className="absolute top-2 left-2">
                      <input
                        type="checkbox"
                        checked={selectedNodes.includes(node.id)}
                        onChange={() => toggleNodeSelection(node.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-light-border dark:border-dark-border"
                      />
                    </div>
                    <div className="flex flex-col items-center">
                      {getFileIcon(node)}
                      <p className="mt-2 text-sm text-center text-light-text dark:text-dark-text truncate w-full">
                        {node.name}
                      </p>
                      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                        {node.type === "file"
                          ? formatFileSize(node.file_size)
                          : "Folder"}
                      </p>
                    </div>
                  </div>
                ))}
                {nodes.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center py-16 text-light-text-secondary dark:text-dark-text-secondary">
                    <svg
                      className="w-16 h-16 mb-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1H8a3 3 0 00-3 3v1.5a1.5 1.5 0 01-3 0V6z"
                        clipRule="evenodd"
                      />
                      <path d="M6 12a2 2 0 012-2h8a2 2 0 012 2v2a2 2 0 01-2 2H2h2a2 2 0 002-2v-2z" />
                    </svg>
                    <p className="text-lg font-medium">This folder is empty</p>
                    <p className="text-sm">
                      Upload files or create folders to get started
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-light-surface dark:bg-dark-surface rounded-lg border border-light-border dark:border-dark-border overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-light-border dark:border-dark-border">
                      <th className="px-4 py-3 w-12">
                        <input
                          type="checkbox"
                          checked={nodes.length > 0 && selectedNodes.length === nodes.length}
                          onChange={toggleSelectAll}
                          className="rounded border-light-border dark:border-dark-border"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                        Owner
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                        Size
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                        Modified
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {nodes.map((node) => (
                      <tr
                        key={node.id}
                        className={`border-b border-light-border dark:border-dark-border hover:bg-light-bg dark:hover:bg-dark-bg cursor-pointer ${
                          selectedNodes.includes(node.id) ? "bg-light-primary/5 dark:bg-dark-primary/5" : ""
                        }`}
                        onClick={() => toggleNodeSelection(node.id)}
                        onDoubleClick={() =>
                          node.type === "folder" && navigateToFolder(node)
                        }
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedNodes.includes(node.id)}
                            onChange={() => toggleNodeSelection(node.id)}
                            className="rounded border-light-border dark:border-dark-border"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0">
                              {node.type === "folder" ? (
                                <svg
                                  className="w-6 h-6 text-blue-500"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                                </svg>
                              ) : (
                                <svg
                                  className="w-6 h-6 text-gray-400"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              )}
                            </div>
                            <span className="text-sm text-light-text dark:text-dark-text">
                              {node.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-light-text dark:text-dark-text">
                          {node.owner}
                        </td>
                        <td className="px-4 py-3 text-sm text-light-text dark:text-dark-text">
                          {node.type === "file"
                            ? formatFileSize(node.file_size)
                            : "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-light-text dark:text-dark-text">
                          {new Date(node.updated_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                    {nodes.length === 0 && (
                      <tr>
                        <td
                          colSpan="5"
                          className="px-4 py-8 text-center text-light-text-secondary dark:text-dark-text-secondary"
                        >
                          This folder is empty
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              )}
            </div>

            {/* Pagination Controls */}
            {pagination.total > 0 && (
              <div className="bg-light-surface dark:bg-dark-surface border-t border-light-border dark:border-dark-border px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                      Showing {((pagination.page - 1) * pagination.page_size) + 1} to{' '}
                      {Math.min(pagination.page * pagination.page_size, pagination.total)} of{' '}
                      {pagination.total} items
                    </p>
                    <div className="flex items-center space-x-2">
                      <label className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        Items per page:
                      </label>
                      <select
                        value={pageSize}
                        onChange={(e) => setPageSize(parseInt(e.target.value))}
                        className="px-2 py-1 border border-light-border dark:border-dark-border rounded bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text text-sm"
                      >
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                        <option value="200">200</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={!pagination.has_prev}
                      className="px-3 py-1 text-sm border border-light-border dark:border-dark-border rounded bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text disabled:opacity-50 disabled:cursor-not-allowed hover:bg-light-border dark:hover:bg-dark-border"
                    >
                      First
                    </button>
                    <button
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={!pagination.has_prev}
                      className="px-3 py-1 text-sm border border-light-border dark:border-dark-border rounded bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text disabled:opacity-50 disabled:cursor-not-allowed hover:bg-light-border dark:hover:bg-dark-border"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1 text-sm text-light-text dark:text-dark-text">
                      Page {pagination.page} of {pagination.total_pages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={!pagination.has_next}
                      className="px-3 py-1 text-sm border border-light-border dark:border-dark-border rounded bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text disabled:opacity-50 disabled:cursor-not-allowed hover:bg-light-border dark:hover:bg-dark-border"
                    >
                      Next
                    </button>
                    <button
                      onClick={() => setCurrentPage(pagination.total_pages)}
                      disabled={!pagination.has_next}
                      className="px-3 py-1 text-sm border border-light-border dark:border-dark-border rounded bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text disabled:opacity-50 disabled:cursor-not-allowed hover:bg-light-border dark:hover:bg-dark-border"
                    >
                      Last
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreateFolder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-xl max-w-md w-full mx-4 border border-light-border dark:border-dark-border">
            <h2 className="text-xl font-bold mb-4 text-light-text dark:text-dark-text">
              Create New Folder
            </h2>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="w-full p-2 border border-light-border dark:border-dark-border rounded mb-4 bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text"
              onKeyPress={(e) => e.key === "Enter" && handleCreateFolder()}
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
                className="px-4 py-2 bg-light-primary dark:bg-dark-primary text-white dark:text-black rounded hover:bg-light-primary-hover dark:hover:bg-dark-primary-hover"
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
              Share "{selectedNode?.name}"
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
              Permissions for "{selectedNode?.name}"
            </h2>
            <table className="min-w-full mb-4">
              <thead>
                <tr className="border-b border-light-border dark:border-dark-border">
                  <th className="px-4 py-2 text-left text-light-text dark:text-dark-text">
                    User
                  </th>
                  <th className="px-4 py-2 text-left text-light-text dark:text-dark-text">
                    Permission
                  </th>
                  <th className="px-4 py-2 text-left text-light-text dark:text-dark-text">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {permissions.map((perm) => (
                  <tr
                    key={perm.id}
                    className="border-b border-light-border dark:border-dark-border"
                  >
                    <td className="px-4 py-2 text-light-text dark:text-dark-text">
                      {perm.username}
                    </td>
                    <td className="px-4 py-2 text-light-text dark:text-dark-text capitalize">
                      {perm.permission_level}
                    </td>
                    <td className="px-4 py-2">
                      {perm.permission_level !== "owner" && (
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
              Rename "{selectedNode?.name}"
            </h2>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New name"
              className="w-full p-2 border border-light-border dark:border-dark-border rounded mb-4 bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text"
              onKeyPress={(e) => e.key === "Enter" && handleRename()}
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
                className="px-4 py-2 bg-light-primary dark:bg-dark-primary text-white dark:text-black rounded hover:bg-light-primary-hover dark:hover:bg-dark-primary-hover"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {showMoveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-xl max-w-lg w-full mx-4 border border-light-border dark:border-dark-border">
            <h2 className="text-xl font-bold mb-4 text-light-text dark:text-dark-text">
              {selectedNode ? `Move "${selectedNode.name}"` : `Move ${selectedNodes.length} item(s)`}
            </h2>

            {/* Breadcrumb Navigation */}
            <div className="mb-3 flex items-center space-x-1 text-sm bg-light-bg dark:bg-dark-bg p-2 rounded">
              <button
                onClick={() => navigateToMovePath(-1)}
                className="px-2 py-1 rounded hover:bg-light-surface dark:hover:bg-dark-surface text-light-text dark:text-dark-text"
              >
                Root
              </button>
              {movePath.map((folder, index) => (
                <React.Fragment key={folder.id}>
                  <svg
                    className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <button
                    onClick={() => navigateToMovePath(index)}
                    className="px-2 py-1 rounded hover:bg-light-surface dark:hover:bg-dark-surface text-light-text dark:text-dark-text"
                  >
                    {folder.name}
                  </button>
                </React.Fragment>
              ))}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-light-text dark:text-dark-text">
                Browse and Select Destination
              </label>

              {/* Option to select current folder */}
              {moveCurrentFolder !== null && (
                <button
                  onClick={() => setSelectedDestination("current")}
                  className={`w-full text-left px-3 py-2 mb-2 rounded border transition-colors flex items-center space-x-2 ${
                    selectedDestination === "current"
                      ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500"
                      : "border-light-border dark:border-dark-border hover:bg-light-surface dark:hover:bg-dark-surface"
                  }`}
                >
                  <svg
                    className="w-5 h-5 text-indigo-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-light-text dark:text-dark-text font-medium">
                    Move to "{movePath[movePath.length - 1]?.name}" (current
                    folder)
                  </span>
                </button>
              )}

              {/* Root folder option (only show when at root level) */}
              {moveCurrentFolder === null && (
                <button
                  onClick={() => setSelectedDestination(null)}
                  className={`w-full text-left px-3 py-2 mb-2 rounded border transition-colors flex items-center space-x-2 ${
                    selectedDestination === null
                      ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500"
                      : "border-light-border dark:border-dark-border hover:bg-light-surface dark:hover:bg-dark-surface"
                  }`}
                >
                  <svg
                    className="w-5 h-5 text-indigo-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-light-text dark:text-dark-text font-medium">
                    Move to Root Folder
                  </span>
                </button>
              )}

              {/* Folder list */}
              <div className="border border-light-border dark:border-dark-border rounded max-h-64 overflow-y-auto bg-light-bg dark:bg-dark-bg">
                {moveFolders.map((folder) => (
                  <div
                    key={folder.id}
                    className="flex items-center hover:bg-light-surface dark:hover:bg-dark-surface"
                  >
                    <button
                      onClick={() => navigateToMoveFolder(folder)}
                      className="flex-1 text-left px-3 py-2 transition-colors flex items-center space-x-2"
                      title="Double-click to open folder"
                    >
                      <svg
                        className="w-5 h-5 text-blue-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                      </svg>
                      <span className="text-light-text dark:text-dark-text flex-1">
                        {folder.name}
                      </span>
                      <svg
                        className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
                {moveFolders.length === 0 && (
                  <div className="px-3 py-8 text-center text-light-text-secondary dark:text-dark-text-secondary text-sm">
                    No subfolders available.{" "}
                    {moveCurrentFolder === null
                      ? 'Select "Move to Root Folder" above'
                      : 'Select "Move to current folder" above'}{" "}
                    to move here.
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowMoveDialog(false)}
                className="px-4 py-2 bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text rounded hover:bg-light-border dark:hover:bg-dark-border"
              >
                Cancel
              </button>
              <button
                onClick={handleMove}
                disabled={
                  selectedDestination === null && moveCurrentFolder !== null
                }
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Move
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileManager;
