import { marked } from 'marked';
import { aiService } from './ai-service';
import hljs from 'highlight.js/lib/core';
import { Range, Point, ViewModel } from 'atom';
import { projectBrowser } from './project-browser';

// Base languages
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import ruby from 'highlight.js/lib/languages/ruby';
import php from 'highlight.js/lib/languages/php';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import sql from 'highlight.js/lib/languages/sql';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';

// Modern languages
import rust from 'highlight.js/lib/languages/rust';
import go from 'highlight.js/lib/languages/go';
import kotlin from 'highlight.js/lib/languages/kotlin';
import swift from 'highlight.js/lib/languages/swift';
import dart from 'highlight.js/lib/languages/dart';
import elixir from 'highlight.js/lib/languages/elixir';

// Web frameworks and related
import jsx from 'highlight.js/lib/languages/javascript';  // JSX uses JS highlighter
import tsx from 'highlight.js/lib/languages/typescript';  // TSX uses TS highlighter
import vue from 'highlight.js/lib/languages/xml';        // Vue uses XML/HTML highlighter
import scss from 'highlight.js/lib/languages/scss';
import less from 'highlight.js/lib/languages/less';
import graphql from 'highlight.js/lib/languages/graphql';

// Infrastructure and config
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import nginx from 'highlight.js/lib/languages/nginx';
import { ModelSelector } from './model-selector';

export class PulsarAIView implements ViewModel {
  selectedModel?: string;

  currentCodeSelection: null;
  messages: never[];
  divContainer: HTMLDivElement;

  constructor(serializedState = {}) {
    // Add this property to store current selection
    this.currentCodeSelection = null;
    // // Register languages
    // this.registerLanguages();

    // // Setup marked with highlight.js
    // this.setupMarked();

    this.messages = [];

    // Create and setup UI
    this.setupUI();

    // // Restore messages if present in state
    // if (serializedState.messages) {
    //   this.messages = serializedState.messages;
    //   this.renderMessages();
    // }
  }

  // Helper method to safely serialize range
  // serializeRange(range) {
  //   if (!range) return null;
  //   return {
  //     start: { row: range.start.row, column: range.start.column },
  //     end: { row: range.end.row, column: range.end.column }
  //   };
  // }

  // Helper method to safely process code selection metadata
  // processCodeSelectionMetadata(metadata) {
  //   if (!metadata || !metadata.codeSelection) return metadata;
  //
  //   const { editor, selection } = metadata.codeSelection;
  //   if (!editor || !selection) return metadata;
  //
  //   return {
  //     ...metadata,
  //     codeSelection: {
  //       filePath: editor.getPath(),
  //       selection: this.serializeRange(selection)
  //     }
  //   };
  // }

