
"use strict";

/*
 * Chroma Lab — Frontend API Integration
 * FastAPI endpoints:
 * GET  /health
 * GET  /documents
 * POST /upload
 * POST /rag/query
 * POST /reset
 */

// API URL selection
const API = (
  window.location.protocol === "file:" ||
  ["5500", "5501", "5173", "8080"].includes(window.location.port)
)
  ? "http://127.0.0.1:8000"
  : "";

const $ = (id) => document.getElementById(id);

const el = {
  sidebar: $("sidebar"),
  healthDot: $("healthDot"),
  healthText: $("healthText"),
  healthDetail: $("healthDetail"),
  chunkCount: $("chunkCount"),
  docCount: $("docCount"),
  documentBadge: $("documentBadge"),
  fileList: $("fileList"),
  fileInput: $("fileInput"),
  dropzone: $("dropzone"),
  uploadBtn: $("uploadBtn"),
  uploadProgress: $("uploadProgress"),
  progressBar: $("progressBar"),
  uploadStatus: $("uploadStatus"),
  refreshBtn: $("refreshBtn"),
  resetBtn: $("resetBtn"),
  menuBtn: $("menuBtn"),
  askForm: $("askForm"),
  askInput: $("askInput"),
  askBtn: $("askBtn"),
  chatThread: $("chatThread"),
  clearChatBtn: $("clearChatBtn"),
  toastContainer: $("toastContainer")
};

let busy = false;
let uploading = false;
let refreshing = false;
let hasConversation = false;
let requestController = null;

// Verify required HTML elements
const requiredElements = [
  "healthDot",
  "healthText",
  "healthDetail",
  "chunkCount",
  "docCount",
  "documentBadge",
  "fileList",
  "fileInput",
  "dropzone",
  "uploadBtn",
  "refreshBtn",
  "resetBtn",
  "askForm",
  "askInput",
  "askBtn",
  "chatThread",
  "clearChatBtn",
  "toastContainer"
];

const missingElements = requiredElements.filter((key) => !el[key]);

if (missingElements.length) {
  console.error(
    "Chroma Lab: Missing HTML elements:",
    missingElements
  );
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function toast(message, type = "") {
  if (!el.toastContainer) {
    console.log(message);
    return;
  }

  const item = document.createElement("div");
  item.className = `toast ${type}`.trim();
  item.textContent = message;
  el.toastContainer.appendChild(item);

  window.setTimeout(() => item.remove(), 4500);
}

async function apiRequest(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.headers || {})
      }
    });
  } catch (error) {
    throw new Error(
      `Cannot connect to ${API || window.location.origin}${path}. ` +
      "Check that FastAPI is running and the API URL is correct."
    );
  }

  if (!response.ok) {
    let message = `Request failed (${response.status}).`;

    try {
      const data = await response.json();

      message =
        data.detail ||
        data.message ||
        data.error ||
        message;
    } catch {
      // Keep the HTTP status message.
    }

    throw new Error(
      typeof message === "string"
        ? message
        : JSON.stringify(message)
    );
  }

  if (response.status === 204) {
    return {};
  }

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return {};
}

function getNumber(data, keys) {
  for (const key of keys) {
    const value = data?.[key];

    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      return value;
    }
  }

  return null;
}

function setHealth(online, detail = "") {
  el.healthDot.className =
    `status-dot ${online ? "online" : "offline"}`;

  el.healthText.textContent = online
    ? "Backend connected"
    : "Backend unavailable";

  el.healthDetail.textContent =
    detail ||
    (online
      ? "FastAPI is responding"
      : "Check the API server");
}

async function refreshHealth() {
  try {
    const data = await apiRequest("/health");

    setHealth(true);

    const chunks = getNumber(data, [
      "indexed_chunks",
      "total_chunks",
      "chunk_count",
      "chunks",
      "count"
    ]);

    if (chunks !== null) {
      el.chunkCount.textContent = chunks.toLocaleString();
    }

    return data;
  } catch (error) {
    console.error("Chroma Lab health error:", error);

    setHealth(false, error.message);
    el.chunkCount.textContent = "—";

    return null;
  }
}

