import React, { useState, useEffect, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  UserDto,
  NoteSummaryDto,
  NoteDetailDto,
  NoteSaveDto,
  NotesStatsDto,
  ParaFolder,
  NoteType,
  NoteStatus,
} from "../../types";
import {
  BrainNavIcon,
  SearchIcon,
  TagIcon,
  SparklesIcon,
  TrashIcon,
  RefreshIcon,
} from "../../components/Icons";
import "./SecondBrain.css";

interface SecondBrainProps {
  user: UserDto;
}

const PARA_FOLDERS: { id: ParaFolder; label: string; desc: string; icon: string }[] = [
  { id: "00_Inbox", label: "00_Inbox", desc: "Входящие мысли, сырые идеи и черновики", icon: "📥" },
  { id: "01_Projects", label: "01_Projects", desc: "Активные проекты с целями и дедлайнами", icon: "🚀" },
  { id: "02_Areas", label: "02_Areas", desc: "Постоянные сферы ответственности", icon: "🧭" },
  { id: "03_Resources", label: "03_Resources", desc: "Справочники, сниппеты, конспекты и статьи", icon: "📚" },
  { id: "04_Archive", label: "04_Archive", desc: "Завершённые проекты и архивные материалы", icon: "📦" },
];

function generateDefaultTemplate(title: string, folder: ParaFolder): string {
  const today = new Date().toISOString().split("T")[0];
  let noteType: NoteType = "inbox";
  if (folder === "01_Projects") noteType = "project";
  else if (folder === "02_Areas") noteType = "area";
  else if (folder === "03_Resources") noteType = "resource";
  else if (folder === "04_Archive") noteType = "archive";

  return `---
title: "${title}"
date: ${today}
type: ${noteType}
tags:
  - note
status: draft
links: []
---

# ${title}

## Краткая суть (1-2 предложения)
Краткое описание ключевой идеи заметки.

## Основное содержание
Здесь вы можете описать структурированный текст, тезисы и блоки кода.

## Связанные заметки и ссылки
- [[Начало работы]]

## Задачи (если применимо)
- [ ] Ознакомиться с материалом
- [ ] Сделать практическое применение
`;
}

