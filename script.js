/* =========================================================
   AURA — COMPLETE FRONTEND
   ========================================================= */

"use strict";

/* =========================================================
   DOM
   ========================================================= */

const chat = document.getElementById("chat");
const input = document.getElementById("input");
const welcome = document.getElementById("welcome");

const chatForm = document.getElementById("chatForm");
const sendButton = document.getElementById("sendButton");

const newChatButton = document.getElementById("newChatButton");
const clearMemoryButton =
  document.getElementById("clearMemoryButton");

const conversationList =
  document.getElementById("conversationList");

const historyPanel =
  document.getElementById("historyPanel");

const historyEmpty =
  document.getElementById("historyEmpty");

const openHistoryButton =
  document.getElementById("openHistoryButton");

const settingsButton =
  document.getElementById("settingsButton");

const settingsModal =
  document.getElementById("settingsModal");

const closeSettingsButton =
  document.getElementById("closeSettingsButton");

const settingsClearButton =
  document.getElementById("settingsClearButton");

const exportButton =
  document.getElementById("exportButton");

const importButton =
  document.getElementById("importButton");

const importInput =
  document.getElementById("importInput");

const conversationCount =
  document.getElementById("conversationCount");

const storageSize =
  document.getElementById("storageSize");

const knowledgeInput =
  document.getElementById("knowledgeInput");

const knowledgeList =
  document.getElementById("knowledgeList");

const imageInput =
  document.getElementById("imageInput");

const imagePreview =
  document.getElementById("imagePreview");


/* =========================================================
   STORAGE
   ========================================================= */

const STORAGE_KEY =
  "aura_conversations";

const OLD_STORAGE_KEY =
  "aura_conversation";

const KNOWLEDGE_STORAGE_KEY =
  "aura_knowledge_v1";


/* =========================================================
   STATE
   ========================================================= */

let conversations = [];

let currentConversationId = null;

let knowledgeFiles = [];

let selectedImage = null;

let isGenerating = false;


/* =========================================================
   HELPERS
   ========================================================= */

function createId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2)
  );
}


function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function formatBytes(bytes) {
  if (!bytes) {
    return "0 KB";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}


function formatDate(timestamp) {
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return "";
  }
}


/* =========================================================
   STORAGE — CONVERSATIONS
   ========================================================= */

function saveConversations() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(conversations)
  );

  updateMemoryStats();
}


function loadConversations() {
  try {
    const stored =
      localStorage.getItem(STORAGE_KEY);

    if (stored) {
      const parsed = JSON.parse(stored);

      if (Array.isArray(parsed)) {
        conversations = normalizeConversations(parsed);
        return;
      }
    }

    /* Migrate old single conversation */

    const old =
      localStorage.getItem(OLD_STORAGE_KEY);

    if (old) {
      const parsed = JSON.parse(old);

      if (Array.isArray(parsed) && parsed.length) {
        conversations = [
          {
            id: createId(),
            title: getConversationTitle(parsed),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: parsed
          }
        ];

        saveConversations();

        localStorage.removeItem(
          OLD_STORAGE_KEY
        );

        return;
      }
    }

  } catch (error) {
    console.error(
      "Failed to load conversations:",
      error
    );
  }

  conversations = [];
}


function normalizeConversations(items) {
  return items
    .filter(Boolean)
    .map((conversation) => {

      const messages =
        Array.isArray(conversation.messages)
          ? conversation.messages
          : [];

      return {
        id:
          conversation.id ||
          createId(),

        title:
          conversation.title ||
          getConversationTitle(messages),

        createdAt:
          conversation.createdAt ||
          Date.now(),

        updatedAt:
          conversation.updatedAt ||
          Date.now(),

        messages:
          messages
            .filter(
              (message) =>
                message &&
                (message.role === "user" ||
                  message.role === "model")
            )
            .map((message) => ({
              role: message.role,
              content:
                String(message.content || "")
            }))
      };
    });
}


function getConversationTitle(messages) {
  const firstUser =
    messages.find(
      (message) =>
        message.role === "user"
    );

  if (!firstUser) {
    return "New conversation";
  }

  const text =
    String(firstUser.content || "")
      .replace(/\s+/g, " ")
      .trim();

  if (!text) {
    return "New conversation";
  }

  return text.length > 38
    ? `${text.slice(0, 38)}…`
    : text;
}