// Normalize supported API response formats
function normalizeDocuments(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (data && typeof data === "object") {
    for (const key of [
      "documents",
      "files",
      "items",
      "results"
    ]) {
      if (Array.isArray(data[key])) {
        return data[key];
      }
    }
  }

  return [];
}

function documentName(document) {
  if (typeof document === "string") {
    return document;
  }

  return (
    document?.filename ||
    document?.file_name ||
    document?.name ||
    document?.source ||
    document?.path ||
    document?.id ||
    "Unnamed document"
  );
}

function documentChunks(document) {
  if (
    typeof document === "object" &&
    document !== null
  ) {
    return getNumber(document, [
      "chunks",
      "chunk_count",
      "total_chunks",
      "count"
    ]);
  }

  return null;
}

function fileExtension(name) {
  const match = String(name).match(/\.([^.\/\\]+)$/);

  return match
    ? match[1].toUpperCase()
    : "FILE";
}

function renderDocuments(documents) {
  el.fileList.replaceChildren();

  el.docCount.textContent =
    documents.length.toLocaleString();

  el.documentBadge.textContent =
    String(documents.length);

  if (!documents.length) {
    const placeholder = document.createElement("div");

    placeholder.className = "list-placeholder";
    placeholder.textContent =
      "No indexed documents found. Upload a PDF, TXT or MD file to get started.";

    el.fileList.appendChild(placeholder);
    return;
  }

  documents.forEach((doc) => {
    const item = document.createElement("div");
    item.className = "file-item";

    const type = document.createElement("span");
    type.className = "file-type";
    type.textContent = fileExtension(documentName(doc)).slice(0, 5);

    const info = document.createElement("div");
    info.className = "file-info";

    const title = document.createElement("strong");
    title.textContent = documentName(doc);
    title.title = documentName(doc);

    const meta = document.createElement("small");

    const chunks = documentChunks(doc);
    meta.textContent = chunks === null
      ? "Indexed document"
      : `${chunks} chunk${chunks === 1 ? "" : "s"}`;

    info.append(title, meta);
    item.append(type, info);

    el.fileList.appendChild(item);
  });
}

async function refreshDocuments() {
  try {
    const data = await apiRequest("/documents");

    console.log("Chroma Lab documents response:", data);

    // Expected format:
    // { documents: [{ source: "chromadb-notes.txt", chunks: 1 }],
    //   total_chunks: 1 }

    if (!data || typeof data !== "object") {
      throw new Error("Unexpected response from /documents.");
    }

    const documents = normalizeDocuments(data);

    renderDocuments(documents);

    const totalChunks = getNumber(data, [
      "indexed_chunks",
      "total_chunks",
      "chunk_count"
    ]);

    if (totalChunks !== null) {
      el.chunkCount.textContent =
        totalChunks.toLocaleString();
    } else {
      const individualChunks = documents.reduce(
        (total, doc) =>
          total + (documentChunks(doc) || 0),
        0
      );

      const allHaveCounts =
        documents.length > 0 &&
        documents.every(
          (doc) => documentChunks(doc) !== null
        );

      if (allHaveCounts) {
        el.chunkCount.textContent =
          individualChunks.toLocaleString();
      }
    }

    return data;
  } catch (error) {
    console.error(
      "Chroma Lab documents error:",
      error
    );

    el.fileList.replaceChildren();

    const placeholder = document.createElement("div");
    placeholder.className = "list-placeholder";

    // Display the real error instead of a generic message.
    placeholder.textContent =
      `Unable to load documents: ${error.message}`;

    el.fileList.appendChild(placeholder);

    el.docCount.textContent = "—";
    el.documentBadge.textContent = "—";

    return null;
  }
}

