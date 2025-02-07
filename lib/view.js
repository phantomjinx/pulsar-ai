const { marked } = require('marked');
const AIService = require('./ai-service');

class PulsarAIView {
  constructor(serializedState = {}) {
    this.marked = marked;
    this.marked.setOptions({
      breaks: true,
      gfm: true
    });

    this.aiService = new AIService();
    this.messages = [];
    this.element = document.createElement('div');
    this.element.classList.add('pulsar-ai-container');

    // Header avec l'icône
    const header = document.createElement('div');
    header.classList.add('pulsar-ai-header');
    const icon = document.createElement('span');
    icon.classList.add('icon', 'icon-book');
    const title = document.createElement('span');
    title.textContent = 'Pulsar AI';
    header.appendChild(icon);
    header.appendChild(title);

    // Select pour les modèles
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

    // Définir le modèle par défaut depuis la config
    const defaultModel = atom.config.get('pulsar-ai.defaultModel');
    if (defaultModel) {
      this.modelSelect.value = defaultModel;
    }

    selectContainer.appendChild(this.modelSelect);

    // Ajouter un listener pour le changement de modèle
    this.modelSelect.addEventListener('change', () => {
      this.clearMessages();
    });

    // Zone de messages
    this.messagesContainer = document.createElement('div');
    this.messagesContainer.classList.add('pulsar-ai-messages');

    // Zone de saisie en bas
    const inputContainer = document.createElement('div');
    inputContainer.classList.add('pulsar-ai-input-container');

    this.textarea = document.createElement('textarea');
    this.textarea.classList.add('input-textarea', 'native-key-bindings');
    this.textarea.setAttribute('placeholder', 'Écrivez votre message ici...');

    // Gestion de Ctrl+Enter pour envoyer
    this.textarea.addEventListener('keydown', async (event) => {
      if (event.key === 'Enter' && event.ctrlKey) {
        event.preventDefault();
        await this.sendMessage();
      }
    });

    this.sendButton = document.createElement('button');
    this.sendButton.classList.add('btn', 'btn-primary', 'icon', 'icon-paper-airplane');
    this.sendButton.textContent = 'Envoyer';
    this.sendButton.addEventListener('click', () => this.sendMessage());

    // Créer le conteneur pour les contrôles en bas
    const bottomControls = document.createElement('div');
    bottomControls.classList.add('pulsar-ai-bottom-controls');

    // Créer le bouton de partage de fichier
    this.shareFileButton = document.createElement('button');
    this.shareFileButton.classList.add('btn', 'share-file-button');
    this.shareFileButton.style.display = 'none'; // Caché par défaut

    this.shareFileCheckbox = document.createElement('input');
    this.shareFileCheckbox.type = 'checkbox';
    this.shareFileCheckbox.checked = false; // Non coché par défaut
    this.shareFileCheckbox.classList.add('share-file-checkbox');

    this.shareFileLabel = document.createElement('span');
    this.shareFileLabel.classList.add('share-file-label');

    this.shareFileButton.appendChild(this.shareFileCheckbox);
    this.shareFileButton.appendChild(this.shareFileLabel);

    // Créer le footer
    const footer = document.createElement('div');
    footer.classList.add('pulsar-ai-footer');

    // Texte "Made with prayer"
    const madeWith = document.createElement('span');
    madeWith.classList.add('made-with');
    madeWith.innerHTML = '† Made with 🙏 in 🇫🇷 †';
    footer.appendChild(madeWith);

    // Bouton Buy me a coffee
    const coffeeLink = document.createElement('a');
    coffeeLink.href = 'https://mjerem34.github.io/pay-or-pray/';
    coffeeLink.target = '_blank';
    coffeeLink.classList.add('coffee-button');
    coffeeLink.textContent = 'Buy me a coffee  ☕';
    footer.appendChild(coffeeLink);

    // Mettre à jour le statut du bouton quand l'éditeur change
    this.updateShareFileButton();
    atom.workspace.onDidChangeActiveTextEditor(() => {
      this.updateShareFileButton();
    });

    inputContainer.appendChild(this.textarea);
    inputContainer.appendChild(this.sendButton);
    bottomControls.appendChild(this.shareFileButton);

    // Assemblage
    this.element.appendChild(header);
    this.element.appendChild(selectContainer);
    this.element.appendChild(this.messagesContainer);
    this.element.appendChild(inputContainer);
    this.element.appendChild(bottomControls);
    this.element.appendChild(footer);

    // Restaurer les messages si présents dans le state
    if (serializedState.messages) {
      this.messages = serializedState.messages;
      this.renderMessages();
    }
  }

