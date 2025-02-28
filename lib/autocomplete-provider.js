const { CompositeDisposable } = require('atom');
const AIService = require('./ai-service');

class AutocompleteProvider {
  constructor() {
    // Initialisation des propriétés
    this.subscriptions = new CompositeDisposable();
    this.aiService = new AIService();
    this.typingTimer = null;
    this.isProcessing = false;
    this.typingDelay = 500; // Réduire le délai à 300ms
    this.minPrefixLength = 3; // Longueur minimale du préfixe pour déclencher l'autocomplétion
    this.lastCursorPosition = null;
    this.lastSuggestionPrefix = '';
    
    // Configuration des modèles d'IA à utiliser pour l'autocomplétion
    this.autocompleteModel = 'gpt-4o-mini'; // Modèle par défaut
    
    // Observer les changements de configuration
    this.subscriptions.add(
      atom.config.observe('pulsar-ai.autocompleteEnabled', (enabled) => {
        this.enabled = enabled;
      })
    );
    
    this.subscriptions.add(
      atom.config.observe('pulsar-ai.autocompleteModel', (model) => {
        if (model) this.autocompleteModel = model;
      })
    );
    
    this.subscriptions.add(
      atom.config.observe('pulsar-ai.autocompleteDelay', (delay) => {
        if (delay) this.typingDelay = delay;
      })
    );
    
    // Initialiser les observateurs d'éditeur
    this.setupEditorObservers();
  }
  
  setupEditorObservers() {
    // Observer tous les éditeurs de texte
    this.subscriptions.add(
      atom.workspace.observeTextEditors((editor) => {
        // Observer les événements d'insertion de texte
        const insertSubscription = editor.onDidInsertText((event) => {
          console.log('Pulsar AI - Autocomplétion - Texte inséré:', event.text);
          if (!this.enabled || this.isProcessing) {
            console.log('Pulsar AI - Autocomplétion - Ignoré car désactivé ou en cours:', {
              enabled: this.enabled,
              isProcessing: this.isProcessing
            });
            return;
          }
          
          // Ne pas déclencher pour les sauts de ligne ou les espaces
          if (event.text === '\n' || event.text === ' ' || event.text === '\t') {
            console.log('Pulsar AI - Autocomplétion - Caractère spécial ignoré');
            return;
          }
          
          // Réinitialiser le timer à chaque frappe
          console.log('Pulsar AI - Autocomplétion - Réinitialisation du timer');
          this.resetTypingTimer();
          
          // Démarrer un nouveau timer avec un délai plus court
          this.typingTimer = setTimeout(() => {
            console.log('Pulsar AI - Autocomplétion - Timer déclenché après insertion');
            this.handleTypingPause(editor);
          }, this.typingDelay);
        });
        
        // Observer les mouvements du curseur
        const cursorSubscription = editor.onDidChangeCursorPosition(({ newBufferPosition, oldBufferPosition }) => {
          // Ne réinitialiser le timer que si le curseur se déplace significativement
          // (pas juste à cause de la frappe)
          if (Math.abs(newBufferPosition.row - oldBufferPosition.row) > 0 ||
              Math.abs(newBufferPosition.column - oldBufferPosition.column) > 1) {
            this.lastCursorPosition = newBufferPosition;
            console.log('Pulsar AI - Autocomplétion - Mouvement significatif du curseur détecté');
            this.resetTypingTimer();
          }
        });
        
        // Ajouter les abonnements à notre CompositeDisposable
        this.subscriptions.add(insertSubscription);
        this.subscriptions.add(cursorSubscription);
        
        // Nettoyer les abonnements lorsque l'éditeur est détruit
        editor.onDidDestroy(() => {
          this.subscriptions.remove(insertSubscription);
          this.subscriptions.remove(cursorSubscription);
          insertSubscription.dispose();
          cursorSubscription.dispose();
        });
      })
    );
  }
  
  resetTypingTimer() {
    if (this.typingTimer) {
      console.log('Pulsar AI - Autocomplétion - Timer existant supprimé');
      clearTimeout(this.typingTimer);
      this.typingTimer = null;
    }
  }
  
