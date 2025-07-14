import { CompositeDisposable } from 'atom';
import { PulsarAIView } from './view';
import { PulsarAITabTracker } from './tab-tracker';

let instance: PulsarAI | null = null;

class PulsarAI {
  private subscriptions: CompositeDisposable;
  private view?: PulsarAIView | null;
  private statusBarTile?: HTMLElement | null;
  private statusBarButton?: HTMLAnchorElement;
  private tabTracker: PulsarAITabTracker;

  constructor() {
    this.subscriptions = new CompositeDisposable();
    this.tabTracker = new PulsarAITabTracker(atom.workspace);

    this.subscriptions.add(
      atom.commands.add('atom-workspace', {
        'pulsar-ai:toggle': () => this.toggle(),
        'pulsar-ai:share-current-file': () => this.shareCurrentFile(),
        'pulsar-ai:share-selection': () => this.shareSelection(),
        'pulsar-ai:explain-code': () => this.explainCode(),
        'pulsar-ai:optimize-code': () => this.optimizeCode()
      })
    );

    // Add a listener to detect tab closing
    this.subscriptions.add(
      atom.workspace.onDidDestroyPaneItem(({item}) => {
        if (item instanceof PulsarAIView) {
          // Update config when view is closed
          atom.config.set('pulsar-ai.viewVisible', false);
        }
      })
    );

    this.subscriptions.add(
      atom.workspace.getRightDock().onDidChangeVisible((visible) => {
        atom.config.set('pulsar-ai.viewVisible', visible);
      })
    );

    // Add the observer to the config
    this.subscriptions.add(
      atom.config.observe('pulsar-ai.viewVisible', (isVisible) => {
        if (isVisible) {
          this.openPanel();
        }
      })
    );

    this.subscriptions.add(
      atom.project.onDidChangePaths(() => {
        // Update the project browser if available
        const pulsarAIView = this.getPulsarAIView();
        // TODO
        // if (pulsarAIView && pulsarAIView.projectBrowser) {
        //   pulsarAIView.projectBrowser.refresh();
        // }
      })
    );

    this.subscriptions.add(
      atom.workspace.observeTextEditors(() => {
        const pulsarAIView = this.getPulsarAIView();
        // TODO
        // if (pulsarAIView) {
        //   pulsarAIView.updateShareFileButton();
        // }
      })
    );

    instance = this;
  }

  deactivate() {
    // TODO
    // if (this.statusBarTile) {
    //   this.statusBarTile.destroy();
    //   this.statusBarTile = null;
    // }

    const item = this.tabTracker.getItem();
    if (item) {
      const pane = atom.workspace.paneForItem(item);
      if (pane) {
        pane.destroyItem(item);
      }
    }

    this.subscriptions.dispose();

    instance = null;
  }

  consumeStatusBar(statusBar: HTMLElement) {
    const element = document.createElement('div');
    element.classList.add('inline-block');

    this.statusBarButton = document.createElement('a');
    this.statusBarButton.classList.add('inline-block', 'pulsar-ai-status-button');

    const icon = document.createElement('span');
    icon.classList.add('icon', 'icon-book');
    const text = document.createElement('span');
    text.textContent = ' Pulsar AI';

    this.statusBarButton.appendChild(icon);
    this.statusBarButton.appendChild(text);

    this.statusBarButton.addEventListener('click', () => {
      this.toggle();
    });

    element.appendChild(this.statusBarButton);
    console.log('statusBarTile');
    console.log(this.statusBarTile);

    // TODO
    // this.statusBarTile = statusBar.addRightTile({
    //   item: element,
    //   priority: 100
    // });
  }

  updateButtonState(isVisible: boolean) {
    if (!this.statusBarButton) return;

    if (isVisible) {
      this.statusBarButton.classList.add('selected');
    } else {
      this.statusBarButton.classList.remove('selected');
    }
  }

  async shareCurrentFile() {
    const view = this.getPulsarAIView();
    if (!view) {
      await this.toggle();
    }

    // TODO
    // const editorContent = await view.getActiveEditorContent();
    // if (!editorContent) {
    //   atom.notifications.addWarning('No active file to share');
    //   return;
    // }
    //
    // const fileMessage = `Here is the content of the file '${editorContent.filename}' (${editorContent.language}):\n\`\`\`${editorContent.language.toLowerCase()}\n${editorContent.content}\n\`\`\``;
    // await view.addMessage('system', fileMessage, {
    //   sharedFiles: [editorContent.path]
    // });
  }

  async shareSelection() {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) {
      atom.notifications.addWarning('No active editor');
      return;
    }

    const selectedText = editor.getSelectedText();
    if (!selectedText) {
      atom.notifications.addWarning('No text selected');
      return;
    }

    const view = this.getPulsarAIView();
    if (!view) {
      await this.toggle();
    }

