class PulsarAITabTracker {
  constructor(workspace) {
    this.workspace = workspace;
    this.uri = 'atom://pulsar-ai-view';
  }

  async toggle() {
    const focusToRestore = document.activeElement;
    let shouldRestoreFocus = false;

    const wasRendered = this.isRendered();
    const wasVisible = this.isVisible();

    if (!wasRendered || !wasVisible) {
      await this.reveal();
      shouldRestoreFocus = true;
    } else {
      await this.hide();
    }

    if (shouldRestoreFocus) {
      process.nextTick(() => focusToRestore.focus());
    }
  }

  async reveal() {
    const item = this.getItem();
    if (item) {
      const pane = this.workspace.paneForItem(item);
      if (pane) {
        pane.activate();
        pane.activateItem(item);
      }
    }
  }

  async hide() {
    const item = this.getItem();
    if (item) {
      await this.workspace.hide(item);
    }
  }

  getItem() {
    const items = this.workspace.getPaneItems();
    return items.find(item => item.getURI && item.getURI() === this.uri);
  }

  isRendered() {
    return !!this.getItem();
  }

  isVisible() {
    const item = this.getItem();
    if (!item) return false;

    const container = this.workspace.paneContainerForItem(item);
    return container && container.isVisible();
  }
}

module.exports = PulsarAITabTracker;
