import { EventEmitter } from 'node:events'
import { TextEditorElement, TextEditor } from 'atom'
import { v4 as uuidv4 } from 'uuid';
import { ModelMetadata, models } from './globals'

const NO_MODEL_PROVIDER = 'Click to select Model Provider'
const NO_MODEL = 'Select Model'

export class ModelSelector extends EventEmitter {
  private detailsComponent: HTMLDetailsElement
  private summary: HTMLElement
  private providerEditor!: TextEditorElement
  private providerEditorModel!: TextEditor
  private providerEditorModels!: HTMLElement

  private modelEditor!: TextEditorElement
  private modelEditorModel!: TextEditor
  private modelEditorModels!: HTMLElement

  private sessionId?: string
  private modelProvider?: string
  private modelName?: string

  constructor(modelMetadata?: ModelMetadata) {
    super()

    this.sessionId = modelMetadata?.sessionId ? modelMetadata?.sessionId : uuidv4()

    // --- Create Main Collapsible Container ---
    this.detailsComponent = document.createElement('details')
    this.detailsComponent.classList.add('pulsar-ai-model-selector')

    this.summary = this.createSummary()
    this.setSummary()

    // --- Create the Content Container (this will be hidden/shown) ---
    const contentDiv = document.createElement('div')
    contentDiv.classList.add('pulsar-ai-model-selector-content')

    this.createProvider(contentDiv)
    this.createModelName(contentDiv)

    // --- Assemble the Final Component ---
    this.detailsComponent.appendChild(this.summary)
    this.detailsComponent.appendChild(contentDiv)

    if (modelMetadata?.provider) {
      this.onProviderSelection(modelMetadata?.provider)
    }

    if (modelMetadata?.name)
      this.setModelName(modelMetadata?.name)
  }

  /*
   * Create the Clickable Summary Header
   */
  private createSummary(): HTMLElement {
    const summary = document.createElement('summary')
    summary.classList.add('pulsar-ai-model-selector-summary')

    // Add CSS for the arrow rotation on open/close
    const style = document.createElement('style')
    style.textContent = `
      details[open] > summary span:last-child {
        transform: rotate(180deg)
      }
    `
    summary.appendChild(style)
    return summary
  }

  private setSummary() {
    if (!this.summary) return

    let modelProviderTxt = NO_MODEL_PROVIDER
    let modelProviderClass = 'pulsar-ai-model-selector-summary-no-model-provider'
    let modelNameTxt = NO_MODEL
    let modelNameClass = 'pulsar-ai-model-selector-summary-no-model-name'

    if (this.modelProvider && this.modelProvider.length > 0) {
      modelProviderTxt = this.modelProvider
      modelProviderClass = 'pulsar-ai-model-selector-summary-model-provider'

      if (this.modelName && this.modelName.length > 0) {
        modelNameTxt = this.modelName
        modelNameClass = 'pulsar-ai-model-selector-summary-model-name'
      }
    }

    this.summary.innerHTML = `
      <span class="${modelProviderClass}">${modelProviderTxt}</span>
      <span>&nbsp:&nbsp</span>
      <span class="${modelNameClass}">${modelNameTxt}</span>
    `
  }

  private editorProvidersDisplayed(open: boolean) {
    const value = open ? 'block' : 'none'
    this.providerEditorModels.style.display = value
  }

  private editorModelsDisplayed(open: boolean) {
    const value = open ? 'block' : 'none'
    this.modelEditorModels.style.display = value
  }

  private onProviderSelection(value: string) {

    // Close the provider Editor
    this.editorProvidersDisplayed(false)

    // Assign the provider Editor text
    this.setModelProvider(value)

    this.modelEditorModels.innerHTML = '' // Clear previous options
    this.modelEditorModel.setText('') // Clear input value
    this.setModelName('')

    if (this.modelProvider) {
      // this.modelEditor.disabled = false
      this.modelEditorModel.setPlaceholderText('Choose or type a model name')
      const providerModels = models[this.modelProvider] || []

      // Create a list of selectable items
      providerModels.forEach(modelName => {
        const item = document.createElement('div')
        item.classList.add('list-item')
        item.textContent = modelName
        // When an item is clicked, update the editor and hide the panel
        item.addEventListener('mousedown', (e) => {
          e.preventDefault() // Prevent the editor from losing focus
          this.setModelName(modelName)
          this.emitChange()
        })
        this.modelEditorModels.appendChild(item)
      })
    } else {
      // this.modelEditor.disabled = true
      this.modelEditorModel.setPlaceholderText('Select a provider first...')
    }
    this.emitChange()
  }