    const language = editor.getGrammar().name;
    const fileMessage = `Here is the selected code (${language}):\n\`\`\`${language.toLowerCase()}\n${selectedText}\n\`\`\``;
    // Save selection information
    const selection = editor.getSelectedBufferRange();
    // TODO
    // await view.addMessage('system', fileMessage, {
    //   codeSelection: {
    //     editor: editor,
    //     selection: selection
    //   }
    // });
  }

  async explainCode() {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) {
      atom.notifications.addWarning('No active editor');
      return;
    }

    const selectedText = editor.getSelectedText();
    if (!selectedText) {
      atom.notifications.addWarning('No text selected');
      return;
    }

    const view = this.getPulsarAIView();
    if (!view) {
      await this.toggle();
    }

    const language = editor.getGrammar().name;
    const prompt = `Can you explain this ${language} code in detail?\n\`\`\`${language.toLowerCase()}\n${selectedText}\n\`\`\``;
    // Save selection information
    const selection = editor.getSelectedBufferRange();
    // TODO
    // await view.addMessage('user', prompt, {
    //   codeSelection: {
    //     editor: editor,
    //     selection: selection
    //   }
    // });
    //
    // try {
    //   const response = await view.aiService.sendMessage(
    //     view.modelSelect.value,
    //     [...view.messages]
    //   );
    //   await view.addMessage('assistant', response.content);
    // } catch (error) {
    //   atom.notifications.addError('Error while parsing the code', {
    //     detail: error.message,
    //     dismissable: true
    //   });
    // }
  }

  async optimizeCode() {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) {
      atom.notifications.addWarning('No active editor');
      return;
    }

    const selectedText = editor.getSelectedText();
    if (!selectedText) {
      atom.notifications.addWarning('No text selected');
      return;
    }

    const view = this.getPulsarAIView();
    if (!view) {
      await this.toggle();
    }

    const language = editor.getGrammar().name;
    const prompt = `Can you optimize this ${language} code and explain the improvements?\n\`\`\`${language.toLowerCase()}\n${selectedText}\n\`\`\``;
    // Save selection information
    const selection = editor.getSelectedBufferRange();
    // TODO
    // await view.addMessage('user', prompt, {
    //   codeSelection: {
    //     editor: editor,
    //     selection: selection
    //   }
    // });
    //
    // try {
    //   const response = await view.aiService.sendMessage(
    //     view.modelSelect.value,
    //     [...view.messages]
    //   );
    //   await view.addMessage('assistant', response.content, {
    //     codeSelection: {
    //       editor: editor,
    //       selection: selection
    //     }
    //   });
    // } catch (error) {
    //   atom.notifications.addError('Error while optimizing code', {
    //     detail: error.message,
    //     dismissable: true
    //   });
    // }
  }

  getPulsarAIView() {
    return atom.workspace.getPaneItems()
    .find(item => item instanceof PulsarAIView);
  }

  async openPanel() {
    const existingPanel = atom.workspace.getPaneItems()
      .find(item => item instanceof PulsarAIView);

    if (!existingPanel) {
      await atom.workspace.open(new PulsarAIView(), {
        location: 'right',
        activatePane: false
      });
      const dock = atom.workspace.getRightDock();
      if (!dock.isVisible()) {
        dock.show();
      }
    }
  }

  async toggle() {
    try {
      const existingPanel = atom.workspace.getPaneItems()
      .find(item => item instanceof PulsarAIView);

      // If the view does not exist, we create it
      if (!existingPanel) {
        await atom.workspace.open(new PulsarAIView(), {
          location: 'right',
          activatePane: true,
          activateItem: true
        });
        return;
      }

      const pane = atom.workspace.paneForItem(existingPanel);
      if (!pane) return;

      // Checks if the view is currently active
      const activePane = atom.workspace.getActivePane();
      const activePaneItem = activePane ? activePane.getActiveItem() : null;
      const isPulsarAIActive = activePaneItem instanceof PulsarAIView;

      if (isPulsarAIActive) {
        // If you are on Pulsar AI, you toggle the visibility of the view
        const dock = atom.workspace.getRightDock();
        if (dock.isVisible()) {
          dock.hide();
        } else {
          dock.show();
          pane.activate();
          pane.activateItem(existingPanel);
        }
      } else {
        // If you are not on Pulsar AI, you activate the view and the tab
        const dock = atom.workspace.getRightDock();
        if (!dock.isVisible()) {
          dock.show();
        }
        pane.activate();
        pane.activateItem(existingPanel);
      }
    } catch (error) {
      console.error('Error in toggle:', error);
    }
  }
}

module.exports = {
  activate() {
    this.pulsarAI = new PulsarAI();
  },

  deactivate() {
    if (this.pulsarAI) {
      this.pulsarAI.deactivate();
      this.pulsarAI = null;
    }
  },

  consumeStatusBar(statusBar: HTMLElement) {
    this.pulsarAI.consumeStatusBar(statusBar);
  },

  // TODO
  // deserializePulsarAIView(state) {
  //   if (instance) {
  //     return new PulsarAIView(state);
  //   }
  //   return null;
  // }
};