  handleTypingPause(editor) {
    if (!editor.isAlive() || !this.enabled || this.isProcessing) {
      console.log('Pulsar AI - Autocomplétion - Pause de frappe ignorée:', {
        editorAlive: editor.isAlive(),
        enabled: this.enabled,
        isProcessing: this.isProcessing
      });
      return;
    }
    
    console.log('Pulsar AI - Autocomplétion - Pause de frappe détectée');
    
    try {
      // Obtenir le contexte actuel
      const context = this.getEditorContext(editor);
      
      // Vérifier si nous avons suffisamment de contexte pour suggérer
      if (!this.shouldTriggerCompletion(context)) {
        console.log('Pulsar AI - Autocomplétion - Conditions de déclenchement non remplies');
        return;
      }
      
      // Vérifier si le dernier caractère tapé est différent du précédent
      const currentText = context.textBeforeCursor;
      const lastChar = currentText.slice(-1);
      
      // Stocker la position actuelle du curseur pour référence future
      this.lastCursorPosition = context.cursorPosition;
      
      console.log('Pulsar AI - Autocomplétion - Démarrage du processus');
      
      // Marquer comme en cours de traitement pour éviter les requêtes multiples
      this.isProcessing = true;
      
      // Obtenir des suggestions de l'IA
      this.getSuggestion(context).then(suggestion => {
        // Appliquer la suggestion si elle est valide
        if (suggestion && editor.isAlive()) {
          this.applySuggestion(editor, suggestion, context.cursorPosition);
        } else {
          console.log('Pulsar AI - Autocomplétion - Pas de suggestion valide à appliquer');
        }
      }).catch(error => {
        console.error('Erreur lors de l\'autocomplétion:', error);
      }).finally(() => {
        this.isProcessing = false;
        console.log('Pulsar AI - Autocomplétion - Processus terminé');
      });
    } catch (error) {
      console.error('Erreur lors de l\'autocomplétion:', error);
      this.isProcessing = false;
    }
  }
  
  getEditorContext(editor) {
    // Obtenir la position actuelle du curseur
    const cursorPosition = editor.getCursorBufferPosition();
    
    // Obtenir le texte complet du document
    const fullText = editor.getText();
    
    // Obtenir la ligne actuelle
    const currentLine = editor.lineTextForBufferRow(cursorPosition.row);
    
    // Obtenir le texte avant le curseur sur la ligne actuelle
    const textBeforeCursor = currentLine.substring(0, cursorPosition.column);
    
    // Obtenir le texte après le curseur sur la ligne actuelle
    const textAfterCursor = currentLine.substring(cursorPosition.column);
    
    // Obtenir les lignes précédentes (jusqu'à 10 lignes)
    const previousLines = [];
    for (let i = Math.max(0, cursorPosition.row - 10); i < cursorPosition.row; i++) {
      previousLines.push(editor.lineTextForBufferRow(i));
    }
    
    // Obtenir les lignes suivantes (jusqu'à 5 lignes)
    const nextLines = [];
    for (let i = cursorPosition.row + 1; i < Math.min(editor.getLineCount(), cursorPosition.row + 6); i++) {
      nextLines.push(editor.lineTextForBufferRow(i));
    }
    
    // Obtenir le langage du document
    const grammar = editor.getGrammar();
    const language = grammar ? grammar.name.toLowerCase() : 'text';
    
    // Obtenir le nom du fichier
    const filePath = editor.getPath();
    const fileName = filePath ? filePath.split(/[/\\]/).pop() : 'untitled';
    
    return {
      fullText,
      currentLine,
      textBeforeCursor,
      textAfterCursor,
      previousLines,
      nextLines,
      cursorPosition,
      language,
      fileName
    };
  }
  
  shouldTriggerCompletion(context) {
    console.log('Pulsar AI - Autocomplétion - Vérification des conditions de déclenchement:', {
      textBeforeCursor: context.textBeforeCursor,
      textAfterCursor: context.textAfterCursor,
      longueurMinimale: this.minPrefixLength
    });

    // Ne pas déclencher si la ligne est vide ou trop courte
    if (!context.textBeforeCursor.trim() || context.textBeforeCursor.trim().length < this.minPrefixLength) {
      console.log('Pulsar AI - Autocomplétion - Texte trop court');
      return false;
    }
    
    // Ne pas déclencher dans les commentaires ou les chaînes de caractères
    const lastChar = context.textBeforeCursor.trim().slice(-1);
    if (lastChar === '"' || lastChar === "'" || lastChar === '`') {
      console.log('Pulsar AI - Autocomplétion - Dans une chaîne de caractères');
      return false;
    }
    
    // Ne pas déclencher après certains caractères spécifiques
    const nonTriggerChars = [';', '.', ',', ')', '}', ']'];
    if (nonTriggerChars.includes(lastChar)) {
      console.log('Pulsar AI - Autocomplétion - Après un caractère non déclencheur');
      return false;
    }
    
    // Vérifier si nous sommes en train de taper un mot
    const isTypingWord = /\w$/.test(context.textBeforeCursor);
    console.log('Pulsar AI - Autocomplétion - En train de taper un mot:', isTypingWord);
    
    return isTypingWord;
  }
  