/* =========================================================
   CURRENT CONVERSATION
   ========================================================= */

function getCurrentConversation() {
  return conversations.find(
    (conversation) =>
      conversation.id === currentConversationId
  );
}


function ensureCurrentConversation() {
  let conversation =
    getCurrentConversation();

  if (!conversation) {
    conversation = {
      id: createId(),
      title: "New conversation",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: []
    };

    conversations.unshift(conversation);

    currentConversationId =
      conversation.id;

    saveConversations();
  }

  return conversation;
}


/* =========================================================
   NEW CHAT
   ========================================================= */

function startNewConversation() {
  const conversation = {
    id: createId(),
    title: "New conversation",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: []
  };

  conversations.unshift(conversation);

  currentConversationId =
    conversation.id;

  saveConversations();

  renderConversation();

  renderConversationList();

  closeHistory();

  input.focus();
}


/* =========================================================
   DELETE CONVERSATION
   ========================================================= */

function deleteConversation(id) {
  const confirmed =
    window.confirm(
      "Delete this conversation?"
    );

  if (!confirmed) {
    return;
  }

  conversations =
    conversations.filter(
      (conversation) =>
        conversation.id !== id
    );

  if (
    currentConversationId === id
  ) {
    currentConversationId =
      conversations[0]?.id || null;
  }

  saveConversations();

  renderConversation();

  renderConversationList();
}


/* =========================================================
   CLEAR MEMORY
   ========================================================= */

function clearAllMemory() {
  const confirmed =
    window.confirm(
      "Delete all AURA conversations and local knowledge?"
    );

  if (!confirmed) {
    return;
  }

  conversations = [];

  currentConversationId = null;

  knowledgeFiles = [];

  selectedImage = null;

  localStorage.removeItem(
    STORAGE_KEY
  );

  localStorage.removeItem(
    OLD_STORAGE_KEY
  );

  localStorage.removeItem(
    KNOWLEDGE_STORAGE_KEY
  );

  clearImagePreview();

  renderKnowledgeList();

  renderConversationList();

  renderConversation();

  updateMemoryStats();
}


/* =========================================================
   RENDER CONVERSATION
   ========================================================= */

function renderConversation() {
  chat.innerHTML = "";

  const conversation =
    getCurrentConversation();

  if (
    !conversation ||
    !conversation.messages.length
  ) {
    welcome.hidden = false;
    return;
  }

  welcome.hidden = true;

  conversation.messages.forEach(
    (message) => {
      addMessageToDOM(
        message.role,
        message.content
      );
    }
  );

  scrollToBottom();
}


/* =========================================================
   ADD MESSAGE
   ========================================================= */

function addMessageToDOM(
  role,
  content
) {
  const message =
    document.createElement("div");

  message.className =
    `message ${role === "user" ? "user" : "ai"}`;

  if (role === "user") {
    message.textContent =
      content;

    chat.appendChild(message);

    return message;
  }

  message.innerHTML = `
    <div class="response-content">
      ${formatMarkdown(content)}
    </div>

    <div class="message-actions">

      <button
        type="button"
        class="message-action-button copy-button"
      >
        Copy
      </button>

      <button
        type="button"
        class="message-action-button regenerate-button"
      >
        Regenerate
      </button>

    </div>
  `;

  const copyButton =
    message.querySelector(
      ".copy-button"
    );

  const regenerateButton =
    message.querySelector(
      ".regenerate-button"
    );

  copyButton.addEventListener(
    "click",
    async () => {
      try {
        await navigator.clipboard.writeText(
          content
        );

        copyButton.textContent =
          "Copied";

        setTimeout(() => {
          copyButton.textContent =
            "Copy";
        }, 1200);

      } catch {
        copyButton.textContent =
          "Failed";

        setTimeout(() => {
          copyButton.textContent =
            "Copy";
        }, 1200);
      }
    }
  );

  regenerateButton.addEventListener(
    "click",
    () => {
      regenerateLastResponse();
    }
  );

  chat.appendChild(message);

  return message;
}


/* =========================================================
   MARKDOWN
   ========================================================= */