  // Méthodes pour la gestion des fichiers
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
      // Ne mettre à jour la checkbox que si le fichier est déjà partagé
      if (isShared) {
        this.shareFileCheckbox.checked = false;
      }
    } else {
      this.shareFileButton.style.display = 'none';
    }
  }

  // Méthodes de gestion des messages
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

    // Sauvegarder les blocs de code
    const codeBlocks = new Map();
    let codeBlockCounter = 0;
    const processedContent = message.content.replace(/```(\w+)?\n([\s\S]*?)\n```/g, (match, language, code) => {
      const placeholder = `CODE_BLOCK_${codeBlockCounter}`;
      codeBlocks.set(placeholder, { language: language || '', code: code.trim() });
      codeBlockCounter++;
      return placeholder;
    });

    // Convertir le reste en Markdown
    let htmlContent = this.marked.parse(processedContent);

    // Restaurer les blocs de code
    codeBlocks.forEach((block, placeholder) => {
      const langClass = block.language ? ` language-${block.language}` : '';
      const hasCodeSelection = message.metadata && message.metadata.codeSelection;
      const applyButton = hasCodeSelection ? `<button class="btn btn-xs btn-apply icon icon-check">Apply</button>` : '';

      const codeHtml = `
      <div class="code-block-wrapper">
        <div class="code-block-actions">
          <button class="btn btn-xs btn-copy icon icon-clippy">Copy</button>
          ${applyButton}
        </div>
        <pre class="code-block${langClass}"><code>${this.escapeHtml(block.code)}</code></pre>
      </div>
      `;
      htmlContent = htmlContent.replace(placeholder, codeHtml);
    });

    contentElement.innerHTML = htmlContent;

    // Ajouter les écouteurs pour les boutons de copie et d'application
    contentElement.querySelectorAll('.btn-copy').forEach(button => {
      button.addEventListener('click', (e) => {
        const code = e.target.closest('.code-block-wrapper').querySelector('code').textContent;
        atom.clipboard.write(code);

        // Feedback visuel
        const originalText = e.target.textContent;
        e.target.textContent = 'Copié !';
        e.target.classList.add('btn-success');

        setTimeout(() => {
          e.target.textContent = originalText;
          e.target.classList.remove('btn-success');
        }, 2000);
      });
    });

    // Ajouter les écouteurs pour les boutons d'application
    contentElement.querySelectorAll('.btn-apply').forEach(button => {
      button.addEventListener('click', (e) => {
        const code = e.target.closest('.code-block-wrapper').querySelector('code').textContent;

        if (message.metadata && message.metadata.codeSelection) {
          const { editor, selection } = message.metadata.codeSelection;
          if (editor && editor.getBuffer()) {
            editor.setTextInBufferRange(selection, code);

            // Feedback visuel
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

  // Méthode utilitaire pour échapper les caractères HTML
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

      // Vérifier si on doit partager le fichier actif
      const editorContent = await this.getActiveEditorContent();
      if (editorContent && this.shareFileCheckbox.checked && !this.isFileAlreadyShared(editorContent.path)) {
        // Ajouter un message système avec le contenu du fichier
        const fileMessage = `Voici le contenu du fichier '${editorContent.filename}' (${editorContent.language}):\n\`\`\`${editorContent.language.toLowerCase()}\n${editorContent.content}\n\`\`\``;
        await this.addMessage('system', fileMessage, {
          sharedFiles: [editorContent.path]
        });
      }

      // Ajouter le message utilisateur
      await this.addMessage('user', content);
      this.textarea.value = '';

      // Obtenir la réponse de l'IA
      const response = await this.aiService.sendMessage(
        this.modelSelect.value,
        this.messages
      );

      // Copier les metadata de sélection du dernier message utilisateur vers la réponse
      const lastMessage = this.messages[this.messages.length - 1];
      const metadata = lastMessage.metadata && lastMessage.metadata.codeSelection ?
        { codeSelection: lastMessage.metadata.codeSelection } : null;

      // Ajouter la réponse avec les metadata copiées
      await this.addMessage('assistant', response.content, metadata);

    } catch (error) {
      atom.notifications.addError('Erreur lors de l\'envoi du message', {
        detail: error.message,
        dismissable: true
      });
      console.error('Erreur sendMessage:', error);
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
