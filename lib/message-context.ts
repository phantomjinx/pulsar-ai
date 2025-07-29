import { Message, MessageCtxState } from './globals'
import { aiService } from './ai-service'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'

export class MessageContext {
  // The full history for UI consumption
  private fullHistory: Message[] = []

  // The truncated / summarised history submitted to the AI
  private ctxWindow: Message[] = []

  constructor(initialState?: MessageCtxState) {
    if (initialState) {
      this.fullHistory = initialState.history
      this.ctxWindow = initialState.contextWindow
    }
  }

  /**
   * Adds a new message to both the full history and context window.
   */
  addMessage(message: Message): void {
    console.log(`Adding message ${message.content} to message context`)
    this.fullHistory.push(message)
    this.ctxWindow.push(message)

    console.log(`fullHistory`, this.fullHistory)
    console.log(`ctxWindow`, this.ctxWindow)
  }

  /**
   * Returns the complete, unabridged history for rendering in the UI.
   */
  getFullHistory(): Message[] {
    return this.fullHistory
  }

  /**
   * Returns the processed window context including summarization.
   * Only useful for
   */
  serialize(): MessageCtxState {
    return {
      history: this.fullHistory,
      contextWindow: this.ctxWindow
    }
  }

  current(): Message | null {
    if (this.fullHistory.length === 0) return null
    return this.fullHistory[this.fullHistory.length - 1]
  }

  private findLastSummaryIndex(history: Message[]): number {
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i]
      if (msg.summary === true)
        return i
    }
    return -1
  }

  /**
   * Manages the conversation history, applying truncation and summarization.
   */
  async prepareSubmission(chatModel: BaseChatModel): Promise<Message[]> {
    console.log(`prepareSubmission (FH: ${this.fullHistory.length}) (CW: ${this.ctxWindow.length})`, this.fullHistory, this.ctxWindow)

    const historyLimit = atom.config.get('pulsar-ai.limitHistory') as number || 6
    console.log('historyLimit', historyLimit)

    // Calculate a threshold for summarization based upon the historyLimit
    const summaryTriggerCount = Math.max(historyLimit + 4, Math.floor(historyLimit * 1.5))
    console.log('summaryTriggerCount', summaryTriggerCount)

    // Find the last summary and treat it as our "base context".
    const lastSummaryIndex = this.findLastSummaryIndex(this.ctxWindow)
    console.log('lastSummaryIndex: ', lastSummaryIndex)

    // The "active history" is everything that has happened since the last summary.
    const activeHistory = lastSummaryIndex === -1 ? this.ctxWindow : this.ctxWindow.slice(lastSummaryIndex + 1)
    console.log('activeHistory', activeHistory)

    let submissionWindow: Message[]

    // Decide what to do with this active history chunk.
    if (activeHistory.length >= summaryTriggerCount) {
      // --- Summarization Path ---
      console.log(`Summarization triggered for ${activeHistory.length} new messages.`)

      // The messages to summarize are the ones that fall outside the sliding window.
      const messagesToSummarize = activeHistory.slice(0, -historyLimit)
      // The messages to keep are the most recent ones inside the window.
      const recentMessagesToKeep = activeHistory.slice(-historyLimit)

      // Get the text of the previous summary to be consolidated
      const oldSummaryText = lastSummaryIndex !== -1 ? this.ctxWindow[lastSummaryIndex] : undefined

      //Pass the old summary text to the summarize function
      console.log(`Summarizing messages:`, messagesToSummarize)
      const newConsolidatedSummary = await aiService.summarize(messagesToSummarize, chatModel, oldSummaryText)

      const baseContext = lastSummaryIndex !== -1 ? this.ctxWindow.slice(0, lastSummaryIndex) : []

      // The new context contains only the NEW consolidated summary and recent messages.
      // The old summary is no longer needed because its content is now inside the new one.

      // IMPORTANT: We update the *class's* ctxWindow here because a summary operation
      // has permanently changed the nature of the history.
      this.ctxWindow = [...baseContext, newConsolidatedSummary, ...recentMessagesToKeep]
      submissionWindow = this.ctxWindow

    } else if (this.ctxWindow.length > historyLimit) {
      // --- Truncation Path ---
      const baseContext = lastSummaryIndex !== -1 ? [this.ctxWindow[lastSummaryIndex]] : []
      const conversationalHistory = this.ctxWindow.filter((_, index) => {
        // For now, we assume only the summary is special.
        return index !== lastSummaryIndex
      })

      // 3. Truncate this pure conversational history to the limit.
      const truncatedConversation = conversationalHistory.slice(-historyLimit)
      const truncatedActiveHistory = activeHistory.slice(-historyLimit)

      console.log('prepareSubmission: baseContext', baseContext)
      console.log('prepareSubmission: truncatedConversation (not yet used)', truncatedConversation)
      console.log('prepareSubmission: truncatedActiveHistory', truncatedActiveHistory)

      // Build the temporary submission window without modifying this.ctxWindow.
      submissionWindow = [...baseContext, ...truncatedActiveHistory]
    } else {
      // --- No Action Path ---
      // If we're within the limit, the submission window is the same as the context window.
      submissionWindow = this.ctxWindow
    }

    return submissionWindow
  }

  clear() {
    this.fullHistory = []
    this.ctxWindow = []
  }
}
