const { marked } = require('marked');
const AIService = require('./ai-service');
const hljs = require('highlight.js/lib/core');

// Base languages
const javascript = require('highlight.js/lib/languages/javascript');
const typescript = require('highlight.js/lib/languages/typescript');
const python = require('highlight.js/lib/languages/python');
const ruby = require('highlight.js/lib/languages/ruby');
const php = require('highlight.js/lib/languages/php');
const xml = require('highlight.js/lib/languages/xml');
const css = require('highlight.js/lib/languages/css');
const sql = require('highlight.js/lib/languages/sql');
const bash = require('highlight.js/lib/languages/bash');
const json = require('highlight.js/lib/languages/json');
const yaml = require('highlight.js/lib/languages/yaml');

// Modern languages
const rust = require('highlight.js/lib/languages/rust');
const go = require('highlight.js/lib/languages/go');
const kotlin = require('highlight.js/lib/languages/kotlin');
const swift = require('highlight.js/lib/languages/swift');
const dart = require('highlight.js/lib/languages/dart');
const elixir = require('highlight.js/lib/languages/elixir');

// Web frameworks and related
const jsx = require('highlight.js/lib/languages/javascript');  // JSX uses JS highlighter
const tsx = require('highlight.js/lib/languages/typescript');  // TSX uses TS highlighter
const vue = require('highlight.js/lib/languages/xml');        // Vue uses XML/HTML highlighter
const scss = require('highlight.js/lib/languages/scss');
const less = require('highlight.js/lib/languages/less');
const graphql = require('highlight.js/lib/languages/graphql');

// Infrastructure and config
const dockerfile = require('highlight.js/lib/languages/dockerfile');
const nginx = require('highlight.js/lib/languages/nginx');

class PulsarAIView {
  constructor(serializedState = {}) {
    // Register base languages
    hljs.registerLanguage('javascript', javascript);
    hljs.registerLanguage('typescript', typescript);
    hljs.registerLanguage('python', python);
    hljs.registerLanguage('ruby', ruby);
    hljs.registerLanguage('php', php);
    hljs.registerLanguage('html', xml);
    hljs.registerLanguage('css', css);
    hljs.registerLanguage('sql', sql);
    hljs.registerLanguage('bash', bash);
    hljs.registerLanguage('json', json);
    hljs.registerLanguage('yaml', yaml);

    // Register modern languages
    hljs.registerLanguage('rust', rust);
    hljs.registerLanguage('go', go);
    hljs.registerLanguage('kotlin', kotlin);
    hljs.registerLanguage('swift', swift);
    hljs.registerLanguage('dart', dart);
    hljs.registerLanguage('elixir', elixir);

    // Register web frameworks and related
    hljs.registerLanguage('jsx', jsx);
    hljs.registerLanguage('tsx', tsx);
    hljs.registerLanguage('vue', vue);
    hljs.registerLanguage('scss', scss);
    hljs.registerLanguage('less', less);
    hljs.registerLanguage('graphql', graphql);

    // Register infrastructure and config
    hljs.registerLanguage('dockerfile', dockerfile);
    hljs.registerLanguage('nginx', nginx);

    // Setup marked with highlight.js
    this.marked = marked;
    this.marked.setOptions({
      breaks: true,
      gfm: true,
      highlight: function(code, lang) {
        console.log('Highlighting code:', { lang, codePreview: code.slice(0, 50) });

        if (lang && hljs.getLanguage(lang)) {
          try {
            const result = hljs.highlight(code, {
              language: lang,
              ignoreIllegals: true
            }).value;
            console.log('Highlighting successful');
            return result;
          } catch (err) {
            console.error('Highlighting error:', err);
            return code;
          }
        }

        console.log('No language specified or language not supported');
        return code;
      }
    });

    this.aiService = new AIService();
    this.messages = [];
    this.element = document.createElement('div');
    this.element.classList.add('pulsar-ai-container');

    // Header with icon
    const header = document.createElement('div');
    header.classList.add('pulsar-ai-header');
    const icon = document.createElement('span');
    icon.classList.add('icon', 'icon-book');
    const title = document.createElement('span');
    title.textContent = 'Pulsar AI';
    header.appendChild(icon);
    header.appendChild(title);

    // Select for models
    const selectContainer = document.createElement('div');
    selectContainer.classList.add('pulsar-ai-select-container');
    this.modelSelect = document.createElement('select');
    this.modelSelect.classList.add('input-select');

    const models = [
      // OpenAI
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini', group: 'OpenAI' },
      { value: 'gpt-4o', label: 'GPT-4o', group: 'OpenAI' },
      // Anthropic
      { value: 'claude-3-opus-latest', label: 'Claude 3 Opus', group: 'Anthropic' },
      { value: 'claude-3-5-sonnet-latest', label: 'Claude 3-5 Sonnet', group: 'Anthropic' },
      { value: 'claude-3-5-haiku-latest', label: 'Claude 3-5 Haiku', group: 'Anthropic' },
      // Mistral
      { value: 'mistral-large', label: 'Mistral Large', group: 'Mistral' },
      { value: 'mistral-medium', label: 'Mistral Medium', group: 'Mistral' },
      { value: 'mistral-small', label: 'Mistral Small', group: 'Mistral' }
    ];

    let currentGroup = '';
    models.forEach(model => {
      if (currentGroup !== model.group) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = model.group;
        this.modelSelect.appendChild(optgroup);
        currentGroup = model.group;
      }
      const option = document.createElement('option');
      option.value = model.value;
      option.textContent = model.label;
      this.modelSelect.lastChild.appendChild(option);
    });

