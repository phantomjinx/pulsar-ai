class AIService {
  constructor() {
    // Map des endpoints par fournisseur
    this.endpoints = {
      openai: 'https://api.openai.com/v1/chat/completions',
      anthropic: 'https://api.anthropic.com/v1/messages',
      mistral: 'https://api.mistral.ai/v1/chat/completions'
    };
  }

  // Récupère la clé API pour un modèle donné
  getApiKey(model) {
    if (model.startsWith('gpt-')) {
      return atom.config.get('pulsar-ai.openaiApiKey');
    } else if (model.startsWith('claude-')) {
      return atom.config.get('pulsar-ai.anthropicApiKey');
    } else if (model.startsWith('mistral-')) {
      return atom.config.get('pulsar-ai.mistralApiKey');
    }
    throw new Error(`Modèle non reconnu : ${model}`);
  }

  // Détermine le fournisseur à partir du modèle
  getProvider(model) {
    if (model.startsWith('gpt-')) return 'openai';
    if (model.startsWith('claude-')) return 'anthropic';
    if (model.startsWith('mistral-')) return 'mistral';
    throw new Error(`Fournisseur non reconnu pour le modèle : ${model}`);
  }

  // Formate la requête selon le fournisseur
  formatRequest(provider, model, messages) {
    const headers = {
      'Content-Type': 'application/json'
    };

    switch (provider) {
      case 'openai':
        headers['Authorization'] = `Bearer ${this.getApiKey(model)}`;
        return {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            messages: messages.map(msg => ({
              role: msg.role,
              content: msg.content
            }))
          })
        };

      case 'anthropic':
        headers['x-api-key'] = this.getApiKey(model);
        headers['anthropic-version'] = '2023-06-01';
        return {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            max_tokens: 4096,
            messages: messages.map(msg => ({
              role: msg.role === 'user' ? 'user' : 'assistant',
              content: msg.content
            }))
          })
        };

      case 'mistral':
        headers['Authorization'] = `Bearer ${this.getApiKey(model)}`;
        return {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            messages: messages.map(msg => ({
              role: msg.role,
              content: msg.content
            }))
          })
        };

      default:
        throw new Error(`Fournisseur non pris en charge : ${provider}`);
    }
  }

  // Parse la réponse selon le fournisseur
  parseResponse(provider, response) {
    switch (provider) {
      case 'openai':
        return {
          role: 'assistant',
          content: response.choices[0].message.content
        };

      case 'anthropic':
        return {
          role: 'assistant',
          content: response.content[0].text
        };

      case 'mistral':
        return {
          role: 'assistant',
          content: response.choices[0].message.content
        };

      default:
        throw new Error(`Fournisseur non pris en charge : ${provider}`);
    }
  }

  // Vérifie si une clé API est valide
  validateApiKey(model) {
    const key = this.getApiKey(model);
    if (!key) {
      const provider = this.getProvider(model);
      throw new Error(`Clé API manquante pour ${provider}`);
    }
    return true;
  }

  // Méthode principale pour envoyer un message
  async sendMessage(model, messages) {
    try {
      this.validateApiKey(model);
      const provider = this.getProvider(model);
      const endpoint = this.endpoints[provider];

      const requestOptions = this.formatRequest(provider, model, messages);

      const response = await fetch(endpoint, requestOptions);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Erreur API ${provider}: ${error.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      return this.parseResponse(provider, data);

    } catch (error) {
      console.error('Erreur lors de l\'envoi du message:', error);
      throw error;
    }
  }
}

module.exports = AIService;