function formatMarkdown(text) {
  let html =
    escapeHTML(text || "");

  /* Code blocks */

  html = html.replace(
    /```([\s\S]*?)```/g,
    (_, code) =>
      `<pre><code>${code.trim()}</code></pre>`
  );

  /* Inline code */

  html = html.replace(
    /`([^`]+)`/g,
    "<code>$1</code>"
  );

  /* Headings */

  html = html.replace(
    /^### (.*)$/gm,
    "<h4>$1</h4>"
  );

  html = html.replace(
    /^## (.*)$/gm,
    "<h3>$1</h3>"
  );

  html = html.replace(
    /^# (.*)$/gm,
    "<h2>$1</h2>"
  );

  /* Bold */

  html = html.replace(
    /\*\*(.*?)\*\*/g,
    "<strong>$1</strong>"
  );

  /* Italic */

  html = html.replace(
    /(?<!\*)\*([^*\n]+)\*(?!\*)/g,
    "<em>$1</em>"
  );

  /* Bullet lists */

  html = html.replace(
    /(?:^|\n)((?:[-*] .*(?:\n|$))+)/g,
    (_, block) => {

      const items =
        block
          .trim()
          .split("\n")
          .map(
            (line) =>
              `<li>${line
                .replace(/^[-*]\s+/, "")
                .trim()}</li>`
          )
          .join("");

      return `\n<ul>${items}</ul>\n`;
    }
  );

  /* Numbered lists */

  html = html.replace(
    /(?:^|\n)((?:\d+\.\s+.*(?:\n|$))+)/g,
    (_, block) => {

      const items =
        block
          .trim()
          .split("\n")
          .map(
            (line) =>
              `<li>${line
                .replace(/^\d+\.\s+/, "")
                .trim()}</li>`
          )
          .join("");

      return `\n<ol>${items}</ol>\n`;
    }
  );

  /* Paragraphs */

  const blocks =
    html
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean);

  return blocks
    .map((block) => {

      if (
        block.startsWith("<h") ||
        block.startsWith("<ul") ||
        block.startsWith("<ol") ||
        block.startsWith("<pre")
      ) {
        return block;
      }

      return `<p>${block.replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}


/* =========================================================
   HISTORY
   ========================================================= */

function renderConversationList() {
  conversationList.innerHTML = "";

  historyEmpty.hidden =
    conversations.length > 0;

  conversations.forEach(
    (conversation) => {

      const item =
        document.createElement("div");

      item.className =
        "conversation-item";

      if (
        conversation.id ===
        currentConversationId
      ) {
        item.classList.add("active");
      }

      item.innerHTML = `
        <span class="conversation-title">
          ${escapeHTML(conversation.title)}
        </span>

        <button
          type="button"
          class="delete-conversation"
          aria-label="Delete conversation"
          title="Delete conversation"
        >
          ×
        </button>
      `;

      item.addEventListener(
        "click",
        (event) => {

          if (
            event.target.closest(
              ".delete-conversation"
            )
          ) {
            return;
          }

          currentConversationId =
            conversation.id;

          renderConversation();

          renderConversationList();

          closeHistory();
        }
      );

      const deleteButton =
        item.querySelector(
          ".delete-conversation"
        );

      deleteButton.addEventListener(
        "click",
        (event) => {
          event.stopPropagation();

          deleteConversation(
            conversation.id
          );
        }
      );

      conversationList.appendChild(item);
    }
  );
}


/* =========================================================
   THINKING
   ========================================================= */

function showThinking() {
  const element =
    document.createElement("div");

  element.className =
    "thinking-message";

  element.id =
    "auraThinking";

  element.innerHTML = `
    <span>Thinking</span>

    <span class="thinking-dots">
      <span></span>
      <span></span>
      <span></span>
    </span>
  `;

  chat.appendChild(element);

  scrollToBottom();
}


function removeThinking() {
  document
    .getElementById("auraThinking")
    ?.remove();
}


/* =========================================================
   SCROLL
   ========================================================= */

function scrollToBottom() {
  requestAnimationFrame(() => {
    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: "smooth"
    });
  });
}


/* =========================================================
   KNOWLEDGE
   ========================================================= */

