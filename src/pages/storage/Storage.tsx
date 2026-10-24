import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { UserDto, StorageStats, StorageItemDto, ServerFileDownloadDto } from "../../types";
import {
  FolderIcon,
  FileIcon,
  FilePlusIcon,
  UploadIcon,
  DownloadIcon,
  TrashIcon,
  FolderPlusIcon,
  RefreshIcon,
  ChevronRightIcon,
  SpinnerIcon,
  CheckCircleIcon,
  AlertCircleIcon,
} from "../../components/Icons";
import "./Storage.css";

interface StorageProps {
  currentUser: UserDto;
}

interface BreadcrumbItem {
  id: number | null;
  name: string;
}

export default function Storage({ currentUser }: StorageProps) {
  const [items, setItems] = useState<StorageItemDto[]>([]);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: null, name: "Корневая папка" },
  ]);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  // Create folder modal state
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Create file modal state
  const [showCreateFile, setShowCreateFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileContent, setNewFileContent] = useState("");
  const [creatingFile, setCreatingFile] = useState(false);

  // View / Edit file modal state
  const [fileToEdit, setFileToEdit] = useState<StorageItemDto | null>(null);
  const [editFileContent, setEditFileContent] = useState("");
  const [savingFileContent, setSavingFileContent] = useState(false);
  const [loadingFileContent, setLoadingFileContent] = useState(false);

  // Rename modal state
  const [itemToRename, setItemToRename] = useState<StorageItemDto | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  // Delete modal state
  const [itemToDelete, setItemToDelete] = useState<StorageItemDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  const showSuccess = (msg: string) => {
    setSuccessNotice(msg);
    setTimeout(() => setSuccessNotice(null), 4000);
  };

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 5000);
  };

  // Load storage statistics
  const loadStats = useCallback(async () => {
    if (!isTauri) return;
    try {
      const res = await invoke<StorageStats>("get_storage_stats");
      setStats(res);
    } catch (err) {
      console.error("Ошибка загрузки статистики хранилища:", err);
    }
  }, [isTauri]);

  // Load items for the current folder
  const loadItems = useCallback(
    async (folderId: number | null) => {
      if (!isTauri) return;
      setLoading(true);
      try {
        const res = await invoke<StorageItemDto[]>("list_storage_items", {
          userEmail: currentUser.email,
          folderId,
        });
        setItems(res || []);
      } catch (err: unknown) {
        showError(typeof err === "string" ? err : "Ошибка получения списка файлов");
      } finally {
        setLoading(false);
      }
    },
    [isTauri, currentUser.email]
  );

  useEffect(() => {
    loadStats();
    loadItems(currentFolderId);
  }, [loadStats, loadItems, currentFolderId]);

  // Navigate into a folder
  const handleOpenFolder = (folder: StorageItemDto) => {
    const rawId = folder.id.replace("folder_", "");
    const parsedId = parseInt(rawId, 10);
    if (isNaN(parsedId)) return;

    setCurrentFolderId(parsedId);
    setBreadcrumbs((prev) => [...prev, { id: parsedId, name: folder.name }]);
  };

  // Navigate to a breadcrumb
  const handleNavigateBreadcrumb = (index: number) => {
    const target = breadcrumbs[index];
    if (target.id === currentFolderId) return;

    setCurrentFolderId(target.id);
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
  };

  // Create folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    setCreatingFolder(true);
    try {
      await invoke("create_server_folder", {
        userEmail: currentUser.email,
        folderName: newFolderName.trim(),
        parentId: currentFolderId,
      });
      setShowCreateFolder(false);
      setNewFolderName("");
      showSuccess(`Папка "${newFolderName}" создана`);
      loadItems(currentFolderId);
    } catch (err: unknown) {
      showError(typeof err === "string" ? err : "Ошибка создания папки");
    } finally {
      setCreatingFolder(false);
    }
  };

  // Helper to detect editable text files
  const isTextFile = (name: string) => {
    const lower = name.toLowerCase();
    return (
      lower.endsWith(".txt") ||
      lower.endsWith(".md") ||
      lower.endsWith(".json") ||
      lower.endsWith(".html") ||
      lower.endsWith(".css") ||
      lower.endsWith(".js") ||
      lower.endsWith(".ts") ||
      lower.endsWith(".jsx") ||
      lower.endsWith(".tsx") ||
      lower.endsWith(".csv") ||
      lower.endsWith(".xml") ||
      lower.endsWith(".log") ||
      lower.endsWith(".sh") ||
      lower.endsWith(".py") ||
      lower.endsWith(".rs") ||
      lower.endsWith(".sql") ||
      lower.endsWith(".env") ||
      lower.endsWith(".yml") ||
      lower.endsWith(".yaml")
    );
  };

  // Create new file
  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;

    let finalName = newFileName.trim();
    if (!finalName.includes(".")) {
      finalName += ".txt";
    }

    setCreatingFile(true);
    try {
      await invoke("create_server_file", {
        userEmail: currentUser.email,
        fileName: finalName,
        content: newFileContent,
        folderId: currentFolderId,
      });
      setShowCreateFile(false);
      setNewFileName("");
      setNewFileContent("");
      showSuccess(`Файл "${finalName}" создан на сервере`);
      loadItems(currentFolderId);
      loadStats();
    } catch (err: unknown) {
      showError(typeof err === "string" ? err : "Ошибка создания файла");
    } finally {
      setCreatingFile(false);
    }
  };

  // Open file (text editor if text, download if binary)
  const handleOpenFile = async (item: StorageItemDto) => {
    if (item.item_type === "folder") {
      handleOpenFolder(item);
      return;
    }

    if (!isTextFile(item.name)) {
      handleDownloadFile(item);
      return;
    }

    const rawId = item.id.replace("file_", "");
    const fileId = parseInt(rawId, 10);
    if (isNaN(fileId)) return;

    setLoadingFileContent(true);
    setFileToEdit(item);
    try {
      const downloadData = await invoke<ServerFileDownloadDto>("download_server_file", {
        userEmail: currentUser.email,
        fileId,
      });

      if (downloadData.content_base64) {
        const byteCharacters = atob(downloadData.content_base64);
        const byteNumbers = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const text = new TextDecoder("utf-8").decode(byteNumbers);
        setEditFileContent(text);
      } else {
        setEditFileContent("");
      }
    } catch (err: unknown) {
      showError(typeof err === "string" ? err : "Не удалось открыть файл");
      setFileToEdit(null);
    } finally {
      setLoadingFileContent(false);
    }
  };

  // Save edited file content
  const handleSaveFileContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileToEdit) return;

    const rawId = fileToEdit.id.replace("file_", "");
    const fileId = parseInt(rawId, 10);
    if (isNaN(fileId)) return;

    setSavingFileContent(true);
    try {
      await invoke("save_server_file_content", {
        userEmail: currentUser.email,
        fileId,
        content: editFileContent,
      });
      setFileToEdit(null);
      showSuccess(`Файл "${fileToEdit.name}" сохранён`);
      loadItems(currentFolderId);
      loadStats();
    } catch (err: unknown) {
      showError(typeof err === "string" ? err : "Ошибка сохранения файла");
    } finally {
      setSavingFileContent(false);
    }
  };

  // Upload files handler
  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadMessage(`Загрузка (${i + 1}/${files.length}): ${file.name}...`);

      try {
        // Read file into base64
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const res = reader.result as string;
            const b64 = res.split(",")[1] || "";
            resolve(b64);
          };
          reader.onerror = () => reject(new Error("Ошибка чтения файла"));
          reader.readAsDataURL(file);
        });

        await invoke("upload_server_file", {
          userEmail: currentUser.email,
          fileName: file.name,
          sizeBytes: file.size,
          mimeType: file.type || "application/octet-stream",
          contentBase64: base64Data,
          folderId: currentFolderId,
        });

        successCount++;
      } catch (err: unknown) {
        showError(`Ошибка загрузки "${file.name}": ${typeof err === "string" ? err : "сбой"}`);
      }
    }

    setIsUploading(false);
    setUploadMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (successCount > 0) {
      showSuccess(`Успешно сохранено на сервере файлов: ${successCount}`);
      loadItems(currentFolderId);
      loadStats();
    }
  };

  // Download file handler
  const handleDownloadFile = async (item: StorageItemDto) => {
    const rawId = item.id.replace("file_", "");
    const fileId = parseInt(rawId, 10);
    if (isNaN(fileId)) return;

    try {
      const downloadData = await invoke<ServerFileDownloadDto>("download_server_file", {
        userEmail: currentUser.email,
        fileId,
      });

      if (!downloadData.content_base64) {
        showError("Файл не содержит данных на сервере");
        return;
      }

      // Convert base64 to Blob
      const byteCharacters = atob(downloadData.content_base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {
        type: downloadData.mime_type || "application/octet-stream",
      });

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadData.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      showError(typeof err === "string" ? err : "Не удалось скачать файл");
    }
  };

  // Rename item
  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemToRename || !renameValue.trim()) return;

    setRenaming(true);
    try {
      await invoke("rename_server_item", {
        userEmail: currentUser.email,
        itemId: itemToRename.id,
        newName: renameValue.trim(),
      });
      setItemToRename(null);
      setRenameValue("");
      showSuccess("Успешно переименовано");
      loadItems(currentFolderId);
    } catch (err: unknown) {
      showError(typeof err === "string" ? err : "Ошибка переименования");
    } finally {
      setRenaming(false);
    }
  };

  // Delete item
  const handleDelete = async () => {
    if (!itemToDelete) return;

    setDeleting(true);
    try {
      await invoke("delete_server_item", {
        userEmail: currentUser.email,
        itemId: itemToDelete.id,
      });
      setItemToDelete(null);
      showSuccess(`"${itemToDelete.name}" удалено`);
      loadItems(currentFolderId);
      loadStats();
    } catch (err: unknown) {
      showError(typeof err === "string" ? err : "Ошибка удаления");
    } finally {
      setDeleting(false);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  // Filter items by search
  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="has-storage-container">
      {/* Notifications */}
      {uploadMessage && (
        <div className="has-upload-banner">
          <SpinnerIcon className="w-4 h-4" width={16} height={16} />
          <span>{uploadMessage}</span>
        </div>
      )}

      {successNotice && (
        <div className="has-success-banner">
          <CheckCircleIcon className="w-5 h-5" width={20} height={20} />
          <span>{successNotice}</span>
        </div>
      )}

      {errorMessage && (
        <div className="has-error-banner">
          <AlertCircleIcon className="w-5 h-5" width={20} height={20} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Storage Disk Capacity Card */}
      <div className="has-storage-stats-card">
        <div className="has-storage-stats-header">
          <div className="has-storage-stats-title">
            <span>Серверное хранилище (PostgreSQL)</span>
          </div>
          <div className="has-storage-stats-info">
            {stats
              ? `Использовано: ${stats.used_formatted} из ${stats.total_formatted}`
              : "Загрузка параметров..."}
          </div>
        </div>

        <div className="has-storage-progress-bar">
          <div
            className="has-storage-progress-fill"
            style={{ width: `${stats ? Math.min(Math.max(stats.percent_used, 2), 100) : 5}%` }}
          />
        </div>

        <div className="has-storage-stats-footer">
          <span>{stats ? `Свободно: ${stats.free_formatted}` : "Свободно: —"}</span>
          <span>{stats ? `${stats.percent_used.toFixed(1)}% заполнено` : ""}</span>
        </div>
      </div>

      {/* Toolbar: Breadcrumbs + Actions */}
      <div className="has-storage-toolbar">
        {/* Breadcrumb Navigation */}
        <div className="has-storage-breadcrumbs">
          {breadcrumbs.map((crumb, idx) => (
            <div key={crumb.id ?? "root"} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {idx > 0 && <ChevronRightIcon className="w-3.5 h-3.5" width={14} height={14} />}
              <button
                type="button"
                className={`has-breadcrumb-btn ${idx === breadcrumbs.length - 1 ? "active" : ""}`}
                onClick={() => handleNavigateBreadcrumb(idx)}
              >
                {crumb.name}
              </button>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="has-storage-actions">
          <div className="has-storage-search-box">
            <input
              type="text"
              placeholder="Поиск..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="has-storage-search-input"
            />
          </div>
          <input
            type="file"
            multiple
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={(e) => handleUploadFiles(e.target.files)}
          />

          <button
            type="button"
            className="has-btn-upload"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <UploadIcon className="w-4 h-4" width={16} height={16} />
            <span>Загрузить файл</span>
          </button>

          <button
            type="button"
            className="has-btn-new-folder"
            onClick={() => {
              setNewFolderName("");
              setShowCreateFolder(true);
            }}
          >
            <FolderPlusIcon className="w-4 h-4" width={16} height={16} />
            <span>Создать папку</span>
          </button>

          <button
            type="button"
            className="has-btn-new-file"
            onClick={() => {
              setNewFileName("");
              setNewFileContent("");
              setShowCreateFile(true);
            }}
          >
            <FilePlusIcon className="w-4 h-4" width={16} height={16} />
            <span>Создать файл</span>
          </button>

          <button
            type="button"
            className="has-btn-icon-only"
            title="Обновить список"
            onClick={() => {
              loadItems(currentFolderId);
              loadStats();
            }}
            disabled={loading}
          >
            <RefreshIcon className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} width={16} height={16} />
          </button>
        </div>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        className={`has-storage-dropzone ${isDragging ? "dragging" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="has-dropzone-icon">
          <UploadIcon className="w-6 h-6" width={24} height={24} />
        </div>
        <div className="has-dropzone-title">Перетащите файлы сюда или нажмите для выбора</div>
        <div className="has-dropzone-sub">
          Файлы мгновенно сохраняются в центральной базе данных PostgreSQL сервера
        </div>
      </div>

      {/* Grid of Files and Folders */}
      {loading ? (
        <div className="has-storage-empty">
          <SpinnerIcon className="w-8 h-8" width={32} height={32} />
          <div className="has-empty-title" style={{ marginTop: 12 }}>
            Загрузка содержимого...
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="has-storage-empty">
          <div className="has-empty-icon">
            <FolderIcon className="w-8 h-8" width={32} height={32} />
          </div>
          <div className="has-empty-title">Папка пуста</div>
          <div className="has-empty-sub">
            Загрузите файлы или создайте новую папку с помощью кнопок панели управления
          </div>
        </div>
      ) : (
        <div className="has-storage-grid">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`has-storage-card ${item.item_type === "folder" ? "is-folder" : ""}`}
              style={{ cursor: "pointer" }}
              onClick={() => {
                if (item.item_type === "folder") {
                  handleOpenFolder(item);
                } else {
                  handleOpenFile(item);
                }
              }}
            >
              <div className="has-storage-card-main">
                <div className={`has-item-icon-box ${item.item_type}`}>
                  {item.item_type === "folder" ? (
                    <FolderIcon className="w-6 h-6" width={24} height={24} />
                  ) : (
                    <FileIcon className="w-6 h-6" width={24} height={24} />
                  )}
                </div>
                <div className="has-storage-card-details">
                  <div className="has-card-item-name" title={item.name}>
                    {item.name}
                  </div>
                  <div className="has-card-item-meta">
                    {item.size_formatted} • {item.modified}
                  </div>
                </div>
              </div>

              {/* Action buttons on card */}
              <div
                className="has-storage-card-actions"
                onClick={(e) => e.stopPropagation()}
              >
                {item.item_type === "file" && isTextFile(item.name) && (
                  <button
                    type="button"
                    className="has-item-action-btn"
                    title="Открыть / Редактировать текст"
                    onClick={() => handleOpenFile(item)}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700 }}>📄</span>
                  </button>
                )}

                {item.item_type === "file" && (
                  <button
                    type="button"
                    className="has-item-action-btn"
                    title="Скачать файл с сервера"
                    onClick={() => handleDownloadFile(item)}
                  >
                    <DownloadIcon className="w-4 h-4" width={16} height={16} />
                  </button>
                )}

                <button
                  type="button"
                  className="has-item-action-btn"
                  title="Переименовать"
                  onClick={() => {
                    setItemToRename(item);
                    setRenameValue(item.name);
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700 }}>✎</span>
                </button>

                <button
                  type="button"
                  className="has-item-action-btn delete"
                  title="Удалить"
                  onClick={() => setItemToDelete(item)}
                >
                  <TrashIcon className="w-4 h-4" width={16} height={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Folder Modal */}
      {showCreateFolder && (
        <div className="has-modal-backdrop" onClick={() => setShowCreateFolder(false)}>
          <div className="has-modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="has-modal-title">Создание новой папки</h3>
            <form onSubmit={handleCreateFolder} className="has-modal-body">
              <label className="has-modal-label">Название папки</label>
              <input
                type="text"
                className="has-modal-input"
                placeholder="Например: Проекты, Архивы..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                autoFocus
              />
              <div className="has-modal-actions">
                <button
                  type="button"
                  className="has-btn-cancel"
                  onClick={() => setShowCreateFolder(false)}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="has-btn-primary-action"
                  disabled={creatingFolder || !newFolderName.trim()}
                >
                  {creatingFolder ? "Создание..." : "Создать"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create File Modal */}
      {showCreateFile && (
        <div className="has-modal-backdrop" onClick={() => setShowCreateFile(false)}>
          <div className="has-modal-box" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <h3 className="has-modal-title">Создание нового файла</h3>
            <form onSubmit={handleCreateFile} className="has-modal-body">
              <label className="has-modal-label">Имя файла</label>
              <input
                type="text"
                className="has-modal-input"
                placeholder="Например: notes.txt, document.md, config.json..."
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                autoFocus
              />
              <label className="has-modal-label">Содержимое файла (необязательно)</label>
              <textarea
                className="has-modal-textarea"
                placeholder="Введите текст или оставьте поле пустым..."
                value={newFileContent}
                onChange={(e) => setNewFileContent(e.target.value)}
              />
              <div className="has-modal-actions">
                <button
                  type="button"
                  className="has-btn-cancel"
                  onClick={() => setShowCreateFile(false)}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="has-btn-primary-action"
                  disabled={creatingFile || !newFileName.trim()}
                >
                  {creatingFile ? "Создание..." : "Создать файл"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View/Edit File Modal */}
      {fileToEdit && (
        <div className="has-modal-backdrop" onClick={() => setFileToEdit(null)}>
          <div className="has-modal-box" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <h3 className="has-modal-title">Редактирование: {fileToEdit.name}</h3>
            {loadingFileContent ? (
              <div style={{ textAlign: "center", padding: 30 }}>
                <SpinnerIcon className="w-6 h-6" width={24} height={24} />
                <div style={{ marginTop: 8, fontSize: 13, color: "#64748b" }}>Загрузка содержимого...</div>
              </div>
            ) : (
              <form onSubmit={handleSaveFileContent} className="has-modal-body">
                <textarea
                  className="has-modal-textarea"
                  style={{ minHeight: 240, fontFamily: "monospace", fontSize: 13 }}
                  value={editFileContent}
                  onChange={(e) => setEditFileContent(e.target.value)}
                  autoFocus
                />
                <div className="has-modal-actions">
                  <button
                    type="button"
                    className="has-btn-cancel"
                    onClick={() => setFileToEdit(null)}
                  >
                    Закрыть
                  </button>
                  <button
                    type="submit"
                    className="has-btn-primary-action"
                    disabled={savingFileContent}
                  >
                    {savingFileContent ? "Сохранение..." : "Сохранить изменения"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {itemToRename && (
        <div className="has-modal-backdrop" onClick={() => setItemToRename(null)}>
          <div className="has-modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="has-modal-title">
              Переименование {itemToRename.item_type === "folder" ? "папки" : "файла"}
            </h3>
            <form onSubmit={handleRename} className="has-modal-body">
              <label className="has-modal-label">Новое имя</label>
              <input
                type="text"
                className="has-modal-input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
              />
              <div className="has-modal-actions">
                <button
                  type="button"
                  className="has-btn-cancel"
                  onClick={() => setItemToRename(null)}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="has-btn-primary-action"
                  disabled={renaming || !renameValue.trim()}
                >
                  {renaming ? "Сохранение..." : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="has-modal-backdrop" onClick={() => setItemToDelete(null)}>
          <div className="has-modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="has-modal-title">Подтверждение удаления</h3>
            <div className="has-modal-body">
              <p style={{ margin: 0, fontSize: 13.5, color: "#475569" }}>
                Вы действительно хотите удалить{" "}
                {itemToDelete.item_type === "folder" ? "папку" : "файл"}{" "}
                <strong>"{itemToDelete.name}"</strong>?
                {itemToDelete.item_type === "folder" && (
                  <span style={{ display: "block", marginTop: 6, color: "#dc2626" }}>
                    Все вложенные файлы и подпапки будут удалены безвозвратно.
                  </span>
                )}
              </p>
              <div className="has-modal-actions">
                <button
                  type="button"
                  className="has-btn-cancel"
                  onClick={() => setItemToDelete(null)}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="has-btn-danger"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? "Удаление..." : "Удалить"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