  async getSuggestion(context) {
    try {
      // Construire un prompt pour l'IA
      const prompt = this.buildPrompt(context);
      
      // Log du prompt envoyé
      console.log('Pulsar AI - Autocomplétion - Prompt envoyé:', prompt);
      
      // Envoyer la requête à l'IA
      const messages = [
        { role: 'system', content: 'Tu es un assistant de programmation qui fournit des autocomplétion de code. Réponds uniquement avec le texte à compléter, sans explications ni formatage supplémentaire.' },
        { role: 'user', content: prompt }
      ];
      
      console.log('Pulsar AI - Autocomplétion - Envoi de la requête au modèle:', this.autocompleteModel);
      
      const response = await this.aiService.sendMessage(
        this.autocompleteModel,
        messages
      );
      
      // Log de la réponse reçue
      console.log('Pulsar AI - Autocomplétion - Réponse brute reçue:', response.content);
      
      // Traiter la réponse pour extraire la suggestion
      const suggestion = this.processResponse(response.content, context);
      console.log('Pulsar AI - Autocomplétion - Suggestion traitée:', suggestion);
      
      return suggestion;
    } catch (error) {
      console.error('Erreur lors de la récupération des suggestions:', error);
      return null;
    }
  }
  
  buildPrompt(context) {
    // Construire un contexte pour l'IA avec les informations pertinentes
    return `Je suis en train d'écrire du code ${context.language} dans un fichier nommé "${context.fileName}".
Voici les lignes précédentes:
\`\`\`${context.language}
${context.previousLines.join('\n')}
\`\`\`

Voici la ligne actuelle (le curseur est à la position | ):
\`\`\`${context.language}
${context.textBeforeCursor}|${context.textAfterCursor}
\`\`\`

Voici les lignes suivantes:
\`\`\`${context.language}
${context.nextLines.join('\n')}
\`\`\`

Complète la ligne actuelle et, si c'est le début d'un bloc (comme une méthode, une classe, une boucle, etc.), fournis le bloc complet avec l'indentation appropriée. Fournis uniquement le texte à insérer à la position du curseur, sans explications ni formatage supplémentaire.`;
  }
  
  processResponse(responseContent, context) {
    // Nettoyer la réponse
    let suggestion = responseContent.trim();
    
    // Supprimer les backticks et les indicateurs de langage si présents
    suggestion = suggestion.replace(/^```[\w]*\n/, '').replace(/\n```$/, '');
    
    // Log des étapes de traitement
    console.log('Pulsar AI - Autocomplétion - Nettoyage de la réponse:', {
      avant: responseContent,
      après: suggestion
    });
    
    // Éviter les suggestions vides ou trop longues
    if (!suggestion || suggestion.length > 1000) { // Augmenté pour permettre des blocs plus longs
      console.log('Pulsar AI - Autocomplétion - Suggestion rejetée:', 
        !suggestion ? 'vide' : 'trop longue');
      return null;
    }
    
    // Éviter les suggestions qui répètent le texte déjà présent
    if (context.textAfterCursor.trim().startsWith(suggestion.trim())) {
      console.log('Pulsar AI - Autocomplétion - Suggestion rejetée: répétition du texte existant');
      return null;
    }
    
    // Ajuster l'indentation si la suggestion contient plusieurs lignes
    if (suggestion.includes('\n')) {
      const baseIndent = context.textBeforeCursor.match(/^\s*/)[0];
      suggestion = suggestion.split('\n').map((line, index) => {
        if (index === 0) return line; // Première ligne garde son indentation
        return baseIndent + '  ' + line.trimLeft(); // Autres lignes: indentation + 2 espaces
      }).join('\n');
    }
    
    return suggestion;
  }
  