async function refreshAll() {
  if (refreshing) return;

  refreshing = true;

  if (el.refreshBtn) {
    el.refreshBtn.disabled = true;
  }

  try {
    const results = await Promise.all([
      refreshHealth(),
      refreshDocuments()
    ]);

    if (results.every((result) => result !== null)) {
      toast("Workspace refreshed.", "success");
    } else {
      toast(
        "Some workspace information could not be loaded. Check the displayed error.",
        "error"
      );
    }
  } finally {
    refreshing = false;

    if (el.refreshBtn) {
      el.refreshBtn.disabled = false;
    }
  }
}

function setUploadProgress(
  visible,
  percent = 0,
  message = ""
) {
  if (el.uploadProgress) {
    el.uploadProgress.hidden = !visible;
  }

  if (el.progressBar) {
    el.progressBar.style.width = `${percent}%`;
  }

  if (el.uploadStatus) {
    el.uploadStatus.textContent = message;
  }
}

async function uploadFiles(fileList) {
  const files = Array.from(fileList || []);

  if (!files.length || uploading) return;

  const allowedExtensions = [".pdf", ".txt", ".md"];

  const invalid = files.filter((file) => {
    const name = file.name.toLowerCase();

    return !allowedExtensions.some(
      (extension) => name.endsWith(extension)
    );
  });

  if (invalid.length) {
    toast(
      "Only PDF, TXT and MD files are supported.",
      "error"
    );
    return;
  }

  if (!el.healthDot.classList.contains("online")) {
    const health = await refreshHealth();

    if (!health) {
      toast(
        "Start the FastAPI backend before uploading.",
        "error"
      );
      return;
    }
  }

  uploading = true;
  el.uploadBtn.disabled = true;
  el.fileInput.disabled = true;

  setUploadProgress(
    true,
    15,
    "Preparing documents..."
  );

  try {
    const formData = new FormData();

    // The backend upload endpoint accepts "files".
    files.forEach((file) => {
      formData.append("files", file);
    });

    setUploadProgress(
      true,
      35,
      "Uploading and indexing..."
    );

    const result = await apiRequest("/upload", {
      method: "POST",
      body: formData
    });

    setUploadProgress(
      true,
      90,
      "Refreshing knowledge collection..."
    );

    await Promise.all([
      refreshHealth(),
      refreshDocuments()
    ]);

    setUploadProgress(
      true,
      100,
      "Upload completed."
    );

    const message =
      result?.message ||
      result?.detail ||
      `${files.length} file${files.length === 1 ? "" : "s"} uploaded successfully.`;

    toast(
      typeof message === "string"
        ? message
        : "Upload completed.",
      "success"
    );
  } catch (error) {
    console.error("Chroma Lab upload error:", error);

    toast(
      `Upload failed: ${error.message}`,
      "error"
    );

    setUploadProgress(
      true,
      0,
      "Upload failed. Check the error notification."
    );
  } finally {
    uploading = false;
    el.uploadBtn.disabled = false;
    el.fileInput.disabled = false;
    el.fileInput.value = "";

    window.setTimeout(() => {
      if (!uploading) {
        setUploadProgress(false);
      }
    }, 2200);
  }
}

function escapeMarkdownHTML(text) {
  return escapeHTML(text);
}