    // Set default template from config
    const defaultModel = atom.config.get('pulsar-ai.defaultModel');
    if (defaultModel) {
      this.modelSelect.value = defaultModel;
    }

    selectContainer.appendChild(this.modelSelect);

    // Add a listener for model change
    this.modelSelect.addEventListener('change', () => {
      this.clearMessages();
    });

    // Message area
    this.messagesContainer = document.createElement('div');
    this.messagesContainer.classList.add('pulsar-ai-messages');

    // Input area at the bottom
    const inputContainer = document.createElement('div');
    inputContainer.classList.add('pulsar-ai-input-container');

    this.textarea = document.createElement('textarea');
    this.textarea.classList.add('input-textarea', 'native-key-bindings');
    this.textarea.setAttribute('placeholder', 'Write your message here...');

    // Ctrl+Enter management to send
    this.textarea.addEventListener('keydown', async (event) => {
      if (event.key === 'Enter' && event.ctrlKey) {
        event.preventDefault();
        await this.sendMessage();
      }
    });

    this.sendButton = document.createElement('button');
    this.sendButton.classList.add('btn', 'btn-primary', 'icon', 'icon-paper-airplane');
    this.sendButton.textContent = 'Send';
    this.sendButton.addEventListener('click', () => this.sendMessage());

    // Create the container for the controls at the bottom
    const bottomControls = document.createElement('div');
    bottomControls.classList.add('pulsar-ai-bottom-controls');

    // Create the file sharing button
    this.shareFileButton = document.createElement('button');
    this.shareFileButton.classList.add('btn', 'share-file-button');
    this.shareFileButton.style.display = 'none'; // Hidden by default

    this.shareFileCheckbox = document.createElement('input');
    this.shareFileCheckbox.type = 'checkbox';
    this.shareFileCheckbox.checked = false; // Unchecked by default
    this.shareFileCheckbox.classList.add('share-file-checkbox');

    this.shareFileLabel = document.createElement('span');
    this.shareFileLabel.classList.add('share-file-label');

    this.shareFileButton.appendChild(this.shareFileCheckbox);
    this.shareFileButton.appendChild(this.shareFileLabel);

    // Create the footer
    const footer = document.createElement('div');
    footer.classList.add('pulsar-ai-footer');

    // Text "Made with prayer"
    const madeWith = document.createElement('span');
    madeWith.classList.add('made-with');
    madeWith.innerHTML = '† Made with 🙏 in 🇫🇷 †';
    footer.appendChild(madeWith);

