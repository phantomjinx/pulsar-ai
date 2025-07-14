import { models } from './globals';

const NO_MODEL_PROVIDER = 'Click to select Model Provider';
const NO_MODEL = 'Select Model';

export class ModelSelector {
  private component: HTMLDetailsElement;
  private providerSelect: HTMLSelectElement;
  private modelInput: HTMLInputElement;
  private summary: HTMLElement;

  private modelProvider?: string
  private modelName?: string

  constructor(serializedState = {}) {
    // --- Create Main Collapsible Container ---
    this.component = document.createElement('details');
    this.component.classList.add('pulsar-ai-model-selector');

    // this.component.className = 'bg-gray-800 border border-gray-700 rounded-lg overflow-hidden';

    // --- Create the Clickable Summary Header ---
    this.summary = document.createElement('summary');
    this.summary.classList.add('pulsar-ai-model-selector-summary');

    // Add CSS for the arrow rotation on open/close
    const style = document.createElement('style');
    style.textContent = `
      details[open] > summary span:last-child {
        transform: rotate(180deg);
      }
    `;
    this.setSummary();
    this.summary.appendChild(style);

    // --- Create the Content Container (this will be hidden/shown) ---
    const contentDiv = document.createElement('div');
    contentDiv.className = 'p-4 border-t border-gray-600 space-y-4';

    // --- Create Provider Selector ---
    this.providerSelect = document.createElement('select');
    this.providerSelect.className = 'w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- Select a Provider --';
    this.providerSelect.appendChild(defaultOption);

    Object.keys(models).forEach(provider => {
      const option = document.createElement('option');
      option.value = provider;
      option.textContent = provider.charAt(0).toUpperCase() + provider.slice(1); // Capitalize
      this.providerSelect.appendChild(option);
    });

    // --- Create Model Input and Datalist ---
    this.modelInput = document.createElement('input');
    this.modelInput.className = 'w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
    this.modelInput.placeholder = 'Select a provider first...';
    this.modelInput.disabled = true; // Disabled until a provider is chosen
    this.modelInput.addEventListener('change', () => {
      this.setModelName(this.modelInput.value);
    });

    const modelDatalist = document.createElement('datalist');
    modelDatalist.id = 'models-list-' + Math.random().toString(36).substr(2, 9); // Unique ID
    this.modelInput.setAttribute('list', modelDatalist.id);

    // --- Dynamic Update Logic ---
    this.providerSelect.addEventListener('change', () => {
      this.modelProvider = this.providerSelect.value;

      // Clear previous options and input value
      modelDatalist.innerHTML = '';
      this.setModelName('');

      if (this.modelProvider) {
        this.modelInput.disabled = false;
        this.modelInput.placeholder = 'Choose or type a model name';
        const providerModels = models[this.modelProvider] || [];
        providerModels.forEach(modelName => {
          const option = document.createElement('option');
          option.value = modelName;
          modelDatalist.appendChild(option);
        });
      } else {
        this.modelInput.disabled = true;
        this.modelInput.placeholder = 'Select a provider first...';
      }
    });

    // --- Assemble the Content Div ---
    const providerGroup = document.createElement('div');
    const providerLabel = document.createElement('label');
    providerLabel.textContent = 'Provider:';
    providerLabel.className = 'block text-sm font-medium text-gray-300 mb-1';
    providerGroup.appendChild(providerLabel);
    providerGroup.appendChild(this.providerSelect);

    const modelGroup = document.createElement('div');
    const modelLabel = document.createElement('label');
    modelLabel.textContent = 'Model:';
    modelLabel.className = 'block text-sm font-medium text-gray-300 mb-1';
    modelGroup.appendChild(modelLabel);
    modelGroup.appendChild(this.modelInput);
    modelGroup.appendChild(modelDatalist);

    contentDiv.appendChild(providerGroup);
    contentDiv.appendChild(modelGroup);

    // --- Assemble the Final Component ---
    this.component.appendChild(this.summary);
    this.component.appendChild(contentDiv);
  }

  private setSummary() {
    if (!this.summary) return;

    let modelProviderTxt = NO_MODEL_PROVIDER;
    let modelProviderClass = 'pulsar-ai-model-selector-summary-no-model-provider';
    let modelNameTxt = NO_MODEL;
    let modelNameClass = 'pulsar-ai-model-selector-summary-no-model-name';

    // 'pulsar-ai-model-selector-summary-model-name';

    const modelProvider = this.getModelProvider();
    if (modelProvider.length > 0) {
      modelProviderTxt = modelProvider;
      modelProviderClass = 'pulsar-ai-model-selector-summary-model-provider';

      const modelName = this.getModelName()
      if (modelName.length > 0) {
        modelNameTxt = modelName
        modelNameClass = 'pulsar-ai-model-selector-summary-model-name';
      }
    }

    this.summary.innerHTML = `
      <span class="${modelProviderClass}">${modelProviderTxt}</span>
      <span>&nbsp;:&nbsp;</span>
      <span class="${modelNameClass}">${modelNameTxt}</span>
    `;
  }

  getComponent(): HTMLDetailsElement {
    return this.component;
  }

  getModelProvider(): string {
    return !this.modelProvider ? '' : this.modelProvider;
  }

  getModelName(): string {
    return !this.modelName ? '' : this.modelName;
  }

  private setModelName(value: string) {
    if (value !== this.modelName) {
      this.modelInput.value = value;
      this.modelName = value;
    }

    this.setSummary();
  }
}