export default function SecondBrain({ user }: SecondBrainProps) {
  // Navigation & filter state
  const [selectedFolder, setSelectedFolder] = useState<ParaFolder | "all">("all");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [notes, setNotes] = useState<NoteSummaryDto[]>([]);
  const [stats, setStats] = useState<NotesStatsDto | null>(null);
  const [loadingList, setLoadingList] = useState(false);

  // Active note state
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null);
  const [activeNote, setActiveNote] = useState<NoteDetailDto | null>(null);
  const [noteLoading, setNoteLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"edit" | "preview" | "split">("split");

  // Form / Edit state
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState<ParaFolder>("00_Inbox");
  const [noteType, setNoteType] = useState<NoteType>("inbox");
  const [status, setStatus] = useState<NoteStatus>("draft");
  const [tagsInput, setTagsInput] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // AI Structuring Modal
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiRawInput, setAiRawInput] = useState("");
  const [aiProcessing, setAiProcessing] = useState(false);

  // Delete confirm modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  // Load stats
  const loadStats = useCallback(async () => {
    if (!isTauri) return;
    try {
      const s = await invoke<NotesStatsDto>("get_notes_stats", {
        userEmail: user.email,
      });
      setStats(s);
    } catch (err) {
      console.error("Ошибка загрузки статистики заметок:", err);
    }
  }, [isTauri, user.email]);

  // Load notes list
  const loadNotes = useCallback(async () => {
    if (!isTauri) return;
    setLoadingList(true);
    try {
      const res = await invoke<NoteSummaryDto[]>("list_server_notes", {
        userEmail: user.email,
        folder: selectedFolder === "all" ? null : selectedFolder,
        tag: selectedTag,
        search: searchQuery.trim() || null,
      });
      setNotes(res);
      loadStats();
    } catch (err) {
      console.error("Ошибка загрузки заметок:", err);
    } finally {
      setLoadingList(false);
    }
  }, [isTauri, user.email, selectedFolder, selectedTag, searchQuery, loadStats]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // Open note by id
  const openNote = useCallback(async (id: number) => {
    if (!isTauri) return;
    setNoteLoading(true);
    try {
      const detail = await invoke<NoteDetailDto>("get_server_note_by_id", {
        userEmail: user.email,
        noteId: id,
      });
      setActiveNoteId(id);
      setActiveNote(detail);
      setTitle(detail.title);
      setFolder(detail.folder);
      setNoteType(detail.note_type);
      setStatus(detail.status);
      setTagsInput(detail.tags.join(", "));
      setSummary(detail.summary || "");
      setContent(detail.content);
      setDirty(false);
    } catch (err) {
      alert(`Не удалось открыть заметку: ${err}`);
    } finally {
      setNoteLoading(false);
    }
  }, [isTauri, user.email]);

  // Create new note
  const createNewNote = (targetFolder: ParaFolder = "00_Inbox") => {
    const newTitle = "Новая заметка";
    const defaultBody = generateDefaultTemplate(newTitle, targetFolder);

    setActiveNoteId(null);
    setActiveNote(null);
    setTitle(newTitle);
    setFolder(targetFolder);
    setNoteType(
      targetFolder === "01_Projects" ? "project" :
      targetFolder === "02_Areas" ? "area" :
      targetFolder === "03_Resources" ? "resource" :
      targetFolder === "04_Archive" ? "archive" : "inbox"
    );
    setStatus("draft");
    setTagsInput("note");
    setSummary("");
    setContent(defaultBody);
    setDirty(true);
    setViewMode("edit");
  };

  // Save note
  const handleSaveNote = async () => {
    if (!isTauri) return;
    if (!title.trim()) {
      alert("Укажите заголовок заметки");
      return;
    }
    setSaving(true);
    try {
      const parsedTags = tagsInput
        .split(",")
        .map((t) => t.trim().replace(/^#/, ""))
        .filter(Boolean);

      const payload: NoteSaveDto = {
        id: activeNoteId,
        title: title.trim(),
        folder,
        note_type: noteType,
        status,
        tags: parsedTags,
        links: [],
        summary: summary.trim() || null,
        content,
      };

      const saved = await invoke<NoteDetailDto>("save_server_note", {
        userEmail: user.email,
        note: payload,
      });

      setActiveNoteId(saved.id);
      setActiveNote(saved);
      setDirty(false);
      loadNotes();
    } catch (err) {
      alert(`Ошибка сохранения заметки: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  // Delete note
  const handleDeleteNote = async () => {
    if (!isTauri || !activeNoteId) return;
    setDeleting(true);
    try {
      await invoke("delete_server_note", {
        userEmail: user.email,
        noteId: activeNoteId,
      });
      setShowDeleteModal(false);
      setActiveNoteId(null);
      setActiveNote(null);
      loadNotes();
    } catch (err) {
      alert(`Ошибка удаления: ${err}`);
    } finally {
      setDeleting(false);
    }
  };

  // Clickable checkbox in preview
  const handleToggleCheckbox = (lineIndex: number, currentChecked: boolean) => {
    const lines = content.split("\n");
    if (lines[lineIndex] !== undefined) {
      const line = lines[lineIndex];
      if (currentChecked) {
        lines[lineIndex] = line.replace("- [x]", "- [ ]").replace("- [X]", "- [ ]");
      } else {
        lines[lineIndex] = line.replace("- [ ]", "- [x]");
      }
      const newContent = lines.join("\n");
      setContent(newContent);
      setDirty(true);

      // Auto-save checkbox change if existing note
      if (activeNoteId) {
        const parsedTags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
        invoke("save_server_note", {
          userEmail: user.email,
          note: {
            id: activeNoteId,
            title,
            folder,
            note_type: noteType,
            status,
            tags: parsedTags,
            links: [],
            summary: summary.trim() || null,
            content: newContent,
          },
        }).then(() => {
          loadNotes();
        });
      }
    }
  };

  // Click wiki-link [[Title]]
  const handleWikiLinkClick = (targetTitle: string) => {
    const clean = targetTitle.trim();
    const found = notes.find((n) => n.title.toLowerCase() === clean.toLowerCase());
    if (found) {
      openNote(found.id);
    } else {
      if (confirm(`Заметка «${clean}» ещё не существует. Создать её сейчас?`)) {
        const newBody = generateDefaultTemplate(clean, "00_Inbox");
        setActiveNoteId(null);
        setActiveNote(null);
        setTitle(clean);
        setFolder("00_Inbox");
        setNoteType("inbox");
        setStatus("draft");
        setTagsInput("note");
        setSummary("");
        setContent(newBody);
        setDirty(true);
        setViewMode("edit");
      }
    }
  };

  // AI Structuring feature (Section 4 of user spec)
  const handleAiStructure = () => {
    if (!aiRawInput.trim()) return;
    setAiProcessing(true);

    const raw = aiRawInput.trim();
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    const firstLine = lines[0] || "Новая мысль";
    const candidateTitle = firstLine.replace(/^[#*-]\s*/, "").slice(0, 60).trim();

    // Determine folder by keywords
    let autoFolder: ParaFolder = "00_Inbox";
    let autoType: NoteType = "inbox";
    const lower = raw.toLowerCase();

    if (lower.includes("проект") || lower.includes("дедлайн") || lower.includes("задача") || lower.includes("сделать к")) {
      autoFolder = "01_Projects";
      autoType = "project";
    } else if (lower.includes("финансы") || lower.includes("здоровье") || lower.includes("сервер") || lower.includes("кодинг") || lower.includes("linux")) {
      autoFolder = "02_Areas";
      autoType = "area";
    } else if (lower.includes("шпаргалка") || lower.includes("сниппет") || lower.includes("конспект") || lower.includes("документация") || lower.includes("http")) {
      autoFolder = "03_Resources";
      autoType = "resource";
    }

    const today = new Date().toISOString().split("T")[0];

    // Extract potential tasks
    const tasks: string[] = [];
    const contentLines: string[] = [];

    lines.forEach((l) => {
      const trimmed = l.trim();
      if (trimmed.startsWith("- [ ]") || trimmed.startsWith("- [x]")) {
        tasks.push(trimmed);
      } else if (trimmed.toLowerCase().startsWith("надо ") || trimmed.toLowerCase().startsWith("нужно ") || trimmed.toLowerCase().startsWith("купить ") || trimmed.toLowerCase().startsWith("сделать ")) {
        tasks.push(`- [ ] ${trimmed}`);
      } else {
        contentLines.push(l);
      }
    });

    const structuredMarkdown = `---
title: "${candidateTitle}"
date: ${today}
type: ${autoType}
tags:
  - second-brain
  - ai-parsed
status: in-progress
links: []
---

# ${candidateTitle}

## Краткая суть (1-2 предложения)
${lines[1] ? lines[1].slice(0, 160) : candidateTitle}

## Основное содержание
${contentLines.length > 0 ? contentLines.join("\n\n") : raw}

## Связанные заметки и ссылки
- [[${candidateTitle}]]

## Задачи (если применимо)
${tasks.length > 0 ? tasks.join("\n") : "- [ ] Обработать информацию"}
`;

    setTitle(candidateTitle);
    setFolder(autoFolder);
    setNoteType(autoType);
    setStatus("in-progress");
    setTagsInput("second-brain, ai-parsed");
    setSummary(lines[1] ? lines[1].slice(0, 120) : candidateTitle);
    setContent(structuredMarkdown);
    setDirty(true);
    setViewMode("split");

    setAiProcessing(false);
    setShowAiModal(false);
    setAiRawInput("");
  };

  // Keyboard shortcut Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSaveNote();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Render markdown parser for preview
  const renderedPreview = useMemo(() => {
    const lines = content.split("\n");
    let inYaml = false;
    let inCodeBlock = false;
    let codeLanguage = "";
    let codeBuffer: string[] = [];

    const elements: React.ReactNode[] = [];

    lines.forEach((line, idx) => {
      // Handle YAML frontmatter
      if (idx === 0 && line.trim() === "---") {
        inYaml = true;
        return;
      }
      if (inYaml) {
        if (line.trim() === "---") {
          inYaml = false;
        }
        return;
      }

      // Handle Code Blocks
      if (line.trim().startsWith("```")) {
        if (inCodeBlock) {
          elements.push(
            <div key={`code-${idx}`} className="has-sb-code-block">
              {codeLanguage && <div className="has-sb-code-lang">{codeLanguage}</div>}
              <pre><code>{codeBuffer.join("\n")}</code></pre>
            </div>
          );
          codeBuffer = [];
          inCodeBlock = false;
          codeLanguage = "";
        } else {
          inCodeBlock = true;
          codeLanguage = line.trim().slice(3).trim();
        }
        return;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
        return;
      }

      const trimmed = line.trim();

      // Headings
      if (trimmed.startsWith("# ")) {
        elements.push(<h1 key={idx} className="has-sb-h1">{parseWikiLinks(trimmed.slice(2), handleWikiLinkClick)}</h1>);
      } else if (trimmed.startsWith("## ")) {
        elements.push(<h2 key={idx} className="has-sb-h2">{parseWikiLinks(trimmed.slice(3), handleWikiLinkClick)}</h2>);
      } else if (trimmed.startsWith("### ")) {
        elements.push(<h3 key={idx} className="has-sb-h3">{parseWikiLinks(trimmed.slice(4), handleWikiLinkClick)}</h3>);
      } else if (trimmed.startsWith("- [ ] ") || trimmed.startsWith("- [x] ") || trimmed.startsWith("- [X] ")) {
        const isChecked = trimmed.startsWith("- [x] ") || trimmed.startsWith("- [X] ");
        const text = trimmed.slice(6);
        elements.push(
          <div key={idx} className={`has-sb-task-item ${isChecked ? "completed" : ""}`}>
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => handleToggleCheckbox(idx, isChecked)}
              className="has-sb-checkbox"
            />
            <span>{parseWikiLinks(text, handleWikiLinkClick)}</span>
          </div>
        );
      } else if (trimmed.startsWith("- ")) {
        elements.push(
          <li key={idx} className="has-sb-list-item">
            {parseWikiLinks(trimmed.slice(2), handleWikiLinkClick)}
          </li>
        );
      } else if (trimmed === "") {
        elements.push(<div key={idx} className="has-sb-spacing" />);
      } else {
        elements.push(
          <p key={idx} className="has-sb-paragraph">
            {parseWikiLinks(line, handleWikiLinkClick)}
          </p>
        );
      }
    });

    return elements;
  }, [content]);

  return (
    <div className="has-sb-page">
      {/* ========================================================
          LEFT COLUMN: PARA FOLDERS & TAGS
          ======================================================== */}
      <aside className="has-sb-sidebar">
        <div className="has-sb-sidebar-top">
          <div className="has-sb-brand">
            <BrainNavIcon className="w-5 h-5 text-indigo" />
            <span className="has-sb-brand-title">Second Brain</span>
          </div>
          <button
            type="button"
            className="has-sb-btn-new"
            onClick={() => createNewNote(selectedFolder === "all" ? "00_Inbox" : selectedFolder)}
          >
            + Заметка
          </button>
        </div>

        {/* AI Structuring Action Button */}
        <div className="has-sb-ai-promo">
          <button
            type="button"
            className="has-sb-ai-trigger"
            onClick={() => setShowAiModal(true)}
          >
            <SparklesIcon className="w-4 h-4 text-amber" />
            <span>AI Структуризатор</span>
          </button>
        </div>

        {/* PARA Folders Navigation */}
        <div className="has-sb-section-label">СТРУКТУРА (PARA)</div>
        <div className="has-sb-folder-list">
          <button
            type="button"
            className={`has-sb-folder-item ${selectedFolder === "all" ? "active" : ""}`}
            onClick={() => {
              setSelectedFolder("all");
              setSelectedTag(null);
            }}
          >
            <span className="has-sb-folder-icon">📂</span>
            <span className="has-sb-folder-name">Все заметки</span>
            <span className="has-sb-folder-badge">{stats?.total_notes ?? notes.length}</span>
          </button>

          {PARA_FOLDERS.map((f) => {
            let count = 0;
            if (stats) {
              if (f.id === "00_Inbox") count = stats.inbox_count;
              else if (f.id === "01_Projects") count = stats.projects_count;
              else if (f.id === "02_Areas") count = stats.areas_count;
              else if (f.id === "03_Resources") count = stats.resources_count;
              else if (f.id === "04_Archive") count = stats.archive_count;
            }
            return (
              <button
                key={f.id}
                type="button"
                className={`has-sb-folder-item ${selectedFolder === f.id ? "active" : ""}`}
                onClick={() => {
                  setSelectedFolder(f.id);
                  setSelectedTag(null);
                }}
                title={f.desc}
              >
                <span className="has-sb-folder-icon">{f.icon}</span>
                <span className="has-sb-folder-name">{f.label}</span>
                <span className="has-sb-folder-badge">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Tags List */}
        {stats && stats.all_tags.length > 0 && (
          <div className="has-sb-tags-section">
            <div className="has-sb-section-label">ТЕГИ</div>
            <div className="has-sb-tag-cloud">
              {stats.all_tags.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`has-sb-tag-pill ${selectedTag === t ? "active" : ""}`}
                  onClick={() => setSelectedTag(selectedTag === t ? null : t)}
                >
                  <TagIcon className="w-3 h-3" />
                  <span>#{t}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* ========================================================
          MIDDLE COLUMN: NOTES LIST & SEARCH
          ======================================================== */}
      <section className="has-sb-notes-list-col">
        <div className="has-sb-search-header">
          <div className="has-sb-search-input-wrap">
            <SearchIcon className="w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder="Поиск по заметкам, тегам и тексту..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="has-sb-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="has-sb-search-clear"
                onClick={() => setSearchQuery("")}
              >
                ✕
              </button>
            )}
          </div>
          <button
            type="button"
            className="has-sb-icon-btn"
            onClick={loadNotes}
            title="Обновить список"
          >
            <RefreshIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Notes Items List */}
        <div className="has-sb-cards-scroller">
          {loadingList ? (
            <div className="has-sb-empty-state">Загрузка базы знаний...</div>
          ) : notes.length === 0 ? (
            <div className="has-sb-empty-state">
              <span style={{ fontSize: "32px", display: "block", marginBottom: "8px" }}>📝</span>
              <strong>Заметок пока нет</strong>
              <p>Создайте первую заметку или используйте AI Структуризатор для быстрой мысли.</p>
              <button
                type="button"
                className="has-sb-btn-new"
                style={{ marginTop: "12px" }}
                onClick={() => createNewNote(selectedFolder === "all" ? "00_Inbox" : selectedFolder)}
              >
                + Создать заметку
              </button>
            </div>
          ) : (
            notes.map((n) => {
              const isActive = activeNoteId === n.id;
              return (
                <div
                  key={n.id}
                  className={`has-sb-note-card ${isActive ? "active" : ""}`}
                  onClick={() => openNote(n.id)}
                >
                  <div className="has-sb-note-card-top">
                    <strong className="has-sb-note-card-title">{n.title}</strong>
                    <span className={`has-sb-status-badge ${n.status}`}>{n.status}</span>
                  </div>

                  {n.summary && (
                    <p className="has-sb-note-card-summary">{n.summary}</p>
                  )}

                  <div className="has-sb-note-card-bottom">
                    <span className="has-sb-note-folder-badge">{n.folder}</span>
                    <span className="has-sb-note-date">{n.updated_at}</span>
                  </div>

                  {n.tags.length > 0 && (
                    <div className="has-sb-note-tags-row">
                      {n.tags.map((tg) => (
                        <span key={tg} className="has-sb-mini-tag">#{tg}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* ========================================================
          RIGHT COLUMN: EDITOR & MARKDOWN PREVIEW
          ======================================================== */}
      <main className="has-sb-editor-col">
        {noteLoading ? (
          <div className="has-sb-editor-empty">Загрузка содержимого заметки...</div>
        ) : !content && !title ? (
          <div className="has-sb-editor-empty">
            <BrainNavIcon className="w-16 h-16 text-muted" width={64} height={64} />
            <h3>Персональная база знаний (Second Brain)</h3>
            <p>Выберите заметку из списка слева для чтения или создайте новую по методологии PARA.</p>
            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button
                type="button"
                className="has-sb-btn-primary"
                onClick={() => createNewNote("00_Inbox")}
              >
                + Новая мысль в Inbox
              </button>
              <button
                type="button"
                className="has-sb-btn-secondary"
                onClick={() => setShowAiModal(true)}
              >
                ✨ AI Структурировать
              </button>
            </div>
          </div>
        ) : (
          <div className="has-sb-active-editor">
            {/* Top Toolbar */}
            <div className="has-sb-toolbar">
              <div className="has-sb-toolbar-left">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setDirty(true);
                  }}
                  placeholder="Заголовок заметки..."
                  className="has-sb-title-input"
                />
                {activeNote?.file_path && (
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                    📄 {activeNote.file_path}
                  </div>
                )}
              </div>

              <div className="has-sb-toolbar-right">
                {/* View Mode Toggle */}
                <div className="has-sb-view-toggle">
                  <button
                    type="button"
                    className={`has-sb-toggle-btn ${viewMode === "edit" ? "active" : ""}`}
                    onClick={() => setViewMode("edit")}
                  >
                    Редактор
                  </button>
                  <button
                    type="button"
                    className={`has-sb-toggle-btn ${viewMode === "split" ? "active" : ""}`}
                    onClick={() => setViewMode("split")}
                  >
                    Split
                  </button>
                  <button
                    type="button"
                    className={`has-sb-toggle-btn ${viewMode === "preview" ? "active" : ""}`}
                    onClick={() => setViewMode("preview")}
                  >
                    Просмотр
                  </button>
                </div>

                {/* Save Button */}
                <button
                  type="button"
                  className="has-sb-btn-primary"
                  onClick={handleSaveNote}
                  disabled={saving}
                >
                  {saving ? "Сохранение..." : dirty ? "Сохранить *" : "Сохранено"}
                </button>

                {activeNoteId && (
                  <button
                    type="button"
                    className="has-sb-btn-danger"
                    title="Удалить заметку"
                    onClick={() => setShowDeleteModal(true)}
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Metadata Bar (YAML Frontmatter quick controls) */}
            <div className="has-sb-meta-bar">
              <div className="has-sb-meta-item">
                <span className="has-sb-meta-label">Папка:</span>
                <select
                  value={folder}
                  onChange={(e) => {
                    setFolder(e.target.value as ParaFolder);
                    setDirty(true);
                  }}
                  className="has-sb-select"
                >
                  {PARA_FOLDERS.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
              </div>

              <div className="has-sb-meta-item">
                <span className="has-sb-meta-label">Тип:</span>
                <select
                  value={noteType}
                  onChange={(e) => {
                    setNoteType(e.target.value as NoteType);
                    setDirty(true);
                  }}
                  className="has-sb-select"
                >
                  <option value="inbox">inbox</option>
                  <option value="project">project</option>
                  <option value="area">area</option>
                  <option value="resource">resource</option>
                  <option value="archive">archive</option>
                </select>
              </div>

              <div className="has-sb-meta-item">
                <span className="has-sb-meta-label">Статус:</span>
                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value as NoteStatus);
                    setDirty(true);
                  }}
                  className="has-sb-select"
                >
                  <option value="draft">draft</option>
                  <option value="in-progress">in-progress</option>
                  <option value="completed">completed</option>
                  <option value="permanent">permanent</option>
                </select>
              </div>

              <div className="has-sb-meta-item has-sb-meta-tags">
                <span className="has-sb-meta-label">Теги:</span>
                <input
                  type="text"
                  placeholder="tag1, tag2..."
                  value={tagsInput}
                  onChange={(e) => {
                    setTagsInput(e.target.value);
                    setDirty(true);
                  }}
                  className="has-sb-meta-input"
                />
              </div>
            </div>

            {/* Split / Edit / Preview Workspace */}
            <div className={`has-sb-workspace ${viewMode}`}>
              {/* EDIT AREA */}
              {(viewMode === "edit" || viewMode === "split") && (
                <div className="has-sb-editor-pane">
                  <textarea
                    value={content}
                    onChange={(e) => {
                      setContent(e.target.value);
                      setDirty(true);
                    }}
                    placeholder="Напишите вашу заметку в формате Markdown..."
                    className="has-sb-textarea"
                    spellCheck={false}
                  />
                </div>
              )}

              {/* PREVIEW AREA */}
              {(viewMode === "preview" || viewMode === "split") && (
                <div className="has-sb-preview-pane">
                  <div className="has-sb-rendered-doc">
                    {renderedPreview}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ========================================================
          AI STRUCTURING MODAL (Prompt Rule 4)
          ======================================================== */}
      {showAiModal && (
        <div className="has-sb-modal-backdrop" onClick={() => setShowAiModal(false)}>
          <div className="has-sb-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="has-sb-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <SparklesIcon className="w-5 h-5 text-amber" />
                <h2>AI Структуризатор заметок</h2>
              </div>
              <button
                type="button"
                className="has-sb-modal-close"
                onClick={() => setShowAiModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="has-sb-modal-body">
              <p className="has-sb-modal-desc">
                Вставьте сырые мысли, статью, код или тему. Ассистент автоматически применит стандарт Second Brain: выделит суть, разложит по структуре PARA, добавит теги, блоки кода и ссылки <code>[[Obsidian]]</code>.
              </p>

              <textarea
                value={aiRawInput}
                onChange={(e) => setAiRawInput(e.target.value)}
                placeholder="Вставьте сюда любой неотсортированный текст, мысли, задачи или куски кода..."
                className="has-sb-ai-input"
                rows={8}
                autoFocus
              />
            </div>

            <div className="has-sb-modal-footer">
              <button
                type="button"
                className="has-sb-btn-secondary"
                onClick={() => setShowAiModal(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="has-sb-btn-primary"
                onClick={handleAiStructure}
                disabled={aiProcessing || !aiRawInput.trim()}
              >
                {aiProcessing ? "Структурирование..." : "Преобразовать в заметку"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          DELETE CONFIRMATION MODAL
          ======================================================== */}
      {showDeleteModal && (
        <div className="has-sb-modal-backdrop" onClick={() => setShowDeleteModal(false)}>
          <div className="has-sb-modal-card danger-modal" onClick={(e) => e.stopPropagation()}>
            <div className="has-sb-modal-header">
              <h2>Удалить заметку?</h2>
              <button
                type="button"
                className="has-sb-modal-close"
                onClick={() => setShowDeleteModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="has-sb-modal-body">
              <p>Вы действительно хотите удалить заметку <strong>«{title}»</strong>?</p>
              <p style={{ color: "#ef4444", fontSize: "13px" }}>
                Файл будет удален из базы и с диска сервера.
              </p>
            </div>

            <div className="has-sb-modal-footer">
              <button
                type="button"
                className="has-sb-btn-secondary"
                onClick={() => setShowDeleteModal(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="has-sb-btn-danger"
                disabled={deleting}
                onClick={handleDeleteNote}
              >
                {deleting ? "Удаление..." : "Удалить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper to replace [[Link Title]] with clickable elements
function parseWikiLinks(text: string, onClick: (title: string) => void): (string | React.ReactNode)[] {
  const parts: (string | React.ReactNode)[] = [];
  let remaining = text;
  let keyIdx = 0;

  while (remaining.length > 0) {
    const start = remaining.indexOf("[[");
    if (start === -1) {
      parts.push(remaining);
      break;
    }

    const end = remaining.indexOf("]]", start + 2);
    if (end === -1) {
      parts.push(remaining);
      break;
    }

    if (start > 0) {
      parts.push(remaining.slice(0, start));
    }

    const linkTitle = remaining.slice(start + 2, end);
    parts.push(
      <button
        key={`wiki-${keyIdx++}`}
        type="button"
        className="has-sb-wikilink-pill"
        onClick={() => onClick(linkTitle)}
        title={`Перейти к заметке: [[${linkTitle}]]`}
      >
        🔗 {linkTitle}
      </button>
    );

    remaining = remaining.slice(end + 2);
  }

  return parts;
}