function loadKnowledge() {
  try {
    const stored =
      localStorage.getItem(
        KNOWLEDGE_STORAGE_KEY
      );

    if (!stored) {
      knowledgeFiles = [];
      return;
    }

    const parsed =
      JSON.parse(stored);

    knowledgeFiles =
      Array.isArray(parsed)
        ? parsed
        : [];

  } catch (error) {
    console.error(
      "Failed to load knowledge:",
      error
    );

    knowledgeFiles = [];
  }
}


function saveKnowledge() {
  localStorage.setItem(
    KNOWLEDGE_STORAGE_KEY,
    JSON.stringify(knowledgeFiles)
  );

  updateMemoryStats();
}


function getKnowledgeContext() {
  if (!knowledgeFiles.length) {
    return "";
  }

  return knowledgeFiles
    .map(
      (file) =>
        `--- ${file.name} ---\n${file.content}`
    )
    .join("\n\n");
}


function renderKnowledgeList() {
  knowledgeList.innerHTML = "";

  if (!knowledgeFiles.length) {
    const empty =
      document.createElement("div");

    empty.className =
      "knowledge-empty";

    empty.textContent =
      "No local knowledge added.";

    knowledgeList.appendChild(empty);

    return;
  }

  knowledgeFiles.forEach(
    (file) => {

      const item =
        document.createElement("div");

      item.className =
        "knowledge-item";

      item.innerHTML = `
        <div class="knowledge-item-info">

          <div class="knowledge-item-name">
            ${escapeHTML(file.name)}
          </div>

          <div class="knowledge-item-meta">
            ${formatBytes(
              new Blob([file.content]).size
            )}
          </div>

        </div>

        <button
          type="button"
          class="knowledge-remove-button"
          title="Remove file"
          aria-label="Remove ${escapeHTML(file.name)}"
        >
          ×
        </button>
      `;

      item
        .querySelector(
          ".knowledge-remove-button"
        )
        .addEventListener(
          "click",
          () => {
            removeKnowledge(file.id);
          }
        );

      knowledgeList.appendChild(item);
    }
  );
}


function removeKnowledge(id) {
  knowledgeFiles =
    knowledgeFiles.filter(
      (file) =>
        file.id !== id
    );

  saveKnowledge();

  renderKnowledgeList();
}


function addKnowledgeFile(file) {
  const reader =
    new FileReader();

  reader.onload = () => {

    knowledgeFiles.push({
      id: createId(),
      name: file.name,
      content: String(
        reader.result || ""
      ),
      addedAt: Date.now()
    });

    saveKnowledge();

    renderKnowledgeList();
  };

  reader.onerror = () => {
    alert(
      `Could not read ${file.name}.`
    );
  };

  reader.readAsText(file);
}


/* =========================================================
   IMAGE
   ========================================================= */

function handleImage(file) {
  if (!file) {
    return;
  }

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  if (
    !allowedTypes.includes(
      file.type
    )
  ) {
    alert(
      "Please select a JPG, PNG or WebP image."
    );

    imageInput.value = "";

    return;
  }

  const maxSize =
    8 * 1024 * 1024;

  if (file.size > maxSize) {
    alert(
      "Please choose an image smaller than 8 MB."
    );

    imageInput.value = "";

    return;
  }

  const reader =
    new FileReader();

  reader.onload = () => {

    selectedImage = {
      name: file.name,
      type: file.type,
      data: String(
        reader.result || ""
      ),
      size: file.size
    };

    renderImagePreview();
  };

  reader.onerror = () => {
    alert(
      "Could not read the selected image."
    );
  };

  reader.readAsDataURL(file);
}


function renderImagePreview() {
  if (!selectedImage) {
    clearImagePreview();

    return;
  }

  imagePreview.hidden = false;

  imagePreview.innerHTML = `
    <div class="image-preview-content">

      <img
        src="${selectedImage.data}"
        alt="Selected image"
      />

      <div class="image-preview-info">

        <div class="image-preview-name">
          ${escapeHTML(selectedImage.name)}
        </div>

        <div class="image-preview-size">
          ${formatBytes(selectedImage.size)}
        </div>

      </div>

      <button
        type="button"
        class="image-remove-button"
        id="removeImageButton"
        aria-label="Remove image"
      >
        ×
      </button>

    </di