  /*
   * Create Provider selector
   */
  private createProvider(parent: HTMLDivElement) {
    const providerWrapper = document.createElement('div')
    providerWrapper.classList.add('pulsar-ai-model-selector-content-provider-editor')

    this.providerEditor = document.createElement('atom-text-editor')
    this.providerEditor.setAttribute('mini', '')
    this.providerEditor.classList.add('pulsar-ai-model-selector-content-provider-editor-input')

    this.providerEditorModel = this.providerEditor.getModel()
    this.providerEditorModel.setPlaceholderText('Select a Provider')

    this.providerEditorModels = document.createElement('div');
    this.providerEditorModels.classList.add('select-list', 'popover-list', 'pulsar-ai-model-selector-content-provider-editor-options')
    this.editorProvidersDisplayed(false)

    this.providerEditorModels.innerHTML = '' // Clear previous options
    Object.keys(models).forEach(provider => {
      const item = document.createElement('div')
      item.classList.add('list-item')
      item.textContent = provider
      // When an item is clicked, update the editor and hide the panel
      item.addEventListener('mousedown', (e) => {
        e.preventDefault() // Prevent the editor from losing focus
        this.editorProvidersDisplayed(false)
        this.onProviderSelection(provider)
      })
      this.providerEditorModels.appendChild(item)
    })

    // Add the editor and panel to this new wrapper
    providerWrapper.appendChild(this.providerEditor)
    providerWrapper.appendChild(this.providerEditorModels)

    // Show the options when the editor is focused
    this.providerEditor.addEventListener('focus', () => {
      this.editorProvidersDisplayed(true)
    })

    // Hide the options when the editor loses focus
    this.providerEditor.addEventListener('blur', () => {
      // A small delay allows a click on an option to register first
      setTimeout(() => {
        this.editorProvidersDisplayed(false)
      }, 150)
    })

    // --- Assemble the Content Div ---
    const providerGroup = document.createElement('div')
    providerGroup.classList.add('pulsar-ai-model-selector-content-group')
    const providerLabel = document.createElement('label')
    providerLabel.classList.add('pulsar-ai-model-selector-content-provider-label')
    providerLabel.textContent = 'Provider'
    providerGroup.appendChild(providerLabel)
    providerGroup.appendChild(providerWrapper)

    parent.appendChild(providerGroup)
  }

  /*
   * Create Model Name selector
   */
  private createModelName(parent: HTMLDivElement) {
    const editorWrapper = document.createElement('div')
    editorWrapper.classList.add('pulsar-ai-model-selector-content-name-editor')

    this.modelEditor = document.createElement('atom-text-editor')
    this.modelEditor.setAttribute('mini', '')
    this.modelEditor.classList.add('pulsar-ai-model-selector-content-name-editor-input')

    this.modelEditorModel = this.modelEditor.getModel()
    this.modelEditorModel.setPlaceholderText('Select a provider first...')
    // this.modelEditor.disabled = true; // Disabled until a provider is chosen

    this.modelEditorModels = document.createElement('div');
    this.modelEditorModels.classList.add('select-list', 'popover-list', 'pulsar-ai-model-selector-content-name-editor-options')
    this.editorModelsDisplayed(false)

    // Add the editor and panel to this new wrapper
    editorWrapper.appendChild(this.modelEditor)
    editorWrapper.appendChild(this.modelEditorModels)

    // Show the options when the editor is focused
    this.modelEditor.addEventListener('focus', () => {
      if (this.modelProvider) {
        this.editorModelsDisplayed(true)
      }
    })

    // Hide the options when the editor loses focus
    this.modelEditor.addEventListener('blur', () => {
      // A small delay allows a click on a suggestion to register first
      setTimeout(() => {
        this.editorModelsDisplayed(false)
      }, 150)
    })

    // Update the model when the editor text changes manually
    this.modelEditorModel.onDidStopChanging(() => {
      const currentText = this.modelEditorModel.getText()
      if (this.modelName !== currentText) {
        this.setModelName(currentText)
        this.emitChange()
      }
    })

    const modelGroup = document.createElement('div')
    modelGroup.classList.add('pulsar-ai-model-selector-content-group')
    const modelLabel = document.createElement('label')
    modelLabel.classList.add('pulsar-ai-model-selector-content-name-label')
    modelLabel.textContent = 'Model'
    modelGroup.appendChild(modelLabel)
    modelGroup.appendChild(editorWrapper)

    parent.appendChild(modelGroup)
  }

  getComponent(): HTMLDetailsElement {
    return this.detailsComponent
  }

  private setModelProvider(value: string) {
    this.editorProvidersDisplayed(false)

    this.providerEditorModel.setText(value)
    this.modelProvider = value

    this.setSummary()
  }

  getModelMetadata(): ModelMetadata {
    return {
      sessionId: this.sessionId ?? uuidv4(),
      provider: !this.modelProvider ? '' : this.modelProvider,
      name: !this.modelName ? '' : this.modelName
    }
  }

  private setModelName(value: string) {
    this.editorModelsDisplayed(false)

    this.modelEditorModel.setText(value)
    this.modelName = value

    this.setSummary()
  }

  private emitChange() {
    this.emit('change')
  }
}
