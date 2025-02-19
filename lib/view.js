const { marked } = require('marked');
const AIService = require('./ai-service');
const hljs = require('highlight.js/lib/core');
const { Range, Point } = require('atom');

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
    // Add this property to store current selection
    this.currentCodeSelection = null;
    // Register languages
    this.registerLanguages();

    // Setup marked with highlight.js
    this.setupMarked();

    this.aiService = new AIService();
    this.messages = [];

    // Create and setup UI
    this.setupUI();

    // Restore messages if present in state
    if (serializedState.messages) {
      this.messages = serializedState.messages;
      this.renderMessages();
    }
  }

  // Helper method to safely serialize range
  serializeRange(range) {
    if (!range) return null;
    return {
      start: { row: range.start.row, column: range.start.column },
      end: { row: range.end.row, column: range.end.column }
    };
  }

  // Helper method to safely process code selection metadata
  processCodeSelectionMetadata(metadata) {
    if (!metadata || !metadata.codeSelection) return metadata;

    const { editor, selection } = metadata.codeSelection;
    if (!editor || !selection) return metadata;

    return {
      ...metadata,
      codeSelection: {
        filePath: editor.getPath(),
        selection: this.serializeRange(selection)
      }
    };
  }

  // Helper method to create buffer range from serialized format
  createBufferRange(serializedRange) {
    // if (!serializedRange?.start?.row !== undefined) return null;

    try {
      const Range = require('atom').Range;
      return new Range(
        [serializedRange.start.row, serializedRange.start.column],
        [serializedRange.end.row, serializedRange.end.column]
      );
    } catch (error) {
      console.error('Error creating buffer range:', error);
      return null;
    }
  }

  registerLanguages() {
    // Base languages
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

    // Modern languages
    hljs.registerLanguage('rust', rust);
    hljs.registerLanguage('go', go);
    hljs.registerLanguage('kotlin', kotlin);
    hljs.registerLanguage('swift', swift);
    hljs.registerLanguage('dart', dart);
    hljs.registerLanguage('elixir', elixir);

    // Web frameworks and related
    hljs.registerLanguage('jsx', jsx);
    hljs.registerLanguage('tsx', tsx);
    hljs.registerLanguage('vue', vue);
    hljs.registerLanguage('scss', scss);
    hljs.registerLanguage('less', less);
    hljs.registerLanguage('graphql', graphql);

    // Infrastructure and config
    hljs.registerLanguage('dockerfile', dockerfile);
    hljs.registerLanguage('nginx', nginx);
  }

  setupMarked() {
    this.marked = marked;
    this.marked.setOptions({
      breaks: true,
      gfm: true,
      highlight: (code, lang) => {
        if (lang && hljs.getLanguage(lang)) {
          try {
            return hljs.highlight(code, {
              language: lang,
              ignoreIllegals: true
            }).value;
          } catch (err) {
            console.error('Highlighting error:', err);
            return code;
          }
        }
        return code;
      }
    });
  }

  setupUI() {
    // Create main container
    this.element = document.createElement('div');
    this.element.classList.add('pulsar-ai-container');

    // Add header
    this.setupHeader();

    // Add model selector
    this.setupModelSelector();

    // Add messages container
    this.messagesContainer = document.createElement('div');
    this.messagesContainer.classList.add('pulsar-ai-messages');

    // Add input area
    this.setupInputArea();

    // Add bottom controls
    this.setupBottomControls();

    // Add footer
    this.setupFooter();

    // Assemble all elements
    this.element.appendChild(this.header);
    this.element.appendChild(this.selectContainer);
    this.element.appendChild(this.messagesContainer);
    this.element.appendChild(this.inputContainer);
    this.element.appendChild(this.bottomControls);
    this.element.appendChild(this.footer);

    // Setup file sharing button updates
    this.updateShareFileButton();
    atom.workspace.onDidChangeActiveTextEditor(() => {
      this.updateShareFileButton();
    });
  }

  setupHeader() {
    this.header = document.createElement('div');
    this.header.classList.add('pulsar-ai-header');

    const icon = document.createElement('span');
    icon.classList.add('icon', 'icon-book');

    const title = document.createElement('span');
    title.textContent = 'Pulsar AI';

    this.header.appendChild(icon);
    this.header.appendChild(title);
  }

  setupModelSelector() {
    this.selectContainer = document.createElement('div');
    this.selectContainer.classList.add('pulsar-ai-select-container');

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

    // Set default model from config
    const defaultModel = atom.config.get('pulsar-ai.defaultModel');
    if (defaultModel) {
      this.modelSelect.value = defaultModel;
    }

    this.modelSelect.addEventListener('change', () => {
      this.clearMessages();
    });

    this.selectContainer.appendChild(this.modelSelect);
  }

  setupInputArea() {
    this.inputContainer = document.createElement('div');
    this.inputContainer.classList.add('pulsar-ai-input-container');

    this.textarea = document.createElement('textarea');
    this.textarea.classList.add('input-textarea', 'native-key-bindings');
    this.textarea.setAttribute('placeholder', 'Write your message here...');

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

    this.inputContainer.appendChild(this.textarea);
    this.inputContainer.appendChild(this.sendButton);
  }

  setupBottomControls() {
    this.bottomControls = document.createElement('div');
    this.bottomControls.classList.add('pulsar-ai-bottom-controls');

    this.shareFileButton = document.createElement('button');
    this.shareFileButton.classList.add('btn', 'share-file-button');
    this.shareFileButton.style.display = 'none';

    this.shareFileCheckbox = document.createElement('input');
    this.shareFileCheckbox.type = 'checkbox';
    this.shareFileCheckbox.checked = false;
    this.shareFileCheckbox.classList.add('share-file-checkbox');

    this.shareFileLabel = document.createElement('span');
    this.shareFileLabel.classList.add('share-file-label');

    this.shareFileButton.appendChild(this.shareFileCheckbox);
    this.shareFileButton.appendChild(this.shareFileLabel);

    this.bottomControls.appendChild(this.shareFileButton);
  }

  setupFooter() {
    this.footer = document.createElement('div');
    this.footer.classList.add('pulsar-ai-footer');

    const madeWith = document.createElement('span');
    madeWith.classList.add('made-with');
    madeWith.innerHTML = '† Made with 🙏 in 🇫🇷 †';
    this.footer.appendChild(madeWith);

    const coffeeLink = document.createElement('a');
    coffeeLink.href = 'https://mjerem34.github.io/pay-or-pray/';
    coffeeLink.target = '_blank';
    coffeeLink.classList.add('coffee-button');
    coffeeLink.textContent = 'Buy me a coffee ☕';
    this.footer.appendChild(coffeeLink);
  }

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
      msg.metadata?.sharedFiles?.includes(filePath)
    );
  }

  async updateShareFileButton() {
    const editorContent = await this.getActiveEditorContent();

    if (editorContent) {
      const isShared = this.isFileAlreadyShared(editorContent.path);
      this.shareFileButton.style.display = 'flex';
      this.shareFileLabel.textContent = ` ${editorContent.filename}`;
      if (isShared) {
        this.shareFileCheckbox.checked = false;
      }
    } else {
      this.shareFileButton.style.display = 'none';
    }
  }

  // Helper to safely store selection info
  getSelectionInfo(editor, selection) {
    if (!editor || !selection) return null;
    return {
      filePath: editor.getPath(),
      selection: {
        start: { row: selection.start.row, column: selection.start.column },
        end: { row: selection.end.row, column: selection.end.column }
      }
    };
  }

  async addMessage(role, content, metadata = null) {
    // Update currentCodeSelection from metadata
    if (metadata?.codeSelection) {
      // If we get editor reference, convert it to storable format
      if (metadata.codeSelection.editor && metadata.codeSelection.selection) {
        this.currentCodeSelection = this.getSelectionInfo(
          metadata.codeSelection.editor,
          metadata.codeSelection.selection
        );
      } else {
        // If we get already formatted metadata, use it directly
        this.currentCodeSelection = {
          filePath: metadata.codeSelection.filePath,
          selection: metadata.codeSelection.selection
        };
      }
    }

    // Create safe metadata for storage
    const safeMetadata = metadata?.codeSelection ? {
      codeSelection: this.currentCodeSelection
    } : metadata;

    const message = { role, content, metadata: safeMetadata };
    this.messages.push(message);
    await this.renderMessage(message);
  }

  async renderMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('pulsar-ai-message', `pulsar-ai-message-${message.role}`);

    const contentElement = document.createElement('div');
    contentElement.classList.add('pulsar-ai-message-content');

    // Process code blocks
    const codeBlocks = new Map();
    let codeBlockCounter = 0;
    const processedContent = message.content.replace(/```(\w+)?\n([\s\S]*?)\n```/g, (match, language, code) => {
      const placeholder = `CODE_BLOCK_${codeBlockCounter}`;
      codeBlocks.set(placeholder, { language: language || '', code: code.trim() });
      codeBlockCounter++;
      return placeholder;
    });

    // Convert to Markdown
    let htmlContent = this.marked.parse(processedContent);

    // Restore code blocks
    codeBlocks.forEach((block, placeholder) => {
      // Add Apply button only for assistant messages and if we have a selection

      const applyButton = (message.role === 'assistant' && this.currentCodeSelection) ?
        `<button class="btn btn-xs btn-apply icon icon-check">Apply</button>` : '';

      let highlightedCode = block.code;
      if (block.language && hljs.getLanguage(block.language)) {
        try {
          highlightedCode = hljs.highlight(block.code, {
            language: block.language,
            ignoreIllegals: true
          }).value;
        } catch (err) {
          console.error('Error highlighting:', err);
        }
      }

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

    // Add copy button handlers
    contentElement.querySelectorAll('.btn-copy').forEach(button => {
      button.addEventListener('click', (e) => {
        const code = e.target.closest('.code-block-wrapper').querySelector('code').textContent;
        atom.clipboard.write(code);

        // Visual feedback
        const originalText = e.target.textContent;
        e.target.textContent = 'Copied!';
        e.target.classList.add('btn-success');

        setTimeout(() => {
          e.target.textContent = originalText;
          e.target.classList.remove('btn-success');
        }, 2000);
      });
    });

    // Add apply button handlers
    contentElement.querySelectorAll('.btn-apply').forEach(button => {

      let highlightMarker = null;

      button.addEventListener('mouseenter', () => {
        if (!this.currentCodeSelection) return;

        const { filePath, selection } = this.currentCodeSelection;
        const editor = atom.workspace.getTextEditors().find(ed => ed.getPath() === filePath);

        if (editor) {
          const startPoint = new Point(selection.start.row, selection.start.column);
          const endPoint = new Point(selection.end.row, selection.end.column);
          const range = new Range(startPoint, endPoint);

          highlightMarker = editor.markBufferRange(range, {
            invalidate: 'never'
          });

          editor.decorateMarker(highlightMarker, {
            type: 'highlight',
            class: 'pulsar-ai-apply-highlight'
          });
        }
      });

      button.addEventListener('mouseleave', () => {
        if (highlightMarker) {
          highlightMarker.destroy();
          highlightMarker = null;
        }
      });

      button.addEventListener('click', async (e) => {
        try {
          const code = e.target.closest('.code-block-wrapper').querySelector('code').textContent;

          if (!this.currentCodeSelection) {
            atom.notifications.addWarning('No selection information available', {
              dismissable: true
            });
            return;
          }

          const { filePath, selection } = this.currentCodeSelection;

          // Get editor for the file
          let editor = atom.workspace.getTextEditors().find(ed => ed.getPath() === filePath);
          if (!editor) {
            editor = await atom.workspace.open(filePath);
          }

          if (!editor || !editor.isAlive()) {
            atom.notifications.addError('Failed to apply changes', {
              detail: 'Could not find or open the target editor.',
              dismissable: true
            });
            return;
          }

          const buffer = editor.getBuffer();
          const startPoint = new Point(selection.start.row, selection.start.column);
          const endPoint = new Point(selection.end.row, selection.end.column);
          const range = new Range(startPoint, endPoint);
          editor.setCursorBufferPosition(startPoint);
          editor.transact(() => {
            const originalIndent = editor.indentationForBufferRow(selection.start.row);
            const indentedCode = code.split('\n').map(line => {
              if (line.trim() === '') return '';
              return ' '.repeat(originalIndent * editor.getTabLength()) + line;
            }).join('\n');

            editor.setTextInBufferRange(range, indentedCode);
          });

          // Visual feedback
          button.textContent = 'Applied!';
          button.classList.add('btn-success');
          setTimeout(() => {
            button.textContent = 'Apply';
            button.classList.remove('btn-success');
          }, 2000);

        } catch (error) {
          console.error('Error applying changes:', error);
          atom.notifications.addError('Failed to apply changes', {
            detail: error.message,
            dismissable: true
          });
        }
      });
    });

    messageElement.appendChild(contentElement);
    this.messagesContainer.appendChild(messageElement);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
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

      // Get the current editor and selection
      const editor = atom.workspace.getActiveTextEditor();
      const selection = editor?.getSelectedBufferRange();

      // Store current selection for assistant's response
      if (editor && selection && !selection.isEmpty()) {
        this.currentCodeSelection = {
          filePath: editor.getPath(),
          selection: selection.serialize()
        };
      } else {
        this.currentCodeSelection = null;
      }

      // Handle file sharing first
      const editorContent = await this.getActiveEditorContent();
      if (editorContent && this.shareFileCheckbox.checked && !this.isFileAlreadyShared(editorContent.path)) {
        const fileMessage = `Here is the content of the file '${editorContent.filename}' (${editorContent.language}):\n\`\`\`${editorContent.language.toLowerCase()}\n${editorContent.content}\n\`\`\``;
        await this.addMessage('system', fileMessage, {
          sharedFiles: [editorContent.path]
        });
      }

      // Add user message with selection metadata
      await this.addMessage('user', content, this.currentCodeSelection ? {
        codeSelection: this.currentCodeSelection
      } : null);
      this.textarea.value = '';

      // Get AI response
      const response = await this.aiService.sendMessage(
        this.modelSelect.value,
        this.messages
      );

      // Add assistant response with same metadata
      await this.addMessage('assistant', response.content, this.currentCodeSelection ? {
        codeSelection: {
          ...this.currentCodeSelection
        }
      } : null);

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

  serialize() {
    return {
      deserializer: 'pulsar-ai/PulsarAIView',
      messages: this.messages // Messages are already properly processed by addMessage
    };
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
}

module.exports = PulsarAIView;