    // Button Buy me a coffee
    const coffeeLink = document.createElement('a');
    coffeeLink.href = 'https://mjerem34.github.io/pay-or-pray/';
    coffeeLink.target = '_blank';
    coffeeLink.classList.add('coffee-button');
    coffeeLink.textContent = 'Buy me a coffee  ☕';
    footer.appendChild(coffeeLink);

    // Update button status when editor changes
    this.updateShareFileButton();
    atom.workspace.onDidChangeActiveTextEditor(() => {
      this.updateShareFileButton();
    });

    inputContainer.appendChild(this.textarea);
    inputContainer.appendChild(this.sendButton);
    bottomControls.appendChild(this.shareFileButton);

    // Assembly
    this.element.appendChild(header);
    this.element.appendChild(selectContainer);
    this.element.appendChild(this.messagesContainer);
    this.element.appendChild(inputContainer);
    this.element.appendChild(bottomControls);
    this.element.appendChild(footer);

    // Restore messages if present in state
    if (serializedState.messages) {
      this.messages = serializedState.messages;
      this.renderMessages();
    }
  }

  // Methods for file management
  async getActiveEditorContent() {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) return null;

    const filePath = editor.getPath();
    if (!filePath) return null;

    return {
      content: editor.getText(),
      filename: filePath.split('/').pop(),
      language: editor.getGrammar().name,
      path: filePath
    };
  }

  isFileAlreadyShared(filePath) {
    return this.messages.some(msg =>
      msg.metadata && msg.metadata.sharedFiles &&
      msg.metadata.sharedFiles.includes(filePath)
    );
  }

  async updateShareFileButton() {
    const editorContent = await this.getActiveEditorContent();

    if (editorContent) {
      const isShared = this.isFileAlreadyShared(editorContent.path);
      this.shareFileButton.style.display = 'flex';
      this.shareFileLabel.textContent = ` ${editorContent.filename}`;
      // Only update the checkbox if the file is already shared
      if (isShared) {
        this.shareFileCheckbox.checked = false;
      }
    } else {
      this.shareFileButton.style.display = 'none';
    }
  }

  // Message handling methods
  async addMessage(role, content, metadata = null) {
    const message = { role, content, metadata };
    this.messages.push(message);
    await this.renderMessage(message);
  }

  async renderMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('pulsar-ai-message', `pulsar-ai-message-${message.role}`);

    const contentElement = document.createElement('div');
    contentElement.classList.add('pulsar-ai-message-content');

    // Save Code Blocks
    const codeBlocks = new Map();
    let codeBlockCounter = 0;
    const processedContent = message.content.replace(/```(\w+)?\n([\s\S]*?)\n```/g, (match, language, code) => {
      console.log('Found code block:', { language, codePreview: code.slice(0, 50) });
      const placeholder = `CODE_BLOCK_${codeBlockCounter}`;
      codeBlocks.set(placeholder, { language: language || '', code: code.trim() });
      codeBlockCounter++;
      return placeholder;
    });

    // Convert the rest to Markdown
    let htmlContent = this.marked.parse(processedContent);

    // Restore Code Blocks
    codeBlocks.forEach((block, placeholder) => {
      console.log('Processing code block for language:', block.language);

      let highlightedCode = block.code;
      if (block.language && hljs.getLanguage(block.language)) {
        try {
          highlightedCode = hljs.highlight(block.code, {
            language: block.language,
            ignoreIllegals: true
          }).value;
          console.log('Highlighting successful, preview:', highlightedCode.slice(0, 100));
        } catch (err) {
          console.error('Error highlighting:', err);
        }
      }

      const hasCodeSelection = message.metadata && message.metadata.codeSelection;
      const applyButton = hasCodeSelection ?
        `<button class="btn btn-xs btn-apply icon icon-check">Apply</button>` : '';

      const codeHtml = `
        <div class="code-block-wrapper">
          <div class="code-block-actions">
            <button class="btn btn-xs btn-copy icon icon-clippy">Copy</button>
            ${applyButton}
          </div>
          <pre class="code-block"><code class="hljs language-${block.language}">${highlightedCode}</code></pre>
        </div>
      `;

      htmlContent = htmlContent.replace(placeholder, codeHtml);
    });

    contentElement.innerHTML = htmlContent;

    // Add listeners for copy and apply buttons
    contentElement.querySelectorAll('.btn-copy').forEach(button => {
      button.addEventListener('click', (e) => {
        const code = e.target.closest('.code-block-wrapper').querySelector('code').textContent;
        atom.clipboard.write(code);

        // Visual feedback
        const originalText = e.target.textContent;
        e.target.textContent = 'Copied !';
        e.target.classList.add('btn-success');

        setTimeout(() => {
          e.target.textContent = originalText;
          e.target.classList.remove('btn-success');
        }, 2000);
      });
    });

    // Add listeners for app buttons
    contentElement.querySelectorAll('.btn-apply').forEach(button => {
      button.addEventListener('click', (e) => {
        const code = e.target.closest('.code-block-wrapper').querySelector('code').textContent;

        if (message.metadata && message.metadata.codeSelection) {
          const { editor, selection } = message.metadata.codeSelection;
          if (editor && editor.getBuffer()) {
            editor.setTextInBufferRange(selection, code);

            // Visual feedback
            const originalText = e.target.textContent;
            e.target.textContent = 'Applied !';
            e.target.classList.add('btn-success');

            setTimeout(() => {
              e.target.textContent = originalText;
              e.target.classList.remove('btn-success');
            }, 2000);
          }
        }
      });
    });

    messageElement.appendChild(contentElement);
    this.messagesContainer.appendChild(messageElement);

    // Scroll to bottom
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  // Utility method to escape HTML characters
  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async renderMessages() {
    this.messagesContainer.innerHTML = '';
    for (const message of this.messages) {
      await this.renderMessage(message);
    }
  }

  async sendMessage() {
    const content = this.textarea.value.trim();
    if (!content) return;

    try {
      this.setLoading(true);

      // Check if the active file should be shared
      const editorContent = await this.getActiveEditorContent();
      if (editorContent && this.shareFileCheckbox.checked && !this.isFileAlreadyShared(editorContent.path)) {
        // Add a system message with the contents of the file
        const fileMessage = `Here is the content of the file '${editorContent.filename}' (${editorContent.language}):\n\`\`\`${editorContent.language.toLowerCase()}\n${editorContent.content}\n\`\`\``;
        await this.addMessage('system', fileMessage, {
          sharedFiles: [editorContent.path]
        });
      }

      // Add user message
      await this.addMessage('user', content);
      this.textarea.value = '';

      // Get the answer from AI
      const response = await this.aiService.sendMessage(
        this.modelSelect.value,
        this.messages
      );

      // Copy selection metadata from last user message to reply
      const lastMessage = this.messages[this.messages.length - 1];
      const metadata = lastMessage.metadata && lastMessage.metadata.codeSelection ?
        { codeSelection: lastMessage.metadata.codeSelection } : null;

      // Add the answer with the copied metadata
      await this.addMessage('assistant', response.content, metadata);

    } catch (error) {
      atom.notifications.addError('Error sending message', {
        detail: error.message,
        dismissable: true
      });
      console.error('Error sendMessage:', error);
    } finally {
      this.setLoading(false);
    }
  }

  setLoading(isLoading) {
    this.sendButton.disabled = isLoading;
    this.textarea.disabled = isLoading;
    this.modelSelect.disabled = isLoading;

    if (isLoading) {
      this.sendButton.classList.add('is-loading');
    } else {
      this.sendButton.classList.remove('is-loading');
    }
  }

  clearMessages() {
    this.messages = [];
    this.messagesContainer.innerHTML = '';
  }

  destroy() {
    this.element.remove();
  }

  getElement() {
    return this.element;
  }

  getTitle() {
    return 'Pulsar AI';
  }

  getURI() {
    return 'atom://pulsar-ai-view';
  }

  getIconName() {
    return 'book';
  }

  serialize() {
    return {
      deserializer: 'pulsar-ai/PulsarAIView',
      messages: this.messages
    };
  }
}

module.exports = PulsarAIView;
