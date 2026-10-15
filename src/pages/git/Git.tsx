import { useState, useEffect, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  UserDto,
  RepositoryDto,
  GitTreeItemDto,
  GitCommitDto,
  GitFileContentDto,
} from "../../types";
import {
  GitBranchIcon,
  GitCommitIcon,
  GitRepoIcon,
  CodeIcon,
  CopyIcon,
  SearchIcon,
  TrashIcon,
  RefreshIcon,
  FolderIcon,
  FileIcon,
} from "../../components/Icons";
import "./Git.css";

interface GitProps {
  user: UserDto;
}

export default function Git({ user }: GitProps) {
  // Navigation & view states
  const [repositories, setRepositories] = useState<RepositoryDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "public" | "private">("all");

  // Selected repository view
  const [selectedRepo, setSelectedRepo] = useState<RepositoryDto | null>(null);
  const [activeRepoTab, setActiveRepoTab] = useState<"code" | "commits" | "branches" | "settings">("code");
  const [currentBranch, setCurrentBranch] = useState("main");
  const [branches, setBranches] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState("");
  const [treeItems, setTreeItems] = useState<GitTreeItemDto[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<GitFileContentDto | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [readmeContent, setReadmeContent] = useState<string | null>(null);

  // Commits state
  const [commits, setCommits] = useState<GitCommitDto[]>([]);
  const [commitsLoading, setCommitsLoading] = useState(false);

  // Modals & form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newRepoName, setNewRepoName] = useState("");
  const [newRepoDesc, setNewRepoDesc] = useState("");
  const [newRepoPrivate, setNewRepoPrivate] = useState(false);
  const [newRepoInitReadme, setNewRepoInitReadme] = useState(true);
  const [createError, setCreateError] = useState<string | null>(null);

  // Settings tab form state
  const [editDesc, setEditDesc] = useState("");
  const [editPrivate, setEditPrivate] = useState(false);
  const [updatingSettings, setUpdatingSettings] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showQuickStart, setShowQuickStart] = useState(false);

  const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  // Load repositories
  const loadRepositories = useCallback(async () => {
    if (!isTauri) return;
    setLoading(true);
    setError(null);
    try {
      const res = await invoke<RepositoryDto[]>("list_server_repositories", {
        userEmail: user.email,
      });
      setRepositories(res);
    } catch (err) {
      setError(`Ошибка загрузки репозиториев: ${err}`);
    } finally {
      setLoading(false);
    }
  }, [isTauri, user.email]);

  useEffect(() => {
    loadRepositories();
  }, [loadRepositories]);

  // Load repository tree & branches when selectedRepo changes
  const loadRepoDetails = useCallback(async (repo: RepositoryDto) => {
    if (!isTauri) return;
    setSelectedRepo(repo);
    setActiveRepoTab("code");
    setCurrentPath("");
    setSelectedFile(null);
    setReadmeContent(null);
    setEditDesc(repo.description || "");
    setEditPrivate(repo.is_private);

    // Load branches
    try {
      const branchList = await invoke<string[]>("get_repository_branches", {
        userEmail: user.email,
        repoId: repo.id,
      });
      setBranches(branchList);
      const defBranch = branchList.includes(repo.default_branch)
        ? repo.default_branch
        : branchList[0] || "main";
      setCurrentBranch(defBranch);
    } catch (err) {
      console.error("Ошибка загрузки веток:", err);
      setBranches([repo.default_branch]);
      setCurrentBranch(repo.default_branch);
    }
  }, [isTauri, user.email]);

  // Load directory tree
  const loadTree = useCallback(async () => {
    if (!isTauri || !selectedRepo) return;
    setTreeLoading(true);
    try {
      const items = await invoke<GitTreeItemDto[]>("get_repository_tree", {
        userEmail: user.email,
        repoId: selectedRepo.id,
        branch: currentBranch,
        path: currentPath,
      });
      setTreeItems(items);

      // Check if README.md exists in current path
      const readmeItem = items.find(
        (i) => i.item_type === "blob" && i.name.toLowerCase() === "readme.md"
      );
      if (readmeItem) {
        try {
          const fileData = await invoke<GitFileContentDto>("get_repository_file_content", {
            userEmail: user.email,
            repoId: selectedRepo.id,
            branch: currentBranch,
            filePath: readmeItem.path,
          });
          setReadmeContent(fileData.content);
        } catch {
          setReadmeContent(null);
        }
      } else {
        setReadmeContent(null);
      }
    } catch (err) {
      console.error("Ошибка загрузки файлов репозитория:", err);
      setTreeItems([]);
      setReadmeContent(null);
    } finally {
      setTreeLoading(false);
    }
  }, [isTauri, selectedRepo, user.email, currentBranch, currentPath]);

  // Load commits
  const loadCommits = useCallback(async () => {
    if (!isTauri || !selectedRepo) return;
    setCommitsLoading(true);
    try {
      const list = await invoke<GitCommitDto[]>("get_repository_commits", {
        userEmail: user.email,
        repoId: selectedRepo.id,
        branch: currentBranch,
        limit: 50,
      });
      setCommits(list);
    } catch (err) {
      console.error("Ошибка загрузки коммитов:", err);
      setCommits([]);
    } finally {
      setCommitsLoading(false);
    }
  }, [isTauri, selectedRepo, user.email, currentBranch]);

  useEffect(() => {
    if (selectedRepo) {
      if (activeRepoTab === "code" && !selectedFile) {
        loadTree();
      } else if (activeRepoTab === "commits") {
        loadCommits();
      }
    }
  }, [selectedRepo, activeRepoTab, currentBranch, currentPath, selectedFile, loadTree, loadCommits]);

  // View file
  const handleOpenFile = async (item: GitTreeItemDto) => {
    if (!isTauri || !selectedRepo) return;
    setFileLoading(true);
    try {
      const fileData = await invoke<GitFileContentDto>("get_repository_file_content", {
        userEmail: user.email,
        repoId: selectedRepo.id,
        branch: currentBranch,
        filePath: item.path,
      });
      setSelectedFile(fileData);
    } catch (err) {
      alert(`Не удалось открыть файл: ${err}`);
    } finally {
      setFileLoading(false);
    }
  };

  // Create repository
  const handleCreateRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepoName.trim()) {
      setCreateError("Укажите имя репозитория");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const created = await invoke<RepositoryDto>("create_server_repository", {
        userEmail: user.email,
        name: newRepoName.trim(),
        description: newRepoDesc.trim() || null,
        isPrivate: newRepoPrivate,
        initReadme: newRepoInitReadme,
      });
      setRepositories([created, ...repositories]);
      setShowCreateModal(false);
      setNewRepoName("");
      setNewRepoDesc("");
      setNewRepoPrivate(false);
      setNewRepoInitReadme(true);
      loadRepoDetails(created);
    } catch (err: unknown) {
      setCreateError(`${err}`);
    } finally {
      setCreating(false);
    }
  };

  // Update repository settings
  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepo) return;
    setUpdatingSettings(true);
    try {
      await invoke("update_server_repository", {
        userEmail: user.email,
        repoId: selectedRepo.id,
        description: editDesc,
        isPrivate: editPrivate,
      });
      const updated = {
        ...selectedRepo,
        description: editDesc,
        is_private: editPrivate,
      };
      setSelectedRepo(updated);
      setRepositories(repositories.map((r) => (r.id === updated.id ? updated : r)));
      alert("Настройки репозитория успешно сохранены!");
    } catch (err) {
      alert(`Ошибка обновления: ${err}`);
    } finally {
      setUpdatingSettings(false);
    }
  };

  // Delete repository
  const handleDeleteRepo = async () => {
    if (!selectedRepo) return;
    setDeleting(true);
    try {
      await invoke("delete_server_repository", {
        userEmail: user.email,
        repoId: selectedRepo.id,
      });
      setRepositories(repositories.filter((r) => r.id !== selectedRepo.id));
      setSelectedRepo(null);
      setShowDeleteModal(false);
    } catch (err) {
      alert(`Ошибка удаления: ${err}`);
    } finally {
      setDeleting(false);
    }
  };

  // Filtered repositories list
  const filteredRepos = useMemo(() => {
    return repositories.filter((repo) => {
      const matchSearch =
        repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (repo.description && repo.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        repo.owner_username.toLowerCase().includes(searchQuery.toLowerCase());

      if (filterType === "public") return matchSearch && !repo.is_private;
      if (filterType === "private") return matchSearch && repo.is_private;
      return matchSearch;
    });
  }, [repositories, searchQuery, filterType]);

  const totalPublic = repositories.filter((r) => !r.is_private).length;
  const totalPrivate = repositories.filter((r) => r.is_private).length;

  return (
    <div className="has-git-page">
      {/* ========================================================
          VIEW 1: REPOSITORY DETAILS (MINI GITHUB)
          ======================================================== */}
      {selectedRepo ? (
        <div className="has-git-repo-view">
          {/* Header & Breadcrumbs */}
          <div className="has-git-repo-header">
            <div className="has-git-breadcrumbs">
              <button
                type="button"
                className="has-git-back-btn"
                onClick={() => {
                  setSelectedRepo(null);
                  loadRepositories();
                }}
              >
                ← Репозитории
              </button>
              <span className="has-git-crumb-sep">/</span>
              <span className="has-git-crumb-owner">{selectedRepo.owner_username}</span>
              <span className="has-git-crumb-sep">/</span>
              <strong className="has-git-crumb-name">{selectedRepo.name}</strong>
              <span
                className={`has-git-badge-pill ${
                  selectedRepo.is_private ? "private" : "public"
                }`}
              >
                {selectedRepo.is_private ? "Private" : "Public"}
              </span>
            </div>

            {/* Quick Clone Dropdown */}
            <div className="has-git-header-actions">
              <button
                type="button"
                className="has-git-btn has-git-btn-secondary"
                onClick={() => setShowQuickStart(!showQuickStart)}
              >
                <CodeIcon className="w-4 h-4" />
                <span>Клонировать</span>
              </button>
            </div>
          </div>

          {/* Quick Start / Clone Instructions Box */}
          {showQuickStart && (
            <div className="has-git-quickstart-box">
              <div className="has-git-quickstart-header">
                <strong>Клонирование репозитория по SSH</strong>
                <button
                  type="button"
                  className="has-git-quickstart-close"
                  onClick={() => setShowQuickStart(false)}
                >
                  ✕
                </button>
              </div>

              <div className="has-git-clone-input-row">
                <input
                  type="text"
                  readOnly
                  value={selectedRepo.clone_url_ssh}
                  className="has-git-clone-input"
                />
                <button
                  type="button"
                  className="has-git-copy-btn"
                  onClick={() => copyToClipboard(selectedRepo.clone_url_ssh, "clone-ssh")}
                >
                  <CopyIcon className="w-4 h-4" />
                  <span>{copiedId === "clone-ssh" ? "Скопировано!" : "Копировать"}</span>
                </button>
              </div>

              <div className="has-git-quickstart-notes">
                <p><strong>Команды для подключения в терминале:</strong></p>
                <pre className="has-git-code-block">
{`# 1. Склонировать новый репозиторий:
git clone ${selectedRepo.clone_url_ssh}

# 2. Или подключить существующий локальный проект:
git remote add origin ${selectedRepo.clone_url_ssh}
git branch -M main
git push -u origin main`}
                </pre>
              </div>
            </div>
          )}

          {/* Repository Navigation Tabs */}
          <div className="has-git-tabs-bar">
            <button
              type="button"
              className={`has-git-tab ${activeRepoTab === "code" ? "active" : ""}`}
              onClick={() => {
                setActiveRepoTab("code");
                setSelectedFile(null);
              }}
            >
              <CodeIcon className="w-4 h-4" />
              <span>Код (Файлы)</span>
            </button>

            <button
              type="button"
              className={`has-git-tab ${activeRepoTab === "commits" ? "active" : ""}`}
              onClick={() => setActiveRepoTab("commits")}
            >
              <GitCommitIcon className="w-4 h-4" />
              <span>Коммиты ({selectedRepo.commits_count})</span>
            </button>

            <button
              type="button"
              className={`has-git-tab ${activeRepoTab === "branches" ? "active" : ""}`}
              onClick={() => setActiveRepoTab("branches")}
            >
              <GitBranchIcon className="w-4 h-4" />
              <span>Ветки ({branches.length})</span>
            </button>

            <button
              type="button"
              className={`has-git-tab ${activeRepoTab === "settings" ? "active" : ""}`}
              onClick={() => setActiveRepoTab("settings")}
            >
              <span>Настройки</span>
            </button>
          </div>

          {/* TAB 1: CODE & FILE VIEWER */}
          {activeRepoTab === "code" && (
            <div className="has-git-code-view">
              {/* Branch & Path Bar */}
              <div className="has-git-file-toolbar">
                <div className="has-git-branch-select-wrap">
                  <GitBranchIcon className="w-4 h-4" />
                  <select
                    className="has-git-branch-select"
                    value={currentBranch}
                    onChange={(e) => setCurrentBranch(e.target.value)}
                  >
                    {branches.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Path Navigation */}
                <div className="has-git-path-nav">
                  <button
                    type="button"
                    className="has-git-path-item"
                    onClick={() => {
                      setCurrentPath("");
                      setSelectedFile(null);
                    }}
                  >
                    {selectedRepo.name}
                  </button>
                  {currentPath.split("/").filter(Boolean).map((part, idx, arr) => {
                    const sub = arr.slice(0, idx + 1).join("/");
                    return (
                      <span key={sub} className="has-git-path-segment">
                        <span className="has-git-crumb-sep">/</span>
                        <button
                          type="button"
                          className="has-git-path-item"
                          onClick={() => {
                            setCurrentPath(sub);
                            setSelectedFile(null);
                          }}
                        >
                          {part}
                        </button>
                      </span>
                    );
                  })}
                  {selectedFile && (
                    <span className="has-git-path-segment">
                      <span className="has-git-crumb-sep">/</span>
                      <strong className="has-git-path-active">{selectedFile.name}</strong>
                    </span>
                  )}
                </div>

                <div className="has-git-toolbar-spacer" />
                <span className="has-git-repo-size-label">Размер: {selectedRepo.size_formatted}</span>
              </div>

              {/* SINGLE FILE VIEW */}
              {selectedFile ? (
                <div className="has-git-file-display-card">
                  <div className="has-git-file-display-header">
                    <div className="has-git-file-meta">
                      <strong>{selectedFile.name}</strong>
                      <span className="has-git-file-size">({selectedFile.size_formatted})</span>
                    </div>
                    <div className="has-git-file-header-actions">
                      <button
                        type="button"
                        className="has-git-btn has-git-btn-secondary"
                        onClick={() => copyToClipboard(selectedFile.content, "file-code")}
                      >
                        <CopyIcon className="w-4 h-4" />
                        <span>{copiedId === "file-code" ? "Скопировано" : "Копировать"}</span>
                      </button>
                      <button
                        type="button"
                        className="has-git-btn has-git-btn-secondary"
                        onClick={() => setSelectedFile(null)}
                      >
                        Закрыть файл
                      </button>
                    </div>
                  </div>
                  {fileLoading ? (
                    <div className="has-git-loading-state">Загрузка файла...</div>
                  ) : (
                    <pre className="has-git-code-content">
                      <code>{selectedFile.content}</code>
                    </pre>
                  )}
                </div>
              ) : (
                /* DIRECTORY LISTING */
                <div className="has-git-tree-table-wrap">
                  {treeLoading ? (
                    <div className="has-git-loading-state">Чтение файлов репозитория...</div>
                  ) : treeItems.length === 0 ? (
                    <div className="has-git-empty-tree">
                      <GitRepoIcon className="w-12 h-12" width={48} height={48} />
                      <h3>Репозиторий пуст</h3>
                      <p>В этой ветке пока нет закоммиченных файлов.</p>
                      <button
                        type="button"
                        className="has-git-btn has-git-btn-primary"
                        onClick={() => setShowQuickStart(true)}
                      >
                        Инструкция по отправке первого коммита
                      </button>
                    </div>
                  ) : (
                    <table className="has-git-tree-table">
                      <thead>
                        <tr>
                          <th className="has-git-th-name">Имя</th>
                          <th className="has-git-th-msg">Последний коммит</th>
                          <th className="has-git-th-date">Дата</th>
                          <th className="has-git-th-size">Размер</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentPath && (
                          <tr
                            className="has-git-tree-row has-git-parent-dir"
                            onClick={() => {
                              const parent = currentPath.split("/").slice(0, -1).join("/");
                              setCurrentPath(parent);
                            }}
                          >
                            <td colSpan={4} className="has-git-td-parent">
                              📁 .. (наверх)
                            </td>
                          </tr>
                        )}
                        {treeItems.map((item) => (
                          <tr
                            key={item.path}
                            className="has-git-tree-row"
                            onClick={() => {
                              if (item.item_type === "tree") {
                                setCurrentPath(item.path);
                              } else {
                                handleOpenFile(item);
                              }
                            }}
                          >
                            <td className="has-git-td-name">
                              <span className="has-git-item-icon">
                                {item.item_type === "tree" ? (
                                  <FolderIcon className="w-4 h-4 text-yellow" />
                                ) : (
                                  <FileIcon className="w-4 h-4 text-blue" />
                                )}
                              </span>
                              <span className="has-git-item-name">{item.name}</span>
                            </td>
                            <td className="has-git-td-msg">
                              {item.last_commit_msg || "—"}
                            </td>
                            <td className="has-git-td-date">
                              {item.last_commit_date || "—"}
                            </td>
                            <td className="has-git-td-size">
                              {item.size_formatted || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* README.md PREVIEW (IF PRESENT) */}
              {!selectedFile && readmeContent && (
                <div className="has-git-readme-card">
                  <div className="has-git-readme-header">
                    <FileIcon className="w-4 h-4" />
                    <strong>README.md</strong>
                  </div>
                  <div className="has-git-readme-body">
                    <pre className="has-git-readme-text">{readmeContent}</pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: COMMITS */}
          {activeRepoTab === "commits" && (
            <div className="has-git-commits-view">
              {commitsLoading ? (
                <div className="has-git-loading-state">Загрузка коммитов...</div>
              ) : commits.length === 0 ? (
                <div className="has-git-empty-commits">
                  <GitCommitIcon className="w-8 h-8" width={32} height={32} />
                  <p>В этой ветке пока нет коммитов.</p>
                </div>
              ) : (
                <div className="has-git-commits-list">
                  {commits.map((c) => (
                    <div key={c.hash} className="has-git-commit-card">
                      <div className="has-git-commit-left">
                        <GitCommitIcon className="w-5 h-5 text-accent" />
                        <div className="has-git-commit-info">
                          <strong className="has-git-commit-title">{c.message}</strong>
                          <div className="has-git-commit-sub">
                            <span className="has-git-commit-author">{c.author_name}</span>
                            <span className="has-git-commit-dot">•</span>
                            <span className="has-git-commit-time">{c.date}</span>
                          </div>
                        </div>
                      </div>
                      <div className="has-git-commit-right">
                        <code className="has-git-commit-sha">{c.short_hash}</code>
                        <button
                          type="button"
                          className="has-git-btn-icon"
                          title="Скопировать полный SHA"
                          onClick={() => copyToClipboard(c.hash, `sha-${c.hash}`)}
                        >
                          <CopyIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: BRANCHES */}
          {activeRepoTab === "branches" && (
            <div className="has-git-branches-view">
              <div className="has-git-branches-card">
                <h3>Ветки репозитория</h3>
                <div className="has-git-branches-list">
                  {branches.map((b) => (
                    <div key={b} className="has-git-branch-item">
                      <div className="has-git-branch-info">
                        <GitBranchIcon className="w-4 h-4" />
                        <strong>{b}</strong>
                        {b === selectedRepo.default_branch && (
                          <span className="has-git-badge-pill default">По умолчанию</span>
                        )}
                      </div>
                      {b !== currentBranch && (
                        <button
                          type="button"
                          className="has-git-btn has-git-btn-secondary"
                          onClick={() => {
                            setCurrentBranch(b);
                            setActiveRepoTab("code");
                          }}
                        >
                          Переключиться
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SETTINGS */}
          {activeRepoTab === "settings" && (
            <div className="has-git-settings-view">
              <div className="has-git-settings-card">
                <h3>Основные настройки</h3>
                <form onSubmit={handleUpdateSettings}>
                  <div className="has-git-form-group">
                    <label>Описание репозитория</label>
                    <input
                      type="text"
                      className="has-git-input"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="Краткое описание назначения проекта"
                    />
                  </div>

                  <div className="has-git-form-group">
                    <label>Видимость (Приватность)</label>
                    <div className="has-git-radio-group">
                      <label className="has-git-radio-label">
                        <input
                          type="radio"
                          name="edit-privacy"
                          checked={!editPrivate}
                          onChange={() => setEditPrivate(false)}
                        />
                        <span><strong>Public</strong> — репозиторий доступен для чтения всем пользователям сервера</span>
                      </label>
                      <label className="has-git-radio-label">
                        <input
                          type="radio"
                          name="edit-privacy"
                          checked={editPrivate}
                          onChange={() => setEditPrivate(true)}
                        />
                        <span><strong>Private</strong> — репозиторий доступен только вам</span>
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="has-git-btn has-git-btn-primary"
                    disabled={updatingSettings}
                  >
                    {updatingSettings ? "Сохранение..." : "Сохранить изменения"}
                  </button>
                </form>
              </div>

              {/* Danger Zone */}
              <div className="has-git-danger-card">
                <h3>Опасная зона</h3>
                <p>Удаление репозитория безвозвратно сотрет все ветки, коммиты и файлы с сервера.</p>
                <button
                  type="button"
                  className="has-git-btn has-git-btn-danger"
                  onClick={() => setShowDeleteModal(true)}
                >
                  <TrashIcon className="w-4 h-4" />
                  <span>Удалить этот репозиторий</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ========================================================
           VIEW 2: ALL REPOSITORIES LIST
           ======================================================== */
        <div className="has-git-list-view">
          {/* Top Bar Header */}
          <div className="has-git-topbar">
            <div>
              <h1 className="has-git-title">Git Репозитории</h1>
              <p className="has-git-subtitle">
                Ваш личный сервер контроля версий на VPS (быстрый доступ без блокировок и сбоев)
              </p>
            </div>

            <div className="has-git-topbar-actions">
              <button
                type="button"
                className="has-git-btn has-git-btn-secondary"
                onClick={loadRepositories}
                title="Обновить список"
              >
                <RefreshIcon className="w-4 h-4" />
              </button>

              <button
                type="button"
                className="has-git-btn has-git-btn-primary"
                onClick={() => setShowCreateModal(true)}
              >
                + Новый репозиторий
              </button>
            </div>
          </div>

          {/* Quick Stats Banner */}
          <div className="has-git-stats-banner">
            <div className="has-git-stat-card">
              <span className="has-git-stat-num">{repositories.length}</span>
              <span className="has-git-stat-label">Всего репозиториев</span>
            </div>
            <div className="has-git-stat-card">
              <span className="has-git-stat-num">{totalPublic}</span>
              <span className="has-git-stat-label">Публичных</span>
            </div>
            <div className="has-git-stat-card">
              <span className="has-git-stat-num">{totalPrivate}</span>
              <span className="has-git-stat-label">Приватных</span>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="has-git-filter-bar">
            <div className="has-git-search-box">
              <SearchIcon className="w-4 h-4 text-muted" />
              <input
                type="text"
                placeholder="Поиск репозиториев по названию или описанию..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="has-git-search-input"
              />
            </div>

            <div className="has-git-pills-group">
              <button
                type="button"
                className={`has-git-pill ${filterType === "all" ? "active" : ""}`}
                onClick={() => setFilterType("all")}
              >
                Все ({repositories.length})
              </button>
              <button
                type="button"
                className={`has-git-pill ${filterType === "public" ? "active" : ""}`}
                onClick={() => setFilterType("public")}
              >
                Public ({totalPublic})
              </button>
              <button
                type="button"
                className={`has-git-pill ${filterType === "private" ? "active" : ""}`}
                onClick={() => setFilterType("private")}
              >
                Private ({totalPrivate})
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && <div className="has-git-error-banner">{error}</div>}

          {/* Repositories Grid */}
          {loading ? (
            <div className="has-git-loading-state">Загрузка репозиториев с сервера...</div>
          ) : filteredRepos.length === 0 ? (
            <div className="has-git-empty-card">
              <GitRepoIcon className="w-16 h-16 text-muted" width={64} height={64} />
              <h3>Репозитории не найдены</h3>
              <p>Создайте свой первый Git-репозиторий на сервере прямо сейчас.</p>
              <button
                type="button"
                className="has-git-btn has-git-btn-primary"
                onClick={() => setShowCreateModal(true)}
              >
                + Создать репозиторий
              </button>
            </div>
          ) : (
            <div className="has-git-grid">
              {filteredRepos.map((repo) => (
                <div
                  key={repo.id}
                  className="has-git-repo-card"
                  onClick={() => loadRepoDetails(repo)}
                >
                  <div className="has-git-repo-card-top">
                    <div className="has-git-repo-card-title-group">
                      <GitRepoIcon className="w-5 h-5 text-accent" />
                      <span className="has-git-repo-card-name">{repo.name}</span>
                      <span
                        className={`has-git-badge-pill ${
                          repo.is_private ? "private" : "public"
                        }`}
                      >
                        {repo.is_private ? "Private" : "Public"}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="has-git-btn-icon"
                      title="Скопировать SSH ссылку для клонирования"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(repo.clone_url_ssh, `repo-${repo.id}`);
                      }}
                    >
                      <CopyIcon className="w-4 h-4" />
                      {copiedId === `repo-${repo.id}` && (
                        <span className="has-git-copied-badge">Скопировано!</span>
                      )}
                    </button>
                  </div>

                  <p className="has-git-repo-card-desc">
                    {repo.description || "Нет описания"}
                  </p>

                  <div className="has-git-repo-card-meta">
                    <div className="has-git-meta-left">
                      <span className="has-git-meta-item">
                        <GitBranchIcon className="w-3.5 h-3.5" />
                        {repo.default_branch}
                      </span>
                      <span className="has-git-meta-item">
                        <GitCommitIcon className="w-3.5 h-3.5" />
                        {repo.commits_count} коммитов
                      </span>
                      <span className="has-git-meta-item">
                        {repo.size_formatted}
                      </span>
                    </div>
                    <span className="has-git-meta-time">
                      Обновлен {repo.updated_at}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          CREATE REPOSITORY MODAL
          ======================================================== */}
      {showCreateModal && (
        <div className="has-git-modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="has-git-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="has-git-modal-header">
              <h2>Создание нового репозитория</h2>
              <button
                type="button"
                className="has-git-modal-close"
                onClick={() => setShowCreateModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRepo} className="has-git-modal-form">
              {createError && <div className="has-git-error-banner">{createError}</div>}

              <div className="has-git-form-group">
                <label>
                  Имя репозитория <span className="text-danger">*</span>
                </label>
                <div className="has-git-name-preview-row">
                  <span className="has-git-prefix">{user.username || user.email.split("@")[0]} /</span>
                  <input
                    type="text"
                    required
                    placeholder="my-awesome-project"
                    value={newRepoName}
                    onChange={(e) => setNewRepoName(e.target.value)}
                    className="has-git-input has-git-name-input"
                    autoFocus
                  />
                </div>
                <small className="has-git-hint">
                  Разрешены латинские буквы, цифры, дефис и подчеркивание.
                </small>
              </div>

              <div className="has-git-form-group">
                <label>Описание (необязательно)</label>
                <input
                  type="text"
                  placeholder="Краткое описание проекта"
                  value={newRepoDesc}
                  onChange={(e) => setNewRepoDesc(e.target.value)}
                  className="has-git-input"
                />
              </div>

              <div className="has-git-form-group">
                <label>Видимость</label>
                <div className="has-git-radio-group">
                  <label className="has-git-radio-label">
                    <input
                      type="radio"
                      name="repo-privacy"
                      checked={!newRepoPrivate}
                      onChange={() => setNewRepoPrivate(false)}
                    />
                    <div>
                      <strong>Public (Публичный)</strong>
                      <div className="has-git-radio-desc">
                        Любой пользователь вашего сервера может просматривать этот репозиторий.
                      </div>
                    </div>
                  </label>

                  <label className="has-git-radio-label">
                    <input
                      type="radio"
                      name="repo-privacy"
                      checked={newRepoPrivate}
                      onChange={() => setNewRepoPrivate(true)}
                    />
                    <div>
                      <strong>Private (Приватный)</strong>
                      <div className="has-git-radio-desc">
                        Репозиторий виден только вам.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="has-git-form-group">
                <label className="has-git-checkbox-label">
                  <input
                    type="checkbox"
                    checked={newRepoInitReadme}
                    onChange={(e) => setNewRepoInitReadme(e.target.checked)}
                  />
                  <span>Инициализировать репозиторий файлом <strong>README.md</strong></span>
                </label>
              </div>

              <div className="has-git-modal-footer">
                <button
                  type="button"
                  className="has-git-btn has-git-btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="has-git-btn has-git-btn-primary"
                  disabled={creating}
                >
                  {creating ? "Создание на сервере..." : "Создать репозиторий"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          DELETE CONFIRMATION MODAL
          ======================================================== */}
      {showDeleteModal && selectedRepo && (
        <div className="has-git-modal-backdrop" onClick={() => setShowDeleteModal(false)}>
          <div className="has-git-modal-card danger-modal" onClick={(e) => e.stopPropagation()}>
            <div className="has-git-modal-header">
              <h2>Удалить репозиторий?</h2>
              <button
                type="button"
                className="has-git-modal-close"
                onClick={() => setShowDeleteModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="has-git-modal-body">
              <p>
                Вы действительно хотите удалить репозиторий{" "}
                <strong>{selectedRepo.name}</strong>?
              </p>
              <p className="text-danger">
                Это действие невозможно отменить. Все коммиты, ветки и файлы будут полностью удалены с сервера.
              </p>
            </div>

            <div className="has-git-modal-footer">
              <button
                type="button"
                className="has-git-btn has-git-btn-secondary"
                onClick={() => setShowDeleteModal(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="has-git-btn has-git-btn-danger"
                disabled={deleting}
                onClick={handleDeleteRepo}
              >
                {deleting ? "Удаление..." : "Да, удалить репозиторий"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