function renderMarkdown(value) {
  let text = escapeMarkdownHTML(value);

  const codeBlocks = [];

  text = text.replace(
    /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g,
    (_, language, code) => {
      const html =
        `<pre><code>${code.trim()}</code></pre>`;

      codeBlocks.push(html);

      return `\u0000CODE${codeBlocks.length - 1}\u0000`;
    }
  );

  text = text.replace(
    /`([^`\n]+)`/g,
    "<code>$1</code>"
  );

  text = text.replace(
    /^### (.+)$/gm,
    "<h3>$1</h3>"
  );

  text = text.replace(
    /^## (.+)$/gm,
    "<h2>$1</h2>"
  );

  text = text.replace(
    /^# (.+)$/gm,
    "<h1>$1</h1>"
  );

  text = text.replace(
    /^&gt; (.+)$/gm,
    "<blockquote>$1</blockquote>"
  );

  text = text.replace(
    /\*\*(.+?)\*\*/g,
    "<strong>$1</strong>"
  );

  text = text.replace(
    /(^|[^*])\*([^*\n]+)\*/g,
    "$1<em>$2</em>"
  );

  const lines = text.split("\n");
  const output = [];

  let paragraph = [];
  let listType = null;

  function flushParagraph() {
    if (paragraph.length) {
      output.push(
        `<p>${paragraph.join("<br>")}</p>`
      );
      paragraph = [];
    }
  }

  function closeList() {
    if (listType) {
      output.push(`</${listType}>`);
      listType = null;
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();

    const unordered =
      /^[-*]\s+(.+)$/.exec(trimmed);

    const ordered =
      /^\d+[.)]\s+(.+)$/.exec(trimmed);

    const heading = /^<h[1-3]>/.test(trimmed);
    const quote = /^<blockquote>/.test(trimmed);
    const codeToken = /^\u0000CODE\d+\u0000$/.test(trimmed);

    if (!trimmed) {
      flushParagraph();
      closeList();
    } else if (
      unordered ||
      ordered ||
      heading ||
      quote ||
      codeToken
    ) {
      flushParagraph();
      closeList();

      if (unordered || ordered) {
        const type = unordered ? "ul" : "ol";

        if (listType !== type) {
          closeList();
          output.push(`<${type}>`);
          listType = type;
        }

        output.push(
          `<li>${unordered ? unordered[1] : ordered[1]}</li>`
        );
      } else {
        output.push(trimmed);
      }
    } else {
      closeList();
      paragraph.push(trimmed);
    }
  }

  flushParagraph();
  closeList();

  let html = output.join("");

  html = html.replace(
    /\u0000CODE(\d+)\u0000/g,
    (_, index) => codeBlocks[Number(index)] || ""
  );

  return html || "<p>No answer text was returned.</p>";
}

function addQuestion(question) {
  const article = document.createElement("article");
  article.className = "qa";

  const questionRow = document.createElement("div");
  questionRow.className = "question-row";

  const bubble = document.createElement("div");
  bubble.className = "question-bubble";
  bubble.textContent = question;

  const avatar = document.createElement("span");
  avatar.className = "user-avatar";
  avatar.textContent = "Y";
  avatar.setAttribute("aria-label", "You");

  questionRow.append(bubble, avatar);

  const answerRow = document.createElement("div");
  answerRow.className = "answer-row";

  const assistantAvatar = document.createElement("span");
  assistantAvatar.className = "assistant-avatar";
  assistantAvatar.textContent = "✳";

  const answerBody = document.createElement("div");
  answerBody.className = "answer-body";

  const label = document.createElement("div");
  label.className = "answer-label";
  label.textContent = "✳ CHROMA LAB · RESPONSE";

  const answerText = document.createElement("div");
  answerText.className = "answer-text";

  answerText.innerHTML =
    '<span class="typing" aria-label="Generating answer"><span></span><span></span><span></span></span>';

  answerBody.append(label, answerText);
  answerRow.append(assistantAvatar, answerBody);
  article.append(questionRow, answerRow);

  el.chatThread.appendChild(article);
  el.chatThread.scrollTop = el.chatThread.scrollHeight;

  return article;
}

function addSourceItem(container, source) {
  const item = document.createElement("div");
  item.className = "source-item";

  const icon = document.createElement("span");
  icon.className = "source-file-icon";

  icon.textContent = fileExtension(
    source?.source ||
    source?.filename ||
    "FILE"
  ).slice(0, 5);

  const details = document.createElement("div");
  details.className = "source-details";

  const name = document.createElement("span");
  name.className = "source-name";

  name.textContent =
    source?.source ||
    source?.filename ||
    source?.name ||
    "Unknown source";

  const meta = document.createElement("span");
  meta.className = "source-meta";

  const parts = [];

  if (source?.page != null) {
    parts.push(`Page ${source.page}`);
  }

  if (source?.chunk != null) {
    parts.push(`Chunk ${source.chunk}`);
  }

  meta.textContent = parts.length
    ? parts.join(" · ")
    : "Retrieved source";

  details.append(name, meta);
  item.append(icon, details);

  if (
    source?.distance != null &&
    Number.isFinite(Number(source.distance))
  ) {
    const match = document.createElement("span");
    match.className = "source-match";
    match.title =
      "Distance-based indicator; not a probability.";
    match.textContent = "Retrieved";

    item.appendChild(match);
  }

  container.appendChild(item);
}

function renderAnswer(article, data) {
  const answerText =
    article.querySelector(".answer-text");

  const answerBody =
    article.querySelector(".answer-body");

  answerText.innerHTML = renderMarkdown(
    data?.answer ||
    "The backend returned no answer text."
  );

  const sources = Array.isArray(data?.sources)
    ? data.sources
    : [];

  if (!sources.length) return;

  const actions = document.createElement("div");
  actions.className = "answer-actions";

  const copyBtn = document.createElement("button");
  copyBtn.className = "mini-btn";
  copyBtn.type = "button";
  copyBtn.textContent = "▣ Copy answer";

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(
        answerText.innerText ||
        answerText.textContent
      );

      toast("Answer copied.", "success");
    } catch {
      toast(
        "Clipboard access is unavailable in this browser.",
        "error"
      );
    }
  });

  const sourcesBtn = document.createElement("button");
  sourcesBtn.className = "sources-toggle";
  sourcesBtn.type = "button";
  sourcesBtn.setAttribute("aria-expanded", "false");

  sourcesBtn.textContent =
    `⌕ Sources (${sources.length})`;

  const panel = document.createElement("div");
  panel.className = "sources-panel";

  sources.forEach((source) => {
    addSourceItem(panel, source);
  });

  sourcesBtn.addEventListener("click", () => {
    const open = panel.classList.toggle("show");

    sourcesBtn.setAttribute(
      "aria-expanded",
      String(open)
    );
  });

  actions.append(copyBtn, sourcesBtn);
  answerBody.append(actions, panel);
}

function autoGrow() {
  el.askInput.style.height = "auto";

  el.askInput.style.height =
    `${Math.min(el.askInput.scrollHeight, 120)}px`;
}

function clearChat() {
  if (busy) {
    toast(
      "Wait for the current answer to finish first.",
      "error"
    );
    return;
  }

  el.chatThread.replaceChildren();

  const empty = document.createElement("div");
  empty.className = "empty-state";

  const orb = document.createElement("div");
  orb.className = "empty-orb";
  orb.textContent = "✳";

  const title = document.createElement("h3");
  title.textContent = "Your next insight starts here.";

  const description = document.createElement("p");

  description.textContent =
    "Upload your documents, then ask questions to explore your knowledge.";

  empty.append(orb, title, description);
  el.chatThread.appendChild(empty);

  hasConversation = false;
}

async function askQuestion(question) {
  if (!question || busy) return;

  if (!el.healthDot.classList.contains("online")) {
    const health = await refreshHealth();

    if (!health) {
      toast(
        "Backend is unavailable. Start FastAPI and try again.",
        "error"
      );
      return;
    }
  }

  if (!hasConversation) {
    el.chatThread.replaceChildren();
    hasConversation = true;
  }

  const article = addQuestion(question);

  busy = true;
  el.askBtn.disabled = true;
  el.askInput.disabled = true;

  const buttonLabel =
    el.askBtn.querySelector("span:first-child");

  if (buttonLabel) {
    buttonLabel.textContent = "Thinking...";
  }

  requestController = new AbortController();

  try {
    const data = await apiRequest("/rag/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question,
        top_k: 4,
        source: "all"
      }),
      signal: requestController.signal
    });

    renderAnswer(article, data || {});

    el.chatThread.scrollTop =
      el.chatThread.scrollHeight;
  } catch (error) {
    console.error("Chroma Lab query error:", error);

    const answer =
      article.querySelector(".answer-text");

    answer.classList.add("error-message");

    answer.textContent =
      error.name === "AbortError"
        ? "The request was cancelled."
        : `Unable to get an answer: ${error.message}`;

    toast(
      "Question request failed. Check the error in the chat.",
      "error"
    );
  } finally {
    busy = false;
    requestController = null;

    el.askBtn.disabled = false;
    el.askInput.disabled = false;

    if (buttonLabel) {
      buttonLabel.textContent = "Ask Chroma";
    }

    el.askInput.focus();
  }
}

// Refresh workspace
if (el.refreshBtn) {
  el.refreshBtn.addEventListener("click", refreshAll);
}

// Upload zone
if (el.dropzone) {
  el.dropzone.addEventListener("click", () => {
    if (!uploading) el.fileInput.click();
  });

  el.dropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();

      if (!uploading) el.fileInput.click();
    }
  });
}

if (el.uploadBtn) {
  el.uploadBtn.addEventListener("click", () => {
    if (!uploading) el.fileInput.click();
  });
}

if (el.fileInput) {
  el.fileInput.addEventListener("change", (event) => {
    uploadFiles(event.target.files);
  });
}

if (el.dropzone) {
  ["dragenter", "dragover"].forEach((eventName) => {
    el.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      el.dropzone.classList.add("dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    el.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      el.dropzone.classList.remove("dragging");
    });
  });

  el.dropzone.addEventListener("drop", (event) => {
    uploadFiles(event.dataTransfer?.files);
  });
}

// Chat input
el.askInput.addEventListener("input", autoGrow);

el.askInput.addEventListener("keydown", (event) => {
  if (
    event.key === "Enter" &&
    !event.shiftKey
  ) {
    event.preventDefault();
    el.askForm.requestSubmit();
  }
});

el.askForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const question = el.askInput.value.trim();

  if (!question || busy) return;

  el.askInput.value = "";
  autoGrow();

  askQuestion(question);
});

// Suggested questions
document.querySelectorAll("[data-question]").forEach((button) => {
  button.addEventListener("click", () => {
    el.askInput.value = button.dataset.question || "";

    autoGrow();
    el.askInput.focus();
  });
});

// Clear chat
el.clearChatBtn.addEventListener("click", clearChat);

// Mobile sidebar
if (el.menuBtn && el.sidebar) {
  el.menuBtn.addEventListener("click", () => {
    el.sidebar.classList.toggle("open");
  });

  document.addEventListener("click", (event) => {
    if (
      window.innerWidth <= 760 &&
      el.sidebar.classList.contains("open") &&
      !el.sidebar.contains(event.target) &&
      !el.menuBtn.contains(event.target)
    ) {
      el.sidebar.classList.remove("open");
    }
  });
}

// Reset collection
el.resetBtn.addEventListener("click", async () => {
  if (busy || uploading) {
    toast(
      "Wait until the current operation finishes.",
      "error"
    );
    return;
  }

  const confirmed = window.confirm(
    "Are you sure you want to reset your knowledge collection?\n\n" +
    "This may permanently remove indexed data.\n\nContinue?"
  );

  if (!confirmed) return;

  el.resetBtn.disabled = true;

  try {
    await apiRequest("/reset", {
      method: "POST"
    });

    clearChat();

    await Promise.all([
      refreshHealth(),
      refreshDocuments()
    ]);

    toast(
      "Knowledge collection reset successfully.",
      "success"
    );
  } catch (error) {
    console.error("Chroma Lab reset error:", error);

    toast(
      `Reset failed: ${error.message}`,
      "error"
    );
  } finally {
    el.resetBtn.disabled = false;
  }
});

// Start workspace
setHealth(false, "Checking FastAPI...");

refreshHealth();
refreshDocuments();