  // // Helper method to create buffer range from serialized format
  // createBufferRange(serializedRange) {
  //   // if (!serializedRange?.start?.row !== undefined) return null;
  //
  //   try {
  //     const Range = require('atom').Range;
  //     return new Range(
  //       [serializedRange.start.row, serializedRange.start.column],
  //       [serializedRange.end.row, serializedRange.end.column]
  //     );
  //   } catch (error) {
  //     console.error('Error creating buffer range:', error);
  //     return null;
  //   }
  // }
  //
  // registerLanguages() {
  //   // Base languages
  //   hljs.registerLanguage('javascript', javascript);
  //   hljs.registerLanguage('typescript', typescript);
  //   hljs.registerLanguage('python', python);
  //   hljs.registerLanguage('ruby', ruby);
  //   hljs.registerLanguage('php', php);
  //   hljs.registerLanguage('html', xml);
  //   hljs.registerLanguage('css', css);
  //   hljs.registerLanguage('sql', sql);
  //   hljs.registerLanguage('bash', bash);
  //   hljs.registerLanguage('json', json);
  //   hljs.registerLanguage('yaml', yaml);
  //
  //   // Modern languages
  //   hljs.registerLanguage('rust', rust);
  //   hljs.registerLanguage('go', go);
  //   hljs.registerLanguage('kotlin', kotlin);
  //   hljs.registerLanguage('swift', swift);
  //   hljs.registerLanguage('dart', dart);
  //   hljs.registerLanguage('elixir', elixir);
  //
  //   // Web frameworks and related
  //   hljs.registerLanguage('jsx', jsx);
  //   hljs.registerLanguage('tsx', tsx);
  //   hljs.registerLanguage('vue', vue);
  //   hljs.registerLanguage('scss', scss);
  //   hljs.registerLanguage('less', less);
  //   hljs.registerLanguage('graphql', graphql);
  //
  //   // Infrastructure and config
  //   hljs.registerLanguage('dockerfile', dockerfile);
  //   hljs.registerLanguage('nginx', nginx);
  // }
  //
  // setupMarked() {
  //   this.marked = marked;
  //   this.marked.setOptions({
  //     breaks: true,
  //     gfm: true,
  //     highlight: (code, lang) => {
  //       if (lang && hljs.getLanguage(lang)) {
  //         try {
  //           return hljs.highlight(code, {
  //             language: lang,
  //             ignoreIllegals: true
  //           }).value;
  //         } catch (err) {
  //           console.error('Highlighting error:', err);
  //           return code;
  //         }
  //       }
  //       return code;
  //     }
  //   });
  // }

  setupUI() {
    // Create main container
    this.divContainer = document.createElement('div');
    this.divContainer.classList.add('pulsar-ai-container');

    // Create the model Selector
    const modelSelector = new ModelSelector()

    // Add messages container
    const messagesContainer = document.createElement('div');
    messagesContainer.classList.add('pulsar-ai-messages');

    // Add input area
    const inputContainer = this.setupInputArea();

    // Assemble all elements
    this.divContainer.appendChild(modelSelector.getComponent());
    this.divContainer.appendChild(messagesContainer);
    this.divContainer.appendChild(inputContainer);
  }

  setupInputArea(): HTMLDivElement {
    const inputContainer = document.createElement('div');
    inputContainer.classList.add('pulsar-ai-input-container');

    // Create the main input container
    const inputWrapper = document.createElement('div');
    inputWrapper.classList.add('input-wrapper');

    // New "+ Add context" button at the beginning of input-wrapper
    const contextButton = document.createElement('button');
    contextButton.classList.add('pulsar-ai-add-context-button');
    contextButton.innerHTML = '<span class="icon icon-plus"></span> Add context';

    // Create the Project Navigator instance
    document.body.appendChild(projectBrowser.element);

    // Add context button click event
    contextButton.addEventListener('click', (e) => {
      e.stopPropagation();
      projectBrowser.toggle();
    });

    // Create the textarea
    const textarea = document.createElement('textarea');
    textarea.classList.add('input-textarea', 'native-key-bindings');
    textarea.setAttribute('placeholder', 'Ask anything...');
    textarea.addEventListener('keydown', async (event) => {
      if (event.key === 'Enter' && event.ctrlKey) {
        event.preventDefault();
        console.log(`Send Message to model ${this.selectedModel}`);
        // await this.sendMessage();
      }
    });

    // Create the toolbar
    const toolbarContainer = document.createElement('div');
    toolbarContainer.classList.add('toolbar-container');

    // Create the send button
    const sendButton = document.createElement('button');
    sendButton.classList.add('btn', 'icon', 'icon-playback-play');
    sendButton.addEventListener('click', () => {
      console.log('TODO Send Clicked');
      // this.sendMessage();
    });

    // Add the send button to the toolbar
    toolbarContainer.appendChild(sendButton);

    // Assembler les éléments dans l'ordre souhaité
    inputWrapper.appendChild(contextButton);
    inputWrapper.appendChild(textarea);
    inputWrapper.appendChild(toolbarContainer);

    inputContainer.appendChild(inputWrapper);

    return inputContainer
  }

