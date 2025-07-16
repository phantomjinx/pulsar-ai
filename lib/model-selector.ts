import { models } from './globals'
import { EventEmitter } from 'node:events'

const NO_MODEL_PROVIDER = 'Click to select Model Provider'
const NO_MODEL = 'Select Model'

export class ModelSelector extends EventEmitter {
  private component: HTMLDetailsElement
  private providerSelect: HTMLSelectElement
  private modelInput: HTMLInputElement
  private summary: HTMLElement

  constructor(private modelProvider?: string, private modelName?: string) {
    super()

    // --- Create Main Collapsible Container ---
    this.component = document.createElement('details')
    this.component.classList.add('pulsar-ai-model-selector')

    // --- Create the Clickable Summary Header ---
    this.summary = document.createElement('summary')
    this.summary.classList.add('pulsar-ai-model-selector-summary')

    // Add CSS for the arrow rotation on open/close
    const style = document.createElement('style')
    style.textContent = `
      details[open] > summary span:last-child {
        transform: rotate(180deg)
      }
    `
    this.setSummary()
    this.summary.appendChild(style)

    // --- Create the Content Container (this will be hidden/shown) ---
    const contentDiv = document.createElement('div')
    contentDiv.classList.add('pulsar-ai-model-selector-content')

    // --- Create Provider Selector ---
    this.providerSelect = document.createElement('select')
    this.providerSelect.classList.add('pulsar-ai-model-selector-content-provider')

    const defaultOption = document.createElement('option')
    defaultOption.value = ''
    defaultOption.textContent = '-- Select a Provider --'
    this.providerSelect.appendChild(defaultOption)

    Object.keys(models).forEach(provider => {
      const option = document.createElement('option')
      option.value = provider
      option.textContent = provider.charAt(0).toUpperCase() + provider.slice(1) // Capitalize
      this.providerSelect.appendChild(option)
    })

    // TODO - replace the input / datalist with atom themed editor instead
    //
    // const textEditor = document.createElement('atom-text-editor')
    // textEditor.setAttribute('mini', '') // This makes it a single-line input
    // In your view's rendering code
    // const suggestionsPanel = document.createElement('div');
    // suggestionsPanel.classList.add('select-list', 'popover-list'); // Use Pulsar's built-in classes
    //
    // const models = ['gpt-4', 'claude-3', 'gemini-1.5'];
    // models.forEach(modelName => {
    //   const item = document.createElement('div');
    //   item.classList.add('list-item');
    //   item.textContent = modelName;
    //   item.onclick = () => {
    //     textEditor.getModel().setText(modelName);
    //     suggestionsPanel.style.display = 'none'; // Hide list on selection
    //   };
    //   suggestionsPanel.appendChild(item);
    // });
    //
    // suggestionsPanel.style.display = 'none'; // Start with the list hidden
    // // Append suggestionsPanel to your view
    // In your view's logic
    // textEditor.addEventListener('focus', () => {
    //   suggestionsPanel.style.display = 'block';
    // });

    // --- Create Model Input and Datalist ---
    this.modelInput = document.createElement('input')
    this.modelInput.classList.add('pulsar-ai-model-selector-content-name-input')
    this.modelInput.placeholder = 'Select a provider first...'
    this.modelInput.disabled = true // Disabled until a provider is chosen
    this.modelInput.addEventListener('change', () => {
      this.setModelName(this.modelInput.value)
      this.emitChange()
    })

    const modelDatalist = document.createElement('datalist')
    modelDatalist.id = 'models-list-' + Math.random().toString(36).substr(2, 9) // Unique ID
    this.modelInput.setAttribute('list', modelDatalist.id)

    // --- Dynamic Update Logic ---
    this.providerSelect.addEventListener('change', () => {
      this.setModelProvider(this.providerSelect.value)

      // Clear previous options and input value
      modelDatalist.innerHTML = ''
      this.setModelName('')

      if (this.modelProvider) {
        this.modelInput.disabled = false
        this.modelInput.placeholder = 'Choose or type a model name'
        const providerModels = models[this.modelProvider] || []
        providerModels.forEach(modelName => {
          const option = document.createElement('option')
          option.value = modelName
          modelDatalist.appendChild(option)
        })
      } else {
        this.modelInput.disabled = true
        this.modelInput.placeholder = 'Select a provider first...'
      }

      this.emitChange()
    })

    // --- Assemble the Content Div ---
    const providerGroup = document.createElement('div')
    providerGroup.classList.add('pulsar-ai-model-selector-content-group')
    const providerLabel = document.createElement('label')
    providerLabel.classList.add('pulsar-ai-model-selector-content-provider-label')
    providerLabel.textContent = 'Provider'
    providerGroup.appendChild(providerLabel)
    providerGroup.appendChild(this.providerSelect)

    const modelGroup = document.createElement('div')
    modelGroup.classList.add('pulsar-ai-model-selector-content-group')
    const modelLabel = document.createElement('label')
    modelLabel.classList.add('pulsar-ai-model-selector-content-name-label')
    modelLabel.textContent = 'Model'
    modelGroup.appendChild(modelLabel)
    modelGroup.appendChild(this.modelInput)
    modelGroup.appendChild(modelDatalist)

    contentDiv.appendChild(providerGroup)
    contentDiv.appendChild(modelGroup)

    // --- Assemble the Final Component ---
    this.component.appendChild(this.summary)
    this.component.appendChild(contentDiv)
  }

  private setSummary() {
    if (!this.summary) return

    let modelProviderTxt = NO_MODEL_PROVIDER
    let modelProviderClass = 'pulsar-ai-model-selector-summary-no-model-provider'
    let modelNameTxt = NO_MODEL
    let modelNameClass = 'pulsar-ai-model-selector-summary-no-model-name'

    // 'pulsar-ai-model-selector-summary-model-name'

    const modelProvider = this.getModelProvider()
    if (modelProvider.length > 0) {
      modelProviderTxt = modelProvider
      modelProviderClass = 'pulsar-ai-model-selector-summary-model-provider'

      const modelName = this.getModelName()
      if (modelName.length > 0) {
        modelNameTxt = modelName
        modelNameClass = 'pulsar-ai-model-selector-summary-model-name'
      }
    }

    this.summary.innerHTML = `
      <span class="${modelProviderClass}">${modelProviderTxt}</span>
      <span>&nbsp:&nbsp</span>
      <span class="${modelNameClass}">${modelNameTxt}</span>
    `
  }

  getComponent(): HTMLDetailsElement {
    return this.component
  }

  getModelProvider(): string {
    return !this.modelProvider ? '' : this.modelProvider
  }

  private setModelProvider(value: string) {
    this.modelProvider = this.providerSelect.value
  }

  getModelName(): string {
    return !this.modelName ? '' : this.modelName
  }

  private setModelName(value: string) {
    if (value !== this.modelName) {
      this.modelInput.value = value
      this.modelName = value
    }

    this.setSummary()
  }

  private emitChange() {
    this.emit('change')
  }
}