  applySuggestion(editor, suggestion, cursorPosition) {
    // Vérifier si l'éditeur est toujours valide
    if (!editor.isAlive()) {
      console.log('Pulsar AI - Autocomplétion - Éditeur non valide, suggestion abandonnée');
      return;
    }
    
    // Vérifier si le curseur n'a pas bougé depuis la demande
    const currentPosition = editor.getCursorBufferPosition();
    if (currentPosition.row !== cursorPosition.row || 
        currentPosition.column !== cursorPosition.column) {
      console.log('Pulsar AI - Autocomplétion - Position du curseur modifiée, suggestion abandonnée', {
        ancienne: cursorPosition,
        nouvelle: currentPosition
      });
      return;
    }
    
    console.log('Pulsar AI - Autocomplétion - Affichage de la suggestion:', suggestion);
    
    // Créer un marqueur pour l'autocomplétion
    const marker = editor.markBufferPosition(cursorPosition, { invalidate: 'never' });
    
    // Créer un élément pour afficher la suggestion
    const element = document.createElement('div');
    element.classList.add('pulsar-ai-autocomplete-suggestion');
    element.textContent = suggestion;
    
    // Ajouter la décoration
    const decoration = editor.decorateMarker(marker, {
      type: 'overlay',
      item: element,
      position: 'tail'
    });
    
    // Déterminer le préfixe actuel (le mot en cours de frappe)
    const line = editor.lineTextForBufferRow(cursorPosition.row);
    const textBeforeCursor = line.substring(0, cursorPosition.column);
    const prefixMatch = textBeforeCursor.match(/[\w\d_-]*$/);
    const prefix = prefixMatch ? prefixMatch[0] : '';
    
    console.log('Pulsar AI - Autocomplétion - Préfixe détecté:', prefix);
    
    // Ajouter des gestionnaires d'événements pour accepter ou rejeter la suggestion
    const handleKeyDown = (event) => {
      if (event.key === 'Tab') {
        // Accepter la suggestion
        event.preventDefault();
        
        // Si nous avons un préfixe, supprimer le préfixe avant d'insérer la suggestion
        if (prefix) {
          const prefixStart = {
            row: cursorPosition.row,
            column: cursorPosition.column - prefix.length
          };
          editor.setTextInBufferRange([prefixStart, cursorPosition], '');
        }
        
        editor.getBuffer().insert(cursorPosition, suggestion);
        console.log('Pulsar AI - Autocomplétion - Suggestion acceptée avec Tab');
        cleanup();
      } else if (event.key === 'Escape') {
        // Rejeter la suggestion
        event.preventDefault();
        console.log('Pulsar AI - Autocomplétion - Suggestion rejetée avec Escape');
        cleanup();
      } else if (event.key === 'ArrowRight') {
        // Accepter la suggestion avec flèche droite
        event.preventDefault();
        
        // Si nous avons un préfixe, supprimer le préfixe avant d'insérer la suggestion
        if (prefix) {
          const prefixStart = {
            row: cursorPosition.row,
            column: cursorPosition.column - prefix.length
          };
          editor.setTextInBufferRange([prefixStart, cursorPosition], '');
        }
        
        editor.getBuffer().insert(cursorPosition, suggestion);
        console.log('Pulsar AI - Autocomplétion - Suggestion acceptée avec ArrowRight');
        cleanup();
      }
    };
    
    // Ajouter l'écouteur d'événements
    editor.element.addEventListener('keydown', handleKeyDown);
    
    // Fonction de nettoyage
    const cleanup = () => {
      editor.element.removeEventListener('keydown', handleKeyDown);
      decoration.destroy();
      marker.destroy();
      console.log('Pulsar AI - Autocomplétion - Nettoyage de la suggestion effectué');
    };
    
    // Nettoyer après un délai si l'utilisateur n'interagit pas
    setTimeout(() => {
      if (marker.isValid()) {
        console.log('Pulsar AI - Autocomplétion - Suggestion expirée après délai');
        cleanup();
      }
    }, 10000); // 10 secondes
  }
  
  dispose() {
    this.resetTypingTimer();
    this.subscriptions.dispose();
  }
}

module.exports = AutocompleteProvider; 