  // async getActiveEditorContent() {
  //   const editor = atom.workspace.getActiveTextEditor();
  //   if (!editor) return null;
  //
  //   const filePath = editor.getPath();
  //   if (!filePath) return null;
  //
  //   return {
  //     content: editor.getText(),
  //     filename: filePath.split('/').pop(),
  //     language: editor.getGrammar().name,
  //     path: filePath
  //   };
  // }
  //
  // isFileAlreadyShared(filePath) {
  //   return this.messages.some(msg =>
  //     msg.metadata?.sharedFiles?.includes(filePath)
  //   );
  // }
  //
  // async updateShareFileButton() {
  //   const editorContent = await this.getActiveEditorContent();
  //
  //   if (editorContent) {
  //     const isShared = this.isFileAlreadyShared(editorContent.path);
  //     this.shareFileButton.style.display = 'flex';
  //     this.shareFileLabel.textContent = ` ${editorContent.filename}`;
  //     if (isShared) {
  //       this.shareFileCheckbox.checked = false;
  //     }
  //   } else {
  //     this.shareFileButton.style.display = 'none';
  //   }
  // }
  //
  // // Helper to safely store selection info
  // getSelectionInfo(editor, selection) {
  //   if (!editor || !selection) return null;
  //   return {
  //     filePath: editor.getPath(),
  //     selection: {
  //       start: { row: selection.start.row, column: selection.start.column },
  //       end: { row: selection.end.row, column: selection.end.column }
  //     }
  //   };
  // }
  //
  // async addMessage(role, content, metadata = null) {
  //   // Update currentCodeSelection from metadata
  //   if (metadata?.codeSelection) {
  //     // If we get editor reference, convert it to storable format
  //     if (metadata.codeSelection.editor && metadata.codeSelection.selection) {
  //       this.currentCodeSelection = this.getSelectionInfo(
  //         metadata.codeSelection.editor,
  //         metadata.codeSelection.selection
  //       );
  //     } else {
  //       // If we get already formatted metadata, use it directly
  //       this.currentCodeSelection = {
  //         filePath: metadata.codeSelection.filePath,
  //         selection: metadata.codeSelection.selection
  //       };
  //     }
  //   }
  //
  //   // Create safe metadata for storage
  //   const safeMetadata = metadata?.codeSelection ? {
  //     codeSelection: this.currentCodeSelection
  //   } : metadata;
  //
  //   const message = { role, content, metadata: safeMetadata };
  //   this.messages.push(message);
  //   await this.renderMessage(message);
  // }
  //
  // async renderMessage(message) {
  //   const messageElement = document.createElement('div');
  //   messageElement.classList.add('pulsar-ai-message', `pulsar-ai-message-${message.role}`);
  //
  //   const contentElement = document.createElement('div');
  //   contentElement.classList.add('pulsar-ai-message-content');
  //
  //   // Process code blocks
  //   const codeBlocks = new Map();
  //   let codeBlockCounter = 0;
  //   const processedContent = message.content.replace(/```(\w+)?\n([\s\S]*?)\n```/g, (match, language, code) => {
  //     const placeholder = `CODE_BLOCK_${codeBlockCounter}`;
  //     codeBlocks.set(placeholder, { language: language || '', code: code.trim() });
  //     codeBlockCounter++;
  //     return placeholder;
  //   });
  //
  //   // Convert to Markdown
  //   let htmlContent = this.marked.parse(processedContent);
  //
  //   // Restore code blocks
  //   codeBlocks.forEach((block, placeholder) => {
  //     // Add Apply button only for assistant messages and if we have a selection
  //
  //     const applyButton = (message.role === 'assistant' && this.currentCodeSelection) ?
  //       `<button class="btn btn-xs btn-apply icon icon-check">Apply</button>` : '';
  //
  //     let highlightedCode = block.code;
  //     if (block.language && hljs.getLanguage(block.language)) {
  //       try {
  //         highlightedCode = hljs.highlight(block.code, {
  //           language: block.language,
  //           ignoreIllegals: true
  //         }).value;
  //       } catch (err) {
  //         console.error('Error highlighting:', err);
  //       }
  //     }
  //
  //     const codeHtml = `
  //       <div class="code-block-wrapper">
  //         <div class="code-block-actions">
  //           <button class="btn btn-xs btn-copy icon icon-clippy">Copy</button>
  //           ${applyButton}
  //         </div>
  //         <pre class="code-block"><code class="hljs language-${block.language}">${highlightedCode}</code></pre>
  //       </div>
  //     `;
  //
  //     htmlContent = htmlContent.replace(placeholder, codeHtml);
  //   });
  //
  //   contentElement.innerHTML = htmlContent;
  //
  //   // Add copy button handlers
  //   contentElement.querySelectorAll('.btn-copy').forEach(button => {
  //     button.addEventListener('click', (e) => {
  //       const code = e.target.closest('.code-block-wrapper').querySelector('code').textContent;
  //       atom.clipboard.write(code);
  //
  //       // Visual feedback
  //       const originalText = e.target.textContent;
  //       e.target.textContent = 'Copied!';
  //       e.target.classList.add('btn-success');
  //
  //       setTimeout(() => {
  //         e.target.textContent = originalText;
  //         e.target.classList.remove('btn-success');
  //       }, 2000);
  //     });
  //   });
  //
  //   // Add apply button handlers
  //   contentElement.querySelectorAll('.btn-apply').forEach(button => {
  //
  //     let highlightMarker = null;
  //
  //     button.addEventListener('mouseenter', () => {
  //       if (!this.currentCodeSelection) return;
  //
  //       const { filePath, selection } = this.currentCodeSelection;
  //       const editor = atom.workspace.getTextEditors().find(ed => ed.getPath() === filePath);
  //
  //       if (editor) {
  //         const startPoint = new Point(selection.start.row, selection.start.column);
  //         const endPoint = new Point(selection.end.row, selection.end.column);
  //         const range = new Range(startPoint, endPoint);
  //
  //         highlightMarker = editor.markBufferRange(range, {
  //           invalidate: 'never'
  //         });
  //
  //         editor.decorateMarker(highlightMarker, {
  //           type: 'highlight',
  //           class: 'pulsar-ai-apply-highlight'
  //         });
  //       }
  //     });
  //
  //     button.addEventListener('mouseleave', () => {
  //       if (highlightMarker) {
  //         highlightMarker.destroy();
  //         highlightMarker = null;
  //       }
  //     });
  //
  //     button.addEventListener('click', async (e) => {
  //       try {
  //         const code = e.target.closest('.code-block-wrapper').querySelector('code').textContent;
  //
  //         if (!this.currentCodeSelection) {
  //           atom.notifications.addWarning('No selection information available', {
  //             dismissable: true
  //           });
  //           return;
  //         }
  //
  //         const { filePath, selection } = this.currentCodeSelection;
  //
  //         // Get editor for the file
  //         let editor = atom.workspace.getTextEditors().find(ed => ed.getPath() === filePath);
  //         if (!editor) {
  //           editor = await atom.workspace.open(filePath);
  //         }
  //
  //         if (!editor || !editor.isAlive()) {
  //           atom.notifications.addError('Failed to apply changes', {
  //             detail: 'Could not find or open the target editor.',
  //             dismissable: true
  //           });
  //           return;
  //         }
  //
  //         const buffer = editor.getBuffer();
  //         const startPoint = new Point(selection.start.row, selection.start.column);
  //         const endPoint = new Point(selection.end.row, selection.end.column);
  //         const range = new Range(startPoint, endPoint);
  //         editor.setCursorBufferPosition(startPoint);
  //         editor.transact(() => {
  //           const originalIndent = editor.indentationForBufferRow(selection.start.row);
  //           const indentedCode = code.split('\n').map(line => {
  //             if (line.trim() === '') return '';
  //             return ' '.repeat(originalIndent * editor.getTabLength()) + line;
  //           }).join('\n');
  //
  //           editor.setTextInBufferRange(range, indentedCode);
  //         });
  //
  //         // Visual feedback
  //         button.textContent = 'Applied!';
  //         button.classList.add('btn-success');
  //         setTimeout(() => {
  //           button.textContent = 'Apply';
  //           button.classList.remove('btn-success');
  //         }, 2000);
  //
  //       } catch (error) {
  //         console.error('Error applying changes:', error);
  //         atom.notifications.addError('Failed to apply changes', {
  //           detail: error.message,
  //           dismissable: true
  //         });
  //       }
  //     });
  //   });
  //
  //   messageElement.appendChild(contentElement);
  //   this.messagesContainer.appendChild(messageElement);
  //   this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  // }
  //
  // async renderMessages() {
  //   this.messagesContainer.innerHTML = '';
  //   for (const message of this.messages) {
  //     await this.renderMessage(message);
  //   }
  // }
  //
  // async sendMessage() {
  //   const content = this.textarea.value.trim();
  //   if (!content) return;
  //
  //   try {
  //     this.setLoading(true);
  //
  //     // Get the current editor and selection
  //     const editor = atom.workspace.getActiveTextEditor();
  //     const selection = editor?.getSelectedBufferRange();
  //
  //     // Store current selection for assistant's response
  //     if (editor && selection && !selection.isEmpty()) {
  //       this.currentCodeSelection = {
  //         filePath: editor.getPath(),
  //         selection: selection.serialize()
  //       };
  //     } else {
  //       this.currentCodeSelection = null;
  //     }
  //
  //     // Handle file sharing first
  //     const editorContent = await this.getActiveEditorContent();
  //     if (editorContent && this.shareFileCheckbox.checked && !this.isFileAlreadyShared(editorContent.path)) {
  //       const fileMessage = `Here is the content of the file '${editorContent.filename}' (${editorContent.language}):\n\`\`\`${editorContent.language.toLowerCase()}\n${editorContent.content}\n\`\`\``;
  //       await this.addMessage('system', fileMessage, {
  //         sharedFiles: [editorContent.path]
  //       });
  //     }
  //
  //     // Add user message with selection metadata
  //     await this.addMessage('user', content, this.currentCodeSelection ? {
  //       codeSelection: this.currentCodeSelection
  //     } : null);
  //     this.textarea.value = '';
  //
  //     // Get AI response
  //     const response = await aiService.sendMessage(
  //       this.modelSelect.value,
  //       this.messages
  //     );
  //
  //     // Add assistant response with same metadata
  //     await this.addMessage('assistant', response.content, this.currentCodeSelection ? {
  //       codeSelection: {
  //         ...this.currentCodeSelection
  //       }
  //     } : null);
  //
  //   } catch (error) {
  //     atom.notifications.addError('Error sending message', {
  //       detail: error.message,
  //       dismissable: true
  //     });
  //     console.error('Error sendMessage:', error);
  //   } finally {
  //     this.setLoading(false);
  //   }
  // }
  //
  // setLoading(isLoading) {
  //   this.sendButton.disabled = isLoading;
  //   this.textarea.disabled = isLoading;
  //   this.modelSelect.disabled = isLoading;
  //
  //   if (isLoading) {
  //     this.sendButton.classList.add('is-loading');
  //   } else {
  //     this.sendButton.classList.remove('is-loading');
  //   }
  // }
  //
  // clearMessages() {
  //   this.messages = [];
  //   this.messagesContainer.innerHTML = '';
  // }
  //
  // serialize() {
  //   return {
  //     deserializer: 'pulsar-ai/PulsarAIView',
  //     messages: this.messages // Messages are already properly processed by addMessage
  //   };
  // }
  //
  destroy() {
    this.divContainer.remove();

    // TODO
    // if (this.projectBrowser && this.projectBrowser.element) {
    //   this.projectBrowser.element.remove();
    // }
  }

  getElement() {
    return this.divContainer;
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
