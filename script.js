(() => {
  "use strict";

  /* =========================================================
     AURA — PERSONAL AI ASSISTANT
     ========================================================= */

  const STORAGE_KEY = "aura_conversations";
  const OLD_STORAGE_KEY = "aura_conversation";
  const KNOWLEDGE_STORAGE_KEY = "aura_knowledge_v1";

  const MAX_KNOWLEDGE_CONTEXT = 60000;
  const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
  const API_ENDPOINT = "/api/chat";


  /* =========================================================
     DOM REFERENCES
     ========================================================= */

  const chat = document.getElementById("chat");
  const input = document.getElementById("input");
  const welcome = document.getElementById("welcome");
  const messageForm = document.getElementById("messageForm");
  const sendButton = document.getElementById("sendButton");

  const newChatButton =
    document.getElementById("newChatButton");

  const clearMemoryButton =
    document.getElementById("clearMemoryButton");

  const conversationList =
    document.getElementById("conversationList");

  const historyPanel =
    document.querySelector(".history-panel");

  const openHistoryButton =
    document.getElementById("openHistoryButton");

  const closeHistoryButton =
    document.getElementById("closeHistoryButton");

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

  const importInput =
    document.getElementById("importInput");

  const conversationCount =
    document.getElementById("conversationCount");

  const settingsConversationCount =
    document.getElementById(
      "settingsConversationCount"
    );

  const settingsKnowledgeCount =
    document.getElementById(
      "settingsKnowledgeCount"
    );

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

  const imagePreviewImage =
    document.getElementById(
      "imagePreviewImage"
    );

  const imagePreviewName =
    document.getElementById(
      "imagePreviewName"
    );

  const imagePreviewSize =
    document.getElementById(
      "imagePreviewSize"
    );

  const removeImageButton =
    document.getElementById(
      "removeImageButton"
    );


  /* =========================================================
     STATE
     ========================================================= */

  let conversations = [];
  let currentConversationId = null;

  let knowledgeFiles = [];

  let selectedImage = null;

  let isGenerating = false;

  let typingAbortController = null;


  /* =========================================================
     BASIC UTILITIES
     ========================================================= */

  function createId(prefix = "id") {
    return (
      prefix +
      "_" +
      Date.now().toString(36) +
      "_" +
      Math.random()
        .toString(36)
        .slice(2, 10)
    );
  }


  function now() {
    return new Date().toISOString();
  }


  function safeString(value) {
    if (
      value === null ||
      value === undefined
    ) {
      return "";
    }

    return String(value);
  }


  function formatBytes(bytes) {
    const size = Number(bytes) || 0;

    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(
      size /
      (1024 * 1024)
    ).toFixed(2)} MB`;
  }


  function formatDate(value) {
    if (!value) {
      return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleDateString(
      undefined,
      {
        day: "numeric",
        month: "short",
        year: "numeric"
      }
    );
  }


  function formatTime(value) {
    if (!value) {
      return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleTimeString(
      undefined,
      {
        hour: "numeric",
        minute: "2-digit"
      }
    );
  }


  function isMobile() {
    return window.matchMedia(
      "(max-width: 800px)"
    ).matches;
  }


  function escapeHTML(value) {
    return safeString(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  function safeURL(url) {
    const value =
      safeString(url).trim();

    if (
      value.startsWith("https://") ||
      value.startsWith("http://") ||
      value.startsWith("mailto:")
    ) {
      return value;
    }

    return "#";
  }


  /* =========================================================
     INLINE MARKDOWN
     ========================================================= */

  function renderInlineMarkdown(text) {
    let output =
      escapeHTML(text);

    output = output.replace(
      /`([^`]+)`/g,
      "<code>$1</code>"
    );

    output = output.replace(
      /\*\*([^*]+)\*\*/g,
      "<strong>$1</strong>"
    );

    output = output.replace(
      /__([^_]+)__/g,
      "<strong>$1</strong>"
    );

    output = output.replace(
      /(^|[^*])\*([^*]+)\*/g,
      "$1<em>$2</em>"
    );

    output = output.replace(
      /(^|[^_])_([^_]+)_/g,
      "$1<em>$2</em>"
    );

    output = output.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      (_, label, url) => {
        const safe = safeURL(url);

        return (
          `<a href="${escapeHTML(
            safe
          )}" ` +
          `target="_blank" ` +
          `rel="noopener noreferrer">` +
          `${label}</a>`
        );
      }
    );

    return output;
  }


  /* =========================================================
     MARKDOWN RENDERER
     ========================================================= */

  function renderMarkdown(markdown) {
    const source =
      safeString(markdown)
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n");

    if (!source.trim()) {
      return "";
    }

    const lines =
      source.split("\n");

    const html = [];

    let inCodeBlock = false;
    let codeLanguage = "";
    let codeLines = [];

    let inUnorderedList = false;
    let inOrderedList = false;

    let paragraphLines = [];


    function closeLists() {
      if (inUnorderedList) {
        html.push("</ul>");
        inUnorderedList = false;
      }

      if (inOrderedList) {
        html.push("</ol>");
        inOrderedList = false;
      }
    }


    function flushParagraph() {
      if (!paragraphLines.length) {
        return;
      }

      const text =
        paragraphLines.join("\n");

      html.push(
        `<p>${renderInlineMarkdown(
          text
        ).replace(
          /\n/g,
          "<br>"
        )}</p>`
      );

      paragraphLines = [];
    }


    for (
      let i = 0;
      i < lines.length;
      i++
    ) {
      const line = lines[i];


      if (line.startsWith("```")) {
        flushParagraph();
        closeLists();

        if (!inCodeBlock) {
          inCodeBlock = true;

          codeLanguage =
            line
              .slice(3)
              .trim()
              .toLowerCase();

          codeLines = [];
        } else {
          const languageHTML =
            codeLanguage
              ? `<span class="code-language">${escapeHTML(
                  codeLanguage
                )}</span>`
              : "";

          html.push(`
            <div class="code-block">
              ${languageHTML}
              <pre><code>${escapeHTML(
                codeLines.join("\n")
              )}</code></pre>
            </div>
          `);

          inCodeBlock = false;
          codeLanguage = "";
          codeLines = [];
        }

        continue;
      }


      if (inCodeBlock) {
        codeLines.push(line);
        continue;
      }


      if (!line.trim()) {
        flushParagraph();
        closeLists();
        continue;
      }


      const heading =
        line.match(
          /^(#{1,6})\s+(.+)$/
        );

      if (heading) {
        flushParagraph();
        closeLists();

        const level =
          heading[1].length;

        html.push(
          `<h${level}>${renderInlineMarkdown(
            heading[2]
          )}</h${level}>`
        );

        continue;
      }


      const unordered =
        line.match(
          /^\s*[-*+]\s+(.+)$/
        );

      if (unordered) {
        flushParagraph();

        if (inOrderedList) {
          html.push("</ol>");
          inOrderedList = false;
        }

        if (!inUnorderedList) {
          html.push("<ul>");
          inUnorderedList = true;
        }

        html.push(
          `<li>${renderInlineMarkdown(
            unordered[1]
          )}</li>`
        );

        continue;
      }


      const ordered =
        line.match(
          /^\s*\d+\.\s+(.+)$/
        );

      if (ordered) {
        flushParagraph();

        if (inUnorderedList) {
          html.push("</ul>");
          inUnorderedList = false;
        }

        if (!inOrderedList) {
          html.push("<ol>");
          inOrderedList = true;
        }

        html.push(
          `<li>${renderInlineMarkdown(
            ordered[1]
          )}</li>`
        );

        continue;
      }


      const quote =
        line.match(
          /^\s*>\s?(.*)$/
        );

      if (quote) {
        flushParagraph();
        closeLists();

        html.push(
          `<blockquote>${renderInlineMarkdown(
            quote[1]
          )}</blockquote>`
        );

        continue;
      }


      paragraphLines.push(line);
    }


    if (inCodeBlock) {
      const languageHTML =
        codeLanguage
          ? `<span class="code-language">${escapeHTML(
              codeLanguage
            )}</span>`
          : "";

      html.push(`
        <div class="code-block">
          ${languageHTML}
          <pre><code>${escapeHTML(
            codeLines.join("\n")
          )}</code></pre>
        </div>
      `);
    }


    flushParagraph();
    closeLists();

    return html.join("");
  }


  /* =========================================================
     STORAGE
     ========================================================= */

  function saveConversations() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          conversations
        )
      );
    } catch (error) {
      console.error(
        "Unable to save conversations:",
        error
      );
    }

    updateMemoryStats();
  }


  function saveKnowledge() {
    try {
      localStorage.setItem(
        KNOWLEDGE_STORAGE_KEY,
        JSON.stringify(
          knowledgeFiles
        )
      );
    } catch (error) {
      console.error(
        "Unable to save knowledge:",
        error
      );
    }

    updateMemoryStats();
  }
     /* =========================================================
     MESSAGE NORMALIZATION
     ========================================================= */

  function normalizeMessage(message) {
    if (
      !message ||
      typeof message !== "object"
    ) {
      return null;
    }

    const role =
      message.role === "assistant"
        ? "assistant"
        : "user";

    return {
      id:
        safeString(message.id) ||
        createId("msg"),

      role,

      content:
        safeString(
          message.content
        ),

      createdAt:
        safeString(
          message.createdAt
        ) || now()
    };
  }


  /* =========================================================
     CONVERSATION NORMALIZATION
     ========================================================= */

  function normalizeConversation(
    conversation
  ) {
    if (
      !conversation ||
      typeof conversation !== "object"
    ) {
      return null;
    }

    const messages =
      Array.isArray(
        conversation.messages
      )
        ? conversation.messages
            .map(normalizeMessage)
            .filter(Boolean)
        : [];

    return {
      id:
        safeString(
          conversation.id
        ) ||
        createId("conversation"),

      title:
        safeString(
          conversation.title
        ) ||
        "New Conversation",

      createdAt:
        safeString(
          conversation.createdAt
        ) || now(),

      updatedAt:
        safeString(
          conversation.updatedAt
        ) ||
        safeString(
          conversation.createdAt
        ) ||
        now(),

      messages
    };
  }


  /* =========================================================
     OLD MEMORY MIGRATION
     ========================================================= */

  function migrateOldConversation() {
    try {
      const oldData =
        localStorage.getItem(
          OLD_STORAGE_KEY
        );

      if (!oldData) {
        return null;
      }

      const parsed =
        JSON.parse(oldData);

      if (
        !Array.isArray(parsed) ||
        !parsed.length
      ) {
        return null;
      }

      const messages =
        parsed
          .map(normalizeMessage)
          .filter(Boolean);

      if (!messages.length) {
        return null;
      }

      const conversation = {
        id:
          createId("conversation"),

        title:
          createConversationTitle(
            messages
          ),

        createdAt: now(),

        updatedAt: now(),

        messages
      };

      localStorage.removeItem(
        OLD_STORAGE_KEY
      );

      return conversation;
    } catch (error) {
      console.error(
        "Migration error:",
        error
      );

      return null;
    }
  }


  /* =========================================================
     LOAD CONVERSATIONS
     ========================================================= */

  function loadConversations() {
    try {
      const raw =
        localStorage.getItem(
          STORAGE_KEY
        );

      if (raw) {
        const parsed =
          JSON.parse(raw);

        if (
          Array.isArray(parsed)
        ) {
          conversations =
            parsed
              .map(
                normalizeConversation
              )
              .filter(Boolean);
        }
      }
    } catch (error) {
      console.error(
        "Unable to load conversations:",
        error
      );

      conversations = [];
    }


    /* -------------------------------------------------------
       Migrate the old single-conversation storage format
       ------------------------------------------------------- */

    if (!conversations.length) {
      const migrated =
        migrateOldConversation();

      if (migrated) {
        conversations = [
          migrated
        ];

        saveConversations();
      }
    }


    conversations.sort(
      (a, b) =>
        new Date(
          b.updatedAt
        ) -
        new Date(
          a.updatedAt
        )
    );


    if (
      !currentConversationId &&
      conversations.length
    ) {
      currentConversationId =
        conversations[0].id;
    }
  }


  /* =========================================================
     KNOWLEDGE NORMALIZATION
     ========================================================= */

  function normalizeKnowledge(
    file
  ) {
    if (
      !file ||
      typeof file !== "object"
    ) {
      return null;
    }

    return {
      id:
        safeString(file.id) ||
        createId("knowledge"),

      name:
        safeString(file.name) ||
        "Untitled.txt",

      type:
        safeString(file.type) ||
        "text/plain",

      size:
        Number(file.size) || 0,

      content:
        safeString(file.content),

      createdAt:
        safeString(
          file.createdAt
        ) || now()
    };
  }


  /* =========================================================
     LOAD KNOWLEDGE
     ========================================================= */

  function loadKnowledge() {
    try {
      const raw =
        localStorage.getItem(
          KNOWLEDGE_STORAGE_KEY
        );

      if (!raw) {
        knowledgeFiles = [];
        return;
      }

      const parsed =
        JSON.parse(raw);

      if (
        !Array.isArray(parsed)
      ) {
        knowledgeFiles = [];
        return;
      }

      knowledgeFiles =
        parsed
          .map(normalizeKnowledge)
          .filter(Boolean);
    } catch (error) {
      console.error(
        "Unable to load knowledge:",
        error
      );

      knowledgeFiles = [];
    }
  }


  /* =========================================================
     KNOWLEDGE CONTEXT
     ========================================================= */

  function getKnowledgeContext() {
    if (
      !knowledgeFiles.length
    ) {
      return "";
    }

    const sections = [];

    let totalLength = 0;


    for (
      const file of knowledgeFiles
    ) {
      const section = [
        `FILE: ${file.name}`,
        `TYPE: ${file.type}`,
        "",
        file.content,
        "",
        "--------------------------------"
      ].join("\n");


      if (
        totalLength +
          section.length >
        MAX_KNOWLEDGE_CONTEXT
      ) {
        break;
      }


      sections.push(
        section
      );

      totalLength +=
        section.length;
    }


    return sections.join(
      "\n"
    );
  }


  /* =========================================================
     STORAGE SIZE
     ========================================================= */

  function calculateStorageSize() {
    try {
      let total = 0;

      total +=
        JSON.stringify(
          conversations
        ).length;

      total +=
        JSON.stringify(
          knowledgeFiles
        ).length;

      return total;
    } catch {
      return 0;
    }
  }


  /* =========================================================
     MEMORY STATISTICS
     ========================================================= */

  function updateMemoryStats() {
    const conversationTotal =
      conversations.length;

    const knowledgeTotal =
      knowledgeFiles.length;


    if (conversationCount) {
      conversationCount.textContent =
        String(
          conversationTotal
        );
    }


    if (
      settingsConversationCount
    ) {
      settingsConversationCount.textContent =
        String(
          conversationTotal
        );
    }


    if (
      settingsKnowledgeCount
    ) {
      settingsKnowledgeCount.textContent =
        String(
          knowledgeTotal
        );
    }


    if (storageSize) {
      storageSize.textContent =
        formatBytes(
          calculateStorageSize()
        );
    }
  }


  /* =========================================================
     CURRENT CONVERSATION
     ========================================================= */

  function getCurrentConversation() {
    return (
      conversations.find(
        conversation =>
          conversation.id ===
          currentConversationId
      ) || null
    );
  }


  /* =========================================================
     CREATE CONVERSATION
     ========================================================= */

  function createConversation() {
    const conversation = {
      id:
        createId(
          "conversation"
        ),

      title:
        "New Conversation",

      createdAt: now(),

      updatedAt: now(),

      messages: []
    };


    conversations.unshift(
      conversation
    );


    currentConversationId =
      conversation.id;


    saveConversations();


    return conversation;
  }


  /* =========================================================
     CONVERSATION TITLE
     ========================================================= */

  function createConversationTitle(
    messages
  ) {
    const firstUserMessage =
      messages.find(
        message =>
          message.role === "user"
      );


    if (!firstUserMessage) {
      return "New Conversation";
    }


    let title =
      safeString(
        firstUserMessage.content
      )
        .replace(
          /\s+/g,
          " "
        )
        .trim();


    if (!title) {
      return "New Conversation";
    }


    if (title.length > 42) {
      title =
        title
          .slice(0, 42)
          .trim() +
        "…";
    }


    return title;
  }


  function updateConversationTitle(
    conversation
  ) {
    if (!conversation) {
      return;
    }


    const userMessages =
      conversation.messages.filter(
        message =>
          message.role === "user"
      );


    if (
      conversation.title ===
        "New Conversation" &&
      userMessages.length
    ) {
      conversation.title =
        createConversationTitle(
          conversation.messages
        );
    }
  }


  /* =========================================================
     ADD MESSAGE
     ========================================================= */

  function addMessage(
    conversation,
    role,
    content
  ) {
    if (!conversation) {
      return null;
    }


    const message = {
      id:
        createId("msg"),

      role:
        role === "assistant"
          ? "assistant"
          : "user",

      content:
        safeString(content),

      createdAt: now()
    };


    conversation.messages.push(
      message
    );


    conversation.updatedAt =
      message.createdAt;


    updateConversationTitle(
      conversation
    );


    saveConversations();


    return message;
  }


  /* =========================================================
     API MESSAGE FORMAT
     ========================================================= */

  function getApiMessages(
    conversation
  ) {
    if (!conversation) {
      return [];
    }


    return conversation.messages.map(
      message => ({
        role:
          message.role,

        content:
          message.content
      })
    );
  }


  /* =========================================================
     HISTORY RENDERING
     ========================================================= */

  function renderHistory() {
    if (!conversationList) {
      return;
    }


    conversationList.innerHTML =
      "";


    if (!conversations.length) {
      const empty =
        document.createElement(
          "div"
        );

      empty.className =
        "history-empty";

      empty.textContent =
        "No conversations yet.";

      conversationList.appendChild(
        empty
      );

      updateMemoryStats();

      return;
    }


    for (
      const conversation of
        conversations
    ) {
      const item =
        document.createElement(
          "div"
        );

      item.className =
        "conversation-item";


      if (
        conversation.id ===
        currentConversationId
      ) {
        item.classList.add(
          "active"
        );
      }


      const selectButton =
        document.createElement(
          "button"
        );

      selectButton.type =
        "button";

      selectButton.className =
        "conversation-select";

      selectButton.dataset.id =
        conversation.id;


      const title =
        document.createElement(
          "div"
        );

      title.className =
        "conversation-title";

      title.textContent =
        conversation.title ||
        "New Conversation";


      const date =
        document.createElement(
          "div"
        );

      date.className =
        "conversation-date";

      date.textContent =
        formatDate(
          conversation.updatedAt
        );


      selectButton.appendChild(
        title
      );

      selectButton.appendChild(
        date
      );


      const deleteButton =
        document.createElement(
          "button"
        );

      deleteButton.type =
        "button";

      deleteButton.className =
        "conversation-delete";

      deleteButton.dataset.id =
        conversation.id;

      deleteButton.setAttribute(
        "aria-label",
        "Delete conversation"
      );

      deleteButton.textContent =
        "×";


      item.appendChild(
        selectButton
      );

      item.appendChild(
        deleteButton
      );


      conversationList.appendChild(
        item
      );
    }


    updateMemoryStats();
  }
     /* =========================================================
     CHAT RENDERING
     ========================================================= */

  function renderChat() {
    if (!chat) {
      return;
    }

    const conversation =
      getCurrentConversation();

    chat.innerHTML = "";

    if (
      !conversation ||
      !conversation.messages.length
    ) {
      if (welcome) {
        chat.appendChild(welcome);
        welcome.style.display = "";
      }

      return;
    }

    if (welcome) {
      welcome.style.display = "none";
    }

    for (
      const message of conversation.messages
    ) {
      renderMessage(
        message
      );
    }

    scrollChatToBottom();
  }

  /* =========================================================
     MESSAGE RENDERING
     ========================================================= */

  function renderMessage(
    message
  ) {
    if (!chat || !message) {
      return null;
    }

    const wrapper =
      document.createElement(
        "article"
      );

    wrapper.className =
      "message";

    wrapper.dataset.messageId =
      message.id;

    wrapper.dataset.role =
      message.role;

    const avatar =
      document.createElement(
        "div"
      );

    avatar.className =
      "message-avatar";

    avatar.textContent =
      message.role === "assistant"
        ? "A"
        : "You";

    const body =
      document.createElement(
        "div"
      );

    body.className =
      "message-body";

    const header =
      document.createElement(
        "div"
      );

    header.className =
      "message-meta";

    const role =
      document.createElement(
        "span"
      );

    role.className =
      "message-role";

    role.textContent =
      message.role === "assistant"
        ? "AURA"
        : "You";

    const time =
      document.createElement(
        "span"
      );

    time.className =
      "message-time";

    time.textContent =
      formatTime(
        message.createdAt
      );

    header.appendChild(
      role
    );

    header.appendChild(
      time
    );

    const content =
      document.createElement(
        "div"
      );

    content.className =
      "message-content";

    if (
      message.role === "assistant"
    ) {
      content.innerHTML =
        renderMarkdown(
          message.content
        );
    } else {
      content.textContent =
        message.content;
    }

    const actions =
      document.createElement(
        "div"
      );

    actions.className =
      "message-actions";

    const copyButton =
      document.createElement(
        "button"
      );

    copyButton.type =
      "button";

    copyButton.className =
      "message-action-button";

    copyButton.dataset.action =
      "copy";

    copyButton.dataset.messageId =
      message.id;

    copyButton.setAttribute(
      "aria-label",
      "Copy message"
    );

    copyButton.textContent =
      "Copy";

    actions.appendChild(
      copyButton
    );

    body.appendChild(
      header
    );

    body.appendChild(
      content
    );

    body.appendChild(
      actions
    );

    wrapper.appendChild(
      avatar
    );

    wrapper.appendChild(
      body
    );

    chat.appendChild(
      wrapper
    );

    return wrapper;
  }
    /* =========================================================
     TYPEWRITER RESPONSE
     ========================================================= */

  function sleep(milliseconds) {
    return new Promise(
      resolve =>
        setTimeout(
          resolve,
          milliseconds
        )
    );
  }

  async function typeAssistantMessage(
    conversation,
    content
  ) {
    if (!conversation) {
      return;
    }

    const message = {
      id:
        createId("msg"),

      role:
        "assistant",

      content:
        "",

      createdAt:
        now()
    };

    conversation.messages.push(
      message
    );

    conversation.updatedAt =
      message.createdAt;

    updateConversationTitle(
      conversation
    );

    saveConversations();

    removeThinkingMessage();

    const messageElement =
      renderMessage(
        message
      );

    const contentElement =
      messageElement?.querySelector(
        ".message-content"
      );

    if (!contentElement) {
      message.content =
        content;

      saveConversations();
      renderChat();

      return;
    }

    /*
      Reveal the response in small chunks.
      Chunking is more efficient than updating
      the DOM once for every individual character.
    */
    const text =
      safeString(content);

    let position = 0;

    const chunkSize = 2;

    while (
      position < text.length
    ) {
      message.content =
        text.slice(
          0,
          position + chunkSize
        );

      position +=
        chunkSize;

      contentElement.innerHTML =
        renderMarkdown(
          message.content
        );

      scrollChatToBottom();

      await sleep(12);
    }

    message.content =
      text;

    saveConversations();

    renderHistory();
  }

  /* =========================================================
     THINKING INDICATOR
     ========================================================= */

  function createThinkingMessage() {
    if (!chat) {
      return null;
    }

    removeThinkingMessage();

    const wrapper =
      document.createElement(
        "article"
      );

    wrapper.className =
      "message thinking-message";

    wrapper.dataset.thinking =
      "true";

    const avatar =
      document.createElement(
        "div"
      );

    avatar.className =
      "message-avatar";

    avatar.textContent =
      "A";

    const body =
      document.createElement(
        "div"
      );

    body.className =
      "message-body";

    const meta =
      document.createElement(
        "div"
      );

    meta.className =
      "message-meta";

    const role =
      document.createElement(
        "span"
      );

    role.className =
      "message-role";

    role.textContent =
      "AURA";

    meta.appendChild(
      role
    );

    const indicator =
      document.createElement(
        "div"
      );

    indicator.className =
      "thinking-indicator";

    const text =
      document.createElement(
        "span"
      );

    text.textContent =
      "Thinking";

    const dots =
      document.createElement(
        "span"
      );

    dots.className =
      "thinking-dots";

    for (
      let i = 0;
      i < 3;
      i++
    ) {
      const dot =
        document.createElement(
          "span"
        );

      dot.className =
        "thinking-dot";

      dots.appendChild(
        dot
      );
    }

    indicator.appendChild(
      text
    );

    indicator.appendChild(
      dots
    );

    body.appendChild(
      meta
    );

    body.appendChild(
      indicator
    );

    wrapper.appendChild(
      avatar
    );

    wrapper.appendChild(
      body
    );

    chat.appendChild(
      wrapper
    );

    scrollChatToBottom();

    return wrapper;
  }

  function removeThinkingMessage() {
    if (!chat) {
      return;
    }

    const thinking =
      chat.querySelector(
        '[data-thinking="true"]'
      );

    if (thinking) {
      thinking.remove();
    }
  }

  /* =========================================================
     SCROLLING
     ========================================================= */

  function scrollChatToBottom(
    smooth = true
  ) {
    if (!chat) {
      return;
    }

    requestAnimationFrame(() => {
      chat.scrollTo({
        top:
          chat.scrollHeight,
        behavior:
          smooth
            ? "smooth"
            : "auto"
      });
    });
  }

  /* =========================================================
     WELCOME SCREEN
     ========================================================= */

  function showWelcome() {
    if (!chat) {
      return;
    }

    removeThinkingMessage();

    chat.innerHTML = "";

    if (welcome) {
      welcome.style.display =
        "";

      chat.appendChild(
        welcome
      );
    }
  }

  function hideWelcome() {
    if (welcome) {
      welcome.style.display =
        "none";
    }
  }

  /* =========================================================
     INPUT STATE
     ========================================================= */

  function updateInputState() {
    if (!input) {
      return;
    }

    const hasText =
      input.value.trim()
        .length > 0;

    const hasImage =
      Boolean(selectedImage);

    if (sendButton) {
      sendButton.disabled =
        isGenerating ||
        (!hasText &&
          !hasImage);
    }

    input.style.height =
      "auto";

    const nextHeight =
      Math.min(
        input.scrollHeight,
        180
      );

    input.style.height =
      `${nextHeight}px`;
  }

  /* =========================================================
     GENERATION STATE
     ========================================================= */

  function setGenerating(
    generating
  ) {
    isGenerating =
      Boolean(generating);

    if (input) {
      input.disabled =
        isGenerating;
    }

    if (sendButton) {
      sendButton.disabled =
        isGenerating ||
        (
          !input ||
          (
            !input.value.trim() &&
            !selectedImage
          )
        );
    }

    if (isGenerating) {
      createThinkingMessage();
    } else {
      removeThinkingMessage();
    }
  }

  /* =========================================================
     COPY TO CLIPBOARD
     ========================================================= */

  async function copyText(
    text
  ) {
    const value =
      safeString(text);

    if (!value) {
      return false;
    }

    try {
      await navigator.clipboard.writeText(
        value
      );

      return true;
    } catch (error) {
      console.warn(
        "Clipboard API failed:",
        error
      );

      try {
        const textarea =
          document.createElement(
            "textarea"
          );

        textarea.value =
          value;

        textarea.style.position =
          "fixed";

        textarea.style.opacity =
          "0";

        document.body.appendChild(
          textarea
        );

        textarea.focus();
        textarea.select();

        const copied =
          document.execCommand(
            "copy"
          );

        textarea.remove();

        return copied;
      } catch {
        return false;
      }
    }
  }

  async function copyMessage(
    messageId,
    button
  ) {
    const conversation =
      getCurrentConversation();

    if (!conversation) {
      return;
    }

    const message =
      conversation.messages.find(
        item =>
          item.id ===
          messageId
      );

    if (!message) {
      return;
    }

    const copied =
      await copyText(
        message.content
      );

    if (!button) {
      return;
    }

    const originalText =
      button.textContent;

    button.textContent =
      copied
        ? "Copied"
        : "Failed";

    window.setTimeout(
      () => {
        button.textContent =
          originalText;
      },
      1200
    );
  }

  /* =========================================================
     CONVERSATION SELECTION
     ========================================================= */

  function selectConversation(
    conversationId
  ) {
    const conversation =
      conversations.find(
        item =>
          item.id ===
          conversationId
      );

    if (!conversation) {
      return;
    }

    currentConversationId =
      conversation.id;

    saveConversations();

    renderHistory();
    renderChat();

    closeHistoryPanel();
    focusInput();
  }

  /* =========================================================
     DELETE CONVERSATION
     ========================================================= */

  function deleteConversation(
    conversationId
  ) {
    const index =
      conversations.findIndex(
        item =>
          item.id ===
          conversationId
      );

    if (index === -1) {
      return;
    }

    conversations.splice(
      index,
      1
    );

    if (
      currentConversationId ===
      conversationId
    ) {
      if (conversations.length) {
        conversations.sort(
          (a, b) =>
            new Date(
              b.updatedAt
            ) -
            new Date(
              a.updatedAt
            )
        );

        currentConversationId =
          conversations[0].id;
      } else {
        currentConversationId =
          null;
      }
    }

    saveConversations();

    if (!currentConversationId) {
      createConversation();
    }

    renderHistory();
    renderChat();
  }

  /* =========================================================
     NEW CHAT
     ========================================================= */

  function startNewChat() {
    if (isGenerating) {
      return;
    }

    const current =
      getCurrentConversation();

    /*
      If the current chat is already empty,
      simply keep it instead of creating
      endless blank conversations.
    */
    if (
      current &&
      current.messages.length === 0
    ) {
      renderHistory();
      renderChat();
      focusInput();
      return;
    }

    createConversation();

    clearSelectedImage();
    clearInput();

    renderHistory();
    renderChat();

    closeHistoryPanel();
    focusInput();
  }

  /* =========================================================
     CLEAR ALL MEMORY
     ========================================================= */

  function clearAllMemory() {
    if (isGenerating) {
      return;
    }

    const confirmed =
      window.confirm(
        "Clear all conversations and saved knowledge?"
      );

    if (!confirmed) {
      return;
    }

    conversations = [];

    knowledgeFiles = [];

    currentConversationId =
      null;

    try {
      localStorage.removeItem(
        STORAGE_KEY
      );

      localStorage.removeItem(
        OLD_STORAGE_KEY
      );

      localStorage.removeItem(
        KNOWLEDGE_STORAGE_KEY
      );
    } catch (error) {
      console.error(
        "Unable to clear local memory:",
        error
      );
    }

    createConversation();

    clearSelectedImage();
    clearInput();

    renderHistory();
    renderChat();
    renderKnowledge();

    updateMemoryStats();
  }

  /* =========================================================
     HISTORY PANEL
     ========================================================= */

  function openHistoryPanel() {
    if (!historyPanel) {
      return;
    }

    historyPanel.classList.add(
      "open"
    );

    historyPanel.setAttribute(
      "aria-hidden",
      "false"
    );

    if (isMobile()) {
      document.body.classList.add(
        "history-open"
      );
    }
  }

  function closeHistoryPanel() {
    if (!historyPanel) {
      return;
    }

    historyPanel.classList.remove(
      "open"
    );

    historyPanel.setAttribute(
      "aria-hidden",
      "true"
    );

    document.body.classList.remove(
      "history-open"
    );
  }

  function toggleHistoryPanel() {
    if (!historyPanel) {
      return;
    }

    if (
      historyPanel.classList.contains(
        "open"
      )
    ) {
      closeHistoryPanel();
    } else {
      openHistoryPanel();
    }
  }

  /* =========================================================
     SETTINGS MODAL
     ========================================================= */

  function openSettings() {
    if (!settingsModal) {
      return;
    }

    settingsModal.classList.add(
      "open"
    );

    settingsModal.setAttribute(
      "aria-hidden",
      "false"
    );

    updateMemoryStats();
  }

  function closeSettings() {
    if (!settingsModal) {
      return;
    }

    settingsModal.classList.remove(
      "open"
    );

    settingsModal.setAttribute(
      "aria-hidden",
      "true"
    );
  }

  /* =========================================================
     FOCUS
     ========================================================= */

  function focusInput() {
    if (!input || isGenerating) {
      return;
    }

    window.setTimeout(
      () => {
        try {
          input.focus();
        } catch {
          /* Ignore focus errors */
        }
      },
      50
    );
  }

  /* =========================================================
     INPUT CLEAR
     ========================================================= */

  function clearInput() {
    if (!input) {
      return;
    }

    input.value = "";

    updateInputState();
  }

  /* =========================================================
     IMAGE HELPERS
     ========================================================= */

  function clearSelectedImage() {
    selectedImage =
      null;

    if (imageInput) {
      imageInput.value =
        "";
    }

    if (imagePreview) {
      imagePreview.classList.remove(
        "visible"
      );

      imagePreview.setAttribute(
        "aria-hidden",
        "true"
      );
    }

    if (imagePreviewImage) {
      imagePreviewImage.removeAttribute(
        "src"
      );
    }

    if (imagePreviewName) {
      imagePreviewName.textContent =
        "";
    }

    if (imagePreviewSize) {
      imagePreviewSize.textContent =
        "";
    }

    updateInputState();
  }

  function showImagePreview(
    file,
    dataURL
  ) {
    if (!imagePreview) {
      return;
    }

    if (imagePreviewImage) {
      imagePreviewImage.src =
        dataURL;
    }

    if (imagePreviewName) {
      imagePreviewName.textContent =
        file.name;
    }

    if (imagePreviewSize) {
      imagePreviewSize.textContent =
        formatBytes(
          file.size
        );
    }

    imagePreview.classList.add(
      "visible"
    );

    imagePreview.setAttribute(
      "aria-hidden",
      "false"
    );
  }

  /* =========================================================
     IMAGE FILE READER
     ========================================================= */

  function readFileAsDataURL(
    file
  ) {
    return new Promise(
      (
        resolve,
        reject
      ) => {
        const reader =
          new FileReader();

        reader.onload = () =>
          resolve(
            reader.result
          );

        reader.onerror = () =>
          reject(
            reader.error ||
              new Error(
                "Unable to read file."
              )
          );

        reader.readAsDataURL(
          file
        );
      }
    );
  }

  /* =========================================================
     IMAGE SELECTION
     ========================================================= */

  async function handleImageSelection(
    event
  ) {
    const file =
      event?.target?.files?.[0];

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
      window.alert(
        "Please select a JPG, PNG, or WebP image."
      );

      clearSelectedImage();
      return;
    }

    if (
      file.size >
      MAX_IMAGE_SIZE
    ) {
      window.alert(
        "That image is too large. Please choose an image under 8 MB."
      );

      clearSelectedImage();
      return;
    }

    try {
      const dataURL =
        await readFileAsDataURL(
          file
        );

      if (
        typeof dataURL !==
        "string"
      ) {
        throw new Error(
          "Invalid image data."
        );
      }

      selectedImage = {
        name:
          file.name,

        type:
          file.type,

        size:
          file.size,

        data:
          dataURL
      };

      showImagePreview(
        file,
        dataURL
      );

      updateInputState();
    } catch (error) {
      console.error(
        "Image loading error:",
        error
      );

      window.alert(
        "Unable to read that image."
      );

      clearSelectedImage();
    }
  }
     /* =========================================================
     KNOWLEDGE FILES
     ========================================================= */

  function renderKnowledge() {
    if (!knowledgeList) {
      return;
    }

    knowledgeList.innerHTML = "";

    if (!knowledgeFiles.length) {
      const empty =
        document.createElement("div");

      empty.className =
        "knowledge-empty";

      empty.textContent =
        "No knowledge files added yet.";

      knowledgeList.appendChild(
        empty
      );

      updateMemoryStats();

      return;
    }

    for (
      const file of knowledgeFiles
    ) {
      const item =
        document.createElement("div");

      item.className =
        "knowledge-item";

      item.dataset.id =
        file.id;

      const info =
        document.createElement("div");

      info.className =
        "knowledge-item-info";

      const name =
        document.createElement("div");

      name.className =
        "knowledge-item-name";

      name.textContent =
        file.name;

      const meta =
        document.createElement("div");

      meta.className =
        "knowledge-item-meta";

      meta.textContent =
        `${formatBytes(file.size)} • ${formatDate(
          file.createdAt
        )}`;

      info.appendChild(name);
      info.appendChild(meta);

      const removeButton =
        document.createElement("button");

      removeButton.type =
        "button";

      removeButton.className =
        "knowledge-remove-button";

      removeButton.dataset.id =
        file.id;

      removeButton.dataset.action =
        "remove-knowledge";

      removeButton.setAttribute(
        "aria-label",
        `Remove ${file.name}`
      );

      removeButton.textContent =
        "×";

      item.appendChild(info);
      item.appendChild(removeButton);

      knowledgeList.appendChild(
        item
      );
    }

    updateMemoryStats();
  }

  /* =========================================================
     KNOWLEDGE FILE READER
     ========================================================= */

  function readFileAsText(file) {
    return new Promise(
      (resolve, reject) => {
        const reader =
          new FileReader();

        reader.onload = () =>
          resolve(
            safeString(
              reader.result
            )
          );

        reader.onerror = () =>
          reject(
            reader.error ||
              new Error(
                "Unable to read file."
              )
          );

        reader.readAsText(file);
      }
    );
  }

  /* =========================================================
     ADD KNOWLEDGE FILE
     ========================================================= */

  async function addKnowledgeFile(
    file
  ) {
    if (!file) {
      return;
    }

    const fileName =
      safeString(
        file.name
      ).toLowerCase();

    const isTextFile =
      file.type ===
        "text/plain" ||
      fileName.endsWith(
        ".txt"
      );

    if (!isTextFile) {
      window.alert(
        "Please select a .txt file."
      );

      return;
    }

    /*
      localStorage is not suitable for
      extremely large files. Keep the
      browser-side knowledge store bounded.
    */
    const MAX_FILE_SIZE =
      2 * 1024 * 1024;

    if (
      file.size >
      MAX_FILE_SIZE
    ) {
      window.alert(
        "That text file is too large. Please keep knowledge files under 2 MB."
      );

      return;
    }

    try {
      const content =
        await readFileAsText(
          file
        );

      if (!content.trim()) {
        window.alert(
          "That text file is empty."
        );

        return;
      }

      const knowledge =
        normalizeKnowledge({
          id:
            createId(
              "knowledge"
            ),

          name:
            file.name,

          type:
            file.type ||
            "text/plain",

          size:
            file.size,

          content,

          createdAt:
            now()
        });

      if (!knowledge) {
        throw new Error(
          "Unable to create knowledge entry."
        );
      }

      knowledgeFiles.push(
        knowledge
      );

      saveKnowledge();
      renderKnowledge();

      if (knowledgeInput) {
        knowledgeInput.value =
          "";
      }
    } catch (error) {
      console.error(
        "Knowledge file error:",
        error
      );

      window.alert(
        "Unable to add that knowledge file."
      );
    }
  }

  /* =========================================================
     REMOVE KNOWLEDGE FILE
     ========================================================= */

  function removeKnowledgeFile(
    knowledgeId
  ) {
    const index =
      knowledgeFiles.findIndex(
        file =>
          file.id ===
          knowledgeId
      );

    if (index === -1) {
      return;
    }

    const file =
      knowledgeFiles[index];

    const confirmed =
      window.confirm(
        `Remove "${file.name}" from AURA's local knowledge?`
      );

    if (!confirmed) {
      return;
    }

    knowledgeFiles.splice(
      index,
      1
    );

    saveKnowledge();
    renderKnowledge();
  }

  /* =========================================================
     API REQUEST
     ========================================================= */

  async function requestAURA(
    conversation
  ) {
    if (!conversation) {
      throw new Error(
        "No active conversation."
      );
    }

    const messages =
      getApiMessages(
        conversation
      );

    if (!messages.length) {
      throw new Error(
        "No messages to send."
      );
    }

    const payload = {
      messages,

      knowledge:
        getKnowledgeContext(),

      image:
        selectedImage
          ? {
              name:
                selectedImage.name,

              type:
                selectedImage.type,

              size:
                selectedImage.size,

              data:
                selectedImage.data
            }
          : null
    };

    const controller =
      new AbortController();

    typingAbortController =
      controller;

    const response =
      await fetch(
        API_ENDPOINT,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(
              payload
            ),

          signal:
            controller.signal
        }
      );

    let data = null;

    try {
      data =
        await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const serverMessage =
        safeString(
          data?.error
        ).trim();

      throw new Error(
        serverMessage ||
          `Request failed with status ${response.status}.`
      );
    }

    const reply =
      safeString(
        data?.reply
      ).trim();

    if (!reply) {
      throw new Error(
        "AURA returned an empty response."
      );
    }

    return reply;
  }

  /* =========================================================
     ERROR MESSAGE
     ========================================================= */

  function getFriendlyError(
    error
  ) {
    if (!error) {
      return "Something went wrong.";
    }

    if (
      error.name ===
      "AbortError"
    ) {
      return "Generation was cancelled.";
    }

    const message =
      safeString(
        error.message
      ).trim();

    if (!message) {
      return "AURA couldn't complete the request.";
    }

    return message;
  }

  /* =========================================================
     SEND MESSAGE
     ========================================================= */

  async function sendMessage() {
    if (isGenerating) {
      return;
    }

    const text =
      input
        ? input.value.trim()
        : "";

    const hasImage =
      Boolean(selectedImage);

    if (!text && !hasImage) {
      return;
    }

    let conversation =
      getCurrentConversation();

    if (!conversation) {
      conversation =
        createConversation();
    }

    /*
      The actual image is sent to the API
      separately. The local conversation
      stores a lightweight marker instead of
      the base64 image, preventing localStorage
      from becoming huge.
    */
    let userContent =
      text;

    if (!userContent && hasImage) {
      userContent =
        "[Image attached]";
    } else if (
      hasImage
    ) {
      userContent =
        `${userContent}\n\n[Image attached]`;
    }

    addMessage(
      conversation,
      "user",
      userContent
    );

    clearInput();

    hideWelcome();

    renderHistory();
    renderChat();

    setGenerating(true);

    try {
      const reply =
        await requestAURA(
          conversation
        );

            await typeAssistantMessage(
        conversation,
        reply
      );
    } catch (error) {
      console.error(
        "AURA request error:",
        error
      );

      removeThinkingMessage();

      /*
        Do not permanently store an error
        as an assistant response. This keeps
        conversation history clean.
      */
      const errorWrapper =
        document.createElement(
          "article"
        );

      errorWrapper.className =
        "message message-error";

      const errorAvatar =
        document.createElement(
          "div"
        );

      errorAvatar.className =
        "message-avatar";

      errorAvatar.textContent =
        "!";

      const errorBody =
        document.createElement(
          "div"
        );

      errorBody.className =
        "message-body";

      const errorMeta =
        document.createElement(
          "div"
        );

      errorMeta.className =
        "message-meta";

      const errorRole =
        document.createElement(
          "span"
        );

      errorRole.className =
        "message-role";

      errorRole.textContent =
        "AURA";

      errorMeta.appendChild(
        errorRole
      );

      const errorContent =
        document.createElement(
          "div"
        );

      errorContent.className =
        "message-content";

      errorContent.textContent =
        getFriendlyError(
          error
        );

      errorBody.appendChild(
        errorMeta
      );

      errorBody.appendChild(
        errorContent
      );

      errorWrapper.appendChild(
        errorAvatar
      );

      errorWrapper.appendChild(
        errorBody
      );

      chat?.appendChild(
        errorWrapper
      );

      scrollChatToBottom();
    } finally {
      typingAbortController =
        null;

      clearSelectedImage();

      setGenerating(false);

      focusInput();
    }
  }

  /* =========================================================
     CANCEL GENERATION
     ========================================================= */

  function cancelGeneration() {
    if (
      typingAbortController
    ) {
      typingAbortController.abort();

      typingAbortController =
        null;
    }

    setGenerating(false);
  }

  /* =========================================================
     EXPORT MEMORY
     ========================================================= */

  function exportMemory() {
    const exportData = {
      app:
        "AURA",

      version:
        1,

      exportedAt:
        now(),

      conversations:
        conversations,

      knowledge:
        knowledgeFiles
    };

    try {
      const blob =
        new Blob(
          [
            JSON.stringify(
              exportData,
              null,
              2
            )
          ],
          {
            type:
              "application/json"
          }
        );

      const url =
        URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          "a"
        );

      link.href =
        url;

      link.download =
        `aura-memory-${new Date()
          .toISOString()
          .slice(0, 10)}.json`;

      document.body.appendChild(
        link
      );

      link.click();

      link.remove();

      URL.revokeObjectURL(
        url
      );
    } catch (error) {
      console.error(
        "Export error:",
        error
      );

      window.alert(
        "Unable to export AURA memory."
      );
    }
  }

  /* =========================================================
     IMPORT MEMORY
     ========================================================= */

  async function importMemory(
    event
  ) {
    const file =
      event?.target?.files?.[0];

    if (!file) {
      return;
    }

    try {
      const text =
        await readFileAsText(
          file
        );

      const parsed =
        JSON.parse(text);

      if (
        !parsed ||
        typeof parsed !==
          "object"
      ) {
        throw new Error(
          "Invalid backup format."
        );
      }

      const importedConversations =
        Array.isArray(
          parsed.conversations
        )
          ? parsed.conversations
              .map(
                normalizeConversation
              )
              .filter(Boolean)
          : [];

      const importedKnowledge =
        Array.isArray(
          parsed.knowledge
        )
          ? parsed.knowledge
              .map(
                normalizeKnowledge
              )
              .filter(Boolean)
          : [];

      if (
        !importedConversations.length &&
        !importedKnowledge.length
      ) {
        throw new Error(
          "The backup contains no AURA data."
        );
      }

      const confirmed =
        window.confirm(
          "Import this backup? Existing local memory will be replaced."
        );

      if (!confirmed) {
        return;
      }

      conversations =
        importedConversations;

      knowledgeFiles =
        importedKnowledge;

      conversations.sort(
        (a, b) =>
          new Date(
            b.updatedAt
          ) -
          new Date(
            a.updatedAt
          )
      );

      currentConversationId =
        conversations.length
          ? conversations[0].id
          : null;

      saveConversations();
      saveKnowledge();

      if (
        !currentConversationId
      ) {
        createConversation();
      }

      renderHistory();
      renderChat();
      renderKnowledge();

      window.alert(
        "AURA memory imported successfully."
      );
    } catch (error) {
      console.error(
        "Import error:",
        error
      );

      window.alert(
        `Unable to import backup: ${getFriendlyError(
          error
        )}`
      );
    } finally {
      if (importInput) {
        importInput.value =
          "";
      }
    }
  }
     /* =========================================================
     EVENT HANDLERS
     ========================================================= */

  function handleHistoryClick(event) {
    const target =
      event.target.closest(
        "button"
      );

    if (!target) {
      return;
    }

    const conversationId =
      target.dataset.id;

    if (!conversationId) {
      return;
    }

    if (
      target.classList.contains(
        "conversation-delete"
      )
    ) {
      event.stopPropagation();

      deleteConversation(
        conversationId
      );

      return;
    }

    if (
      target.classList.contains(
        "conversation-select"
      )
    ) {
      selectConversation(
        conversationId
      );
    }
  }

  /* =========================================================
     CHAT ACTION HANDLER
     ========================================================= */

  function handleChatClick(event) {
    const button =
      event.target.closest(
        "[data-action]"
      );

    if (!button) {
      return;
    }

    const action =
      button.dataset.action;

    if (action === "copy") {
      copyMessage(
        button.dataset.messageId,
        button
      );
    }
  }

  /* =========================================================
     KNOWLEDGE ACTION HANDLER
     ========================================================= */

  function handleKnowledgeClick(
    event
  ) {
    const button =
      event.target.closest(
        "[data-action]"
      );

    if (!button) {
      return;
    }

    if (
      button.dataset.action ===
      "remove-knowledge"
    ) {
      removeKnowledgeFile(
        button.dataset.id
      );
    }
  }

  /* =========================================================
     SUGGESTION BUTTONS
     ========================================================= */

  function getSuggestionText(
    element
  ) {
    if (!element) {
      return "";
    }

    return (
      element.dataset.prompt ||
      element.dataset.message ||
      element.getAttribute(
        "data-suggestion"
      ) ||
      element.textContent ||
      ""
    )
      .trim();
  }

  function handleSuggestionClick(
    event
  ) {
    const target =
      event.target.closest(
        "[data-prompt], [data-message], [data-suggestion]"
      );

    if (!target) {
      return;
    }

    const suggestion =
      getSuggestionText(
        target
      );

    if (!suggestion || !input) {
      return;
    }

    if (isGenerating) {
      return;
    }

    input.value =
      suggestion;

    updateInputState();

    hideWelcome();

    focusInput();

    /*
      If the UI uses buttons specifically
      intended to immediately send prompts,
      data-send="true" enables that behavior.
    */
    if (
      target.dataset.send ===
      "true"
    ) {
      sendMessage();
    }
  }

  /* =========================================================
     KEYBOARD HANDLING
     ========================================================= */

  function handleInputKeydown(
    event
  ) {
    if (!input) {
      return;
    }

    /*
      Enter sends the message.
      Shift + Enter creates a new line.
    */
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      if (
        !isGenerating &&
        (
          input.value.trim() ||
          selectedImage
        )
      ) {
        sendMessage();
      }
    }
  }

  /* =========================================================
     INPUT EVENT
     ========================================================= */

  function handleInput() {
    updateInputState();
  }

  /* =========================================================
     OUTSIDE MODAL CLICK
     ========================================================= */

  function handleModalClick(
    event
  ) {
    if (!settingsModal) {
      return;
    }

    if (
      event.target ===
      settingsModal
    ) {
      closeSettings();
    }
  }

  /* =========================================================
     ESCAPE KEY
     ========================================================= */

  function handleGlobalKeydown(
    event
  ) {
    if (
      event.key !==
      "Escape"
    ) {
      return;
    }

    if (
      settingsModal &&
      settingsModal.classList.contains(
        "open"
      )
    ) {
      closeSettings();

      return;
    }

    if (
      historyPanel &&
      historyPanel.classList.contains(
        "open"
      )
    ) {
      closeHistoryPanel();

      return;
    }

    if (isGenerating) {
      cancelGeneration();
    }
  }

  /* =========================================================
     RESIZE HANDLING
     ========================================================= */

  function handleWindowResize() {
    updateInputState();

    /*
      When returning to desktop layout,
      remove the mobile-only body state.
    */
    if (!isMobile()) {
      document.body.classList.remove(
        "history-open"
      );
    }
  }

  /* =========================================================
     EVENT LISTENERS
     ========================================================= */

  function bindEvents() {
    if (messageForm) {
      messageForm.addEventListener(
        "submit",
        event => {
          event.preventDefault();

          sendMessage();
        }
      );
    }

    if (input) {
      input.addEventListener(
        "input",
        handleInput
      );

      input.addEventListener(
        "keydown",
        handleInputKeydown
      );
    }

    if (sendButton) {
      sendButton.addEventListener(
        "click",
        event => {
          event.preventDefault();

          sendMessage();
        }
      );
    }

    if (newChatButton) {
      newChatButton.addEventListener(
        "click",
        startNewChat
      );
    }

    if (clearMemoryButton) {
      clearMemoryButton.addEventListener(
        "click",
        clearAllMemory
      );
    }

    if (conversationList) {
      conversationList.addEventListener(
        "click",
        handleHistoryClick
      );
    }

    if (chat) {
      chat.addEventListener(
        "click",
        handleChatClick
      );
    }

    if (knowledgeList) {
      knowledgeList.addEventListener(
        "click",
        handleKnowledgeClick
      );
    }

    if (openHistoryButton) {
      openHistoryButton.addEventListener(
        "click",
        openHistoryPanel
      );
    }

    if (closeHistoryButton) {
      closeHistoryButton.addEventListener(
        "click",
        closeHistoryPanel
      );
    }

    if (settingsButton) {
      settingsButton.addEventListener(
        "click",
        openSettings
      );
    }

    if (closeSettingsButton) {
      closeSettingsButton.addEventListener(
        "click",
        closeSettings
      );
    }

    if (settingsModal) {
      settingsModal.addEventListener(
        "click",
        handleModalClick
      );
    }

    if (settingsClearButton) {
      settingsClearButton.addEventListener(
        "click",
        () => {
          closeSettings();
          clearAllMemory();
        }
      );
    }

    if (exportButton) {
      exportButton.addEventListener(
        "click",
        exportMemory
      );
    }

    if (importInput) {
      importInput.addEventListener(
        "change",
        importMemory
      );
    }

    if (imageInput) {
      imageInput.addEventListener(
        "change",
        handleImageSelection
      );
    }

    if (removeImageButton) {
      removeImageButton.addEventListener(
        "click",
        clearSelectedImage
      );
    }

    document.addEventListener(
      "click",
      handleSuggestionClick
    );

    document.addEventListener(
      "keydown",
      handleGlobalKeydown
    );

    window.addEventListener(
      "resize",
      handleWindowResize
    );
  }

  /* =========================================================
     INITIALIZATION HELPERS
     ========================================================= */

  function ensureConversation() {
    if (
      conversations.length === 0
    ) {
      createConversation();

      return;
    }

    const current =
      getCurrentConversation();

    if (!current) {
      conversations.sort(
        (a, b) =>
          new Date(
            b.updatedAt
          ) -
          new Date(
            a.updatedAt
          )
      );

      currentConversationId =
        conversations[0].id;

      saveConversations();
    }
  }

  function initializeUI() {
    if (historyPanel) {
      historyPanel.setAttribute(
        "aria-hidden",
        historyPanel.classList.contains(
          "open"
        )
          ? "false"
          : "true"
      );
    }

    if (settingsModal) {
      settingsModal.setAttribute(
        "aria-hidden",
        settingsModal.classList.contains(
          "open"
        )
          ? "false"
          : "true"
      );
    }

    if (imagePreview) {
      imagePreview.setAttribute(
        "aria-hidden",
        imagePreview.classList.contains(
          "visible"
        )
          ? "false"
          : "true"
      );
    }

    updateMemoryStats();
    updateInputState();
  }

  /* =========================================================
     INITIALIZATION
     ========================================================= */

  function initialize() {
    loadConversations();

    loadKnowledge();

    ensureConversation();

    bindEvents();

    renderHistory();

    renderKnowledge();

    const current =
      getCurrentConversation();

    if (
      current &&
      current.messages.length
    ) {
      renderChat();
    } else {
      showWelcome();
    }

    initializeUI();

    focusInput();
  }

  /* =========================================================
     START AURA
     ========================================================= */

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      {
        once: true
      }
    );
  } else {
    initialize();
       }
     /* =========================================================
     FINAL STATE SYNC
     ========================================================= */

  /*
    Keep the send button state correct if the
    browser restores an input value automatically.
  */
  window.addEventListener(
    "pageshow",
    () => {
      updateInputState();
    }
  );

  /*
    Save any last in-memory state before the
    page is unloaded.
  */
  window.addEventListener(
    "beforeunload",
    () => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(
            conversations
          )
        );

        localStorage.setItem(
          KNOWLEDGE_STORAGE_KEY,
          JSON.stringify(
            knowledgeFiles
          )
        );
      } catch (error) {
        console.warn(
          "Final memory save failed:",
          error
        );
      }
    }
  );

  /* =========================================================
     AURA READY
     ========================================================= */

  console.log(
    "AURA initialized successfully."
  );

})();
