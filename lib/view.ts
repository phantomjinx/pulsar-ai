import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js/lib/core'
import { Range, Point, ViewModel } from 'atom'
import { projectBrowser } from './project-browser'

// Base languages
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import ruby from 'highlight.js/lib/languages/ruby'
import php from 'highlight.js/lib/languages/php'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import sql from 'highlight.js/lib/languages/sql'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import yaml from 'highlight.js/lib/languages/yaml'

// Modern languages
import rust from 'highlight.js/lib/languages/rust'
import go from 'highlight.js/lib/languages/go'
import kotlin from 'highlight.js/lib/languages/kotlin'
import swift from 'highlight.js/lib/languages/swift'
import dart from 'highlight.js/lib/languages/dart'
import elixir from 'highlight.js/lib/languages/elixir'

// Web frameworks and related
import jsx from 'highlight.js/lib/languages/javascript'  // JSX uses JS highlighter
import tsx from 'highlight.js/lib/languages/typescript'  // TSX uses TS highlighter
import vue from 'highlight.js/lib/languages/xml'        // Vue uses XML/HTML highlighter
import scss from 'highlight.js/lib/languages/scss'
import less from 'highlight.js/lib/languages/less'
import graphql from 'highlight.js/lib/languages/graphql'

// Infrastructure and config
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import nginx from 'highlight.js/lib/languages/nginx'
import { aiService } from './ai-service'
import { ModelSelector } from './model-selector'
import { CodeSelection, EditorMetadata, Message, MessageCtxState, ModelMetadata, PulsarAIState, PulsarAIViewOptions, Role } from './globals'
import { isError } from './utils'
import { MessageContext } from './message-context'

export class PulsarAIView implements ViewModel {

  private static SERIALIZATION_ID = 'pulsar-ai/PulsarAIView'

  private selectedModel?: string
  private currentCodeSelection?: CodeSelection
  private readonly messageContext: MessageContext

  private divContainer: HTMLDivElement
  private modelSelector!: ModelSelector
  private messagesContainer!: HTMLDivElement
  private textarea!: HTMLTextAreaElement
  private clearButton!: HTMLButtonElement
  private sendButton!: HTMLButtonElement

  private onStateUpdated: (state: PulsarAIState) => void
  private marked: any
  private shareFileCheckbox: any

  constructor(options: PulsarAIViewOptions) {

    console.log(`Creating View with options: `, options)

    // Default to an empty function
    this.onStateUpdated = options.stateUpdated || (() => {})

    // Register languages
    this.registerLanguages()

    // Setup marked with highlight.js
    this.setupMarked()

    // Create and setup UI
    // Create main container
    this.divContainer = document.createElement('div')
    this.divContainer.classList.add('pulsar-ai-container')

    const modelMetadata = options.state?.modelMetadata
    this.setupUI(modelMetadata)

    // // Restore messages if present in state
    let msgCtxState: MessageCtxState = { history: [], contextWindow: []}
    if (options.state?.messageContext) {
      msgCtxState = options.state?.messageContext
    }
    this.messageContext = new MessageContext(msgCtxState)
    this.renderMessages()
  }

  // Helper method to safely serialize range
  // serializeRange(range) {
  //   if (!range) return null
  //   return {
  //     start: { row: range.start.row, column: range.start.column },
  //     end: { row: range.end.row, column: range.end.column }
  //   }
  // }

  // Helper method to safely process code selection metadata
  // processCodeSelectionMetadata(metadata) {
  //   if (!metadata || !metadata.codeSelection) return metadata
  //
  //   const { editor, selection } = metadata.codeSelection
  //   if (!editor || !selection) return metadata
  //
  //   return {
  //     ...metadata,
  //     codeSelection: {
  //       filePath: editor.getPath(),
  //       selection: this.serializeRange(selection)
  //     }
  //   }
  // }

  // // Helper method to create buffer range from serialized format
  // createBufferRange(serializedRange) {
  //   // if (!serializedRange?.start?.row !== undefined) return null
  //
  //   try {
  //     const Range = require('atom').Range
  //     return new Range(
  //       [serializedRange.start.row, serializedRange.start.column],
  //       [serializedRange.end.row, serializedRange.end.column]
  //     )
  //   } catch (error) {
  //     console.error('Error creating buffer range:', error)
  //     return null
  //   }
  // }

  private registerLanguages() {
    // Base languages
    hljs.registerLanguage('javascript', javascript)
    hljs.registerLanguage('typescript', typescript)
    hljs.registerLanguage('python', python)
    hljs.registerLanguage('ruby', ruby)
    hljs.registerLanguage('php', php)
    hljs.registerLanguage('html', xml)
    hljs.registerLanguage('css', css)
    hljs.registerLanguage('sql', sql)
    hljs.registerLanguage('bash', bash)
    hljs.registerLanguage('json', json)
    hljs.registerLanguage('yaml', yaml)

    // Modern languages
    hljs.registerLanguage('rust', rust)
    hljs.registerLanguage('go', go)
    hljs.registerLanguage('kotlin', kotlin)
    hljs.registerLanguage('swift', swift)
    hljs.registerLanguage('dart', dart)
    hljs.registerLanguage('elixir', elixir)

    // Web frameworks and related
    hljs.registerLanguage('jsx', jsx)
    hljs.registerLanguage('tsx', tsx)
    hljs.registerLanguage('vue', vue)
    hljs.registerLanguage('scss', scss)
    hljs.registerLanguage('less', less)
    hljs.registerLanguage('graphql', graphql)

    // Infrastructure and config
    hljs.registerLanguage('dockerfile', dockerfile)
    hljs.registerLanguage('nginx', nginx)
  }

  private setupMarked() {

    this.marked = new Marked(
      markedHighlight({
        emptyLangClass: 'hljs',
        langPrefix: 'hljs language-',
        highlight(code, lang, info) {
          if (lang && hljs.getLanguage(lang)) {
            try {
              return hljs.highlight(code, {
                language: lang,
                ignoreIllegals: true
              }).value
            } catch (err) {
              console.error('Highlighting error:', err)
              return code
            }
          }
          return code
        }
      })
    )

    this.marked.setOptions({
      breaks: true,
      gfm: true
    })
  }

  private setupUI(modelMetadata?: ModelMetadata) {
    // Create the model Selector
    this.modelSelector = new ModelSelector(modelMetadata)
    this.modelSelector.on('change', () => {
      this.onStateUpdated(this.serialize())
    })

    // Add messages container
    this.messagesContainer = document.createElement('div')
    this.messagesContainer.classList.add('pulsar-ai-messages')

    // Add input area
    const inputContainer = this.setupInputArea()

    // Assemble all elements
    this.divContainer.appendChild(this.modelSelector.getComponent())
    this.divContainer.appendChild(this.messagesContainer)
    this.divContainer.appendChild(inputContainer)
  }

  private setupInputArea(): HTMLDivElement {
    const inputContainer = document.createElement('div')
    inputContainer.classList.add('pulsar-ai-input-container')

    // Create the main input container
    const inputWrapper = document.createElement('div')
    inputWrapper.classList.add('input-wrapper')

    // New "+ Add context" button at the beginning of input-wrapper
    const contextButton = document.createElement('button')
    contextButton.classList.add('pulsar-ai-add-context-button')
    contextButton.innerHTML = '<span class="icon icon-plus"></span> Add context'

    // New "Clear Context" button at the beginning of input-wrapper
    const clearButton = document.createElement('button')
    clearButton.classList.add('pulsar-ai-clear-context-button')
    clearButton.innerHTML = '<span class="icon icon-trashcan"></span> Clear context'

    // Create the Project Navigator instance
    document.body.appendChild(projectBrowser.element)

    // Add context button click event
    contextButton.addEventListener('click', (e) => {
      e.stopPropagation()
      projectBrowser.toggle()
    })

    // Add clear button click event
    clearButton.addEventListener('click', (e) => {
      e.stopPropagation()
      this.clearMessages()
    })

    // Create the textarea
    this.textarea = document.createElement('textarea')
    this.textarea.classList.add('input-textarea', 'native-key-bindings')
    this.textarea.setAttribute('placeholder', 'Ask anything...')
    this.textarea.addEventListener('keydown', async (event) => {
      if (event.key === 'Enter' && event.ctrlKey) {
        event.preventDefault()
        console.log(`Send Message to model ${this.selectedModel}`)
        await this.sendMessage()
      }
    })

    // Create the toolbar
    const toolbarContainer = document.createElement('div')
    toolbarContainer.classList.add('toolbar-container')

    // Create the send button
    this.sendButton = document.createElement('button')
    this.sendButton.classList.add('btn', 'icon', 'icon-playback-play')
    this.sendButton.addEventListener('click', () => {
      console.log('TODO Send Clicked')
      this.sendMessage()
    })

    // Add the send button to the toolbar
    toolbarContainer.appendChild(this.sendButton)

    inputWrapper.appendChild(contextButton)
    inputWrapper.appendChild(clearButton)
    inputWrapper.appendChild(this.textarea)
    inputWrapper.appendChild(toolbarContainer)

    inputContainer.appendChild(inputWrapper)

    return inputContainer
  }

  private async getActiveEditorContent() {
    const editor = atom.workspace.getActiveTextEditor()
    if (!editor) return null

    const filePath = editor.getPath()
    if (!filePath) return null

    return {
      content: editor.getText(),
      filename: filePath.split('/').pop(),
      language: editor.getGrammar().name,
      path: filePath
    }
  }

  // private isFileAlreadyShared(filePath: string) {
  //   return this.messages.some(msg =>
  //     msg.metadata?.sharedFiles?.includes(filePath)
  //   )
  // }

  //
  // async updateShareFileButton() {
  //   const editorContent = await this.getActiveEditorContent()
  //
  //   if (editorContent) {
  //     const isShared = this.isFileAlreadyShared(editorContent.path)
  //     this.shareFileButton.style.display = 'flex'
  //     this.shareFileLabel.textContent = ` ${editorContent.filename}`
  //     if (isShared) {
  //       this.shareFileCheckbox.checked = false
  //     }
  //   } else {
  //     this.shareFileButton.style.display = 'none'
  //   }
  // }

  private async addMessage(role: Role, content: string, metadata?: EditorMetadata) {
    // Update currentCodeSelection from metadata
    if (metadata?.codeSelection) {
        this.currentCodeSelection = {
          filePath: metadata.codeSelection.filePath,
          selection: metadata.codeSelection.selection
        }
    }

    // Create safe metadata for storage
    const safeMetadata = metadata?.codeSelection ? {
      codeSelection: this.currentCodeSelection
    } : metadata

    const message: Message = { role, content, metadata: safeMetadata }
    await this.renderMessage(message)
    this.messageContext.addMessage(message)
  }

  private async renderMessage(message: Message) {
    const messageElement = document.createElement('div')
    messageElement.classList.add('pulsar-ai-message', `pulsar-ai-message-${message.role}`)

    const contentElement = document.createElement('div')
    contentElement.classList.add('pulsar-ai-message-content')

    // Process code blocks
    const codeBlocks = new Map()
    let codeBlockCounter = 0
    const processedContent = message.content.replace(/```(\w+)?\n([\s\S]*?)\n```/g, (match, language, code) => {
      const placeholder = `CODE_BLOCK_${codeBlockCounter}`
      codeBlocks.set(placeholder, { language: language || '', code: code.trim() })
      codeBlockCounter++
      return placeholder
    })

    // Convert to Markdown
    let htmlContent = this.marked.parse(processedContent)

    // Restore code blocks
    codeBlocks.forEach((block, placeholder) => {
      // Add Apply button only for assistant messages and if we have a selection

      const applyButton = (message.role === 'assistant' && this.currentCodeSelection) ?
        `<button class="btn btn-xs btn-apply icon icon-check">Apply</button>` : ''

      let highlightedCode = block.code
      if (block.language && hljs.getLanguage(block.language)) {
        try {
          highlightedCode = hljs.highlight(block.code, {
            language: block.language,
            ignoreIllegals: true
          }).value
        } catch (err) {
          console.error('Error highlighting:', err)
        }
      }

      const codeHtml = `
        <div class="code-block-wrapper">
          <div class="code-block-actions">
            <button class="btn btn-xs btn-copy icon icon-clippy">Copy</button>
            ${applyButton}
          </div>
          <pre class="code-block"><code class="hljs language-${block.language}">${highlightedCode}</code></pre>
        </div>
      `

      htmlContent = htmlContent.replace(placeholder, codeHtml)
    })

    contentElement.innerHTML = htmlContent

    // Add copy button handlers
    // TODO
    // contentElement.querySelectorAll('.btn-copy').forEach(button => {
    //   button.addEventListener('click', (e) => {
    //     if (! e.target) return
    //
    //     const code = e.target.closest('.code-block-wrapper').querySelector('code').textContent
    //     atom.clipboard.write(code)
    //
    //     // Visual feedback
    //     const originalText = e.target.textContent
    //     e.target.textContent = 'Copied!'
    //     e.target.classList.add('btn-success')
    //
    //     setTimeout(() => {
    //       e.target.textContent = originalText
    //       e.target.classList.remove('btn-success')
    //     }, 2000)
    //   })
    // })

    // Add apply button handlers
    // contentElement.querySelectorAll('.btn-apply').forEach(button => {
    //
    //   let highlightMarker = null
    //
    //   button.addEventListener('mouseenter', () => {
    //     if (!this.currentCodeSelection) return
    //
    //     const { filePath, selection } = this.currentCodeSelection
    //     const editor = atom.workspace.getTextEditors().find(ed => ed.getPath() === filePath)
    //
    //     if (editor) {
    //       const startPoint = new Point(selection.start.row, selection.start.column)
    //       const endPoint = new Point(selection.end.row, selection.end.column)
    //       const range = new Range(startPoint, endPoint)
    //
    //       highlightMarker = editor.markBufferRange(range, {
    //         invalidate: 'never'
    //       })
    //
    //       editor.decorateMarker(highlightMarker, {
    //         type: 'highlight',
    //         class: 'pulsar-ai-apply-highlight'
    //       })
    //     }
    //   })

      // button.addEventListener('mouseleave', () => {
      //   if (highlightMarker) {
      //     highlightMarker.destroy()
      //     highlightMarker = null
      //   }
      // })

    //   button.addEventListener('click', async (e) => {
    //     try {
    //       const code = e.target.closest('.code-block-wrapper').querySelector('code').textContent
    //
    //       if (!this.currentCodeSelection) {
    //         atom.notifications.addWarning('No selection information available', {
    //           dismissable: true
    //         })
    //         return
    //       }
    //
    //       const { filePath, selection } = this.currentCodeSelection
    //
    //       // Get editor for the file
    //       let editor = atom.workspace.getTextEditors().find(ed => ed.getPath() === filePath)
    //       if (!editor) {
    //         editor = await atom.workspace.open(filePath)
    //       }
    //
    //       if (!editor || !editor.isAlive()) {
    //         atom.notifications.addError('Failed to apply changes', {
    //           detail: 'Could not find or open the target editor.',
    //           dismissable: true
    //         })
    //         return
    //       }
    //
    //       const buffer = editor.getBuffer()
    //       const startPoint = new Point(selection.start.row, selection.start.column)
    //       const endPoint = new Point(selection.end.row, selection.end.column)
    //       const range = new Range(startPoint, endPoint)
    //       editor.setCursorBufferPosition(startPoint)
    //       editor.transact(() => {
    //         const originalIndent = editor.indentationForBufferRow(selection.start.row)
    //         const indentedCode = code.split('\n').map(line => {
    //           if (line.trim() === '') return ''
    //           return ' '.repeat(originalIndent * editor.getTabLength()) + line
    //         }).join('\n')
    //
    //         editor.setTextInBufferRange(range, indentedCode)
    //       })
    //
    //       // Visual feedback
    //       button.textContent = 'Applied!'
    //       button.classList.add('btn-success')
    //       setTimeout(() => {
    //         button.textContent = 'Apply'
    //         button.classList.remove('btn-success')
    //       }, 2000)
    //
    //     } catch (error) {
    //       console.error('Error applying changes:', error)
    //       atom.notifications.addError('Failed to apply changes', {
    //         detail: error.message,
    //         dismissable: true
    //       })
    //     }
    //   })
    // })

    messageElement.appendChild(contentElement)
    this.messagesContainer.appendChild(messageElement)
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight
  }

  private async renderMessages() {
    this.messagesContainer.innerHTML = ''
    for (const message of this.messageContext.getFullHistory()) {
      await this.renderMessage(message)
    }
  }

  private async sendMessage() {
    const content = this.textarea.value.trim()
    if (!content) return

    try {
      this.setLoading(true)

      // Get the current editor and selection
      const editor = atom.workspace.getActiveTextEditor()
      const selection = editor?.getSelectedBufferRange()

      // Store current selection for assistant's response
      if (editor && selection && !selection.isEmpty()) {
        this.currentCodeSelection = {
          filePath: editor.getPath(),
          selection: selection
        }
      } else {
        this.currentCodeSelection = undefined
      }

      // Handle file sharing first
      // const editorContent = await this.getActiveEditorContent()
      // if (editorContent && this.shareFileCheckbox.checked && !this.isFileAlreadyShared(editorContent.path)) {
      //   const fileMessage = `Here is the content of the file '${editorContent.filename}' (${editorContent.language}):\n\`\`\`${editorContent.language.toLowerCase()}\n${editorContent.content}\n\`\`\``
      //   await this.addMessage(Role.System, fileMessage, {
      //     sharedFiles: [editorContent.path]
      //   })
      // }

      // Add user message (content) with selection metadata
      await this.addMessage(Role.User, content, this.currentCodeSelection ? {
        codeSelection: this.currentCodeSelection
      } : undefined)
      this.textarea.value = ''

      // Get AI response
      await aiService.sendMessage(
        this.modelSelector.getModelMetadata(),
        this.messageContext)

      this.renderMessages()

      // // Add assistant response with same metadata
      // await this.addMessage(Role.Assistant, response.content, this.currentCodeSelection ? {
      //   codeSelection: {
      //     ...this.currentCodeSelection
      //   }
      // } : null)

    } catch (error) {
      atom.notifications.addError('Error sending message', {
        detail: isError(error) ? error.message : 'no further details',
        dismissable: true
      })
      console.error('Error sendMessage:', error)
    } finally {
      this.setLoading(false)
    }
  }

  private setLoading(isLoading: boolean) {
    this.sendButton.disabled = isLoading
    this.textarea.disabled = isLoading
    // TODO
    // this.modelSelector.disabled = isLoading

    if (isLoading) {
      this.sendButton.classList.add('is-loading')
    } else {
      this.sendButton.classList.remove('is-loading')
    }
  }

  private clearMessages() {
    this.messageContext.clear()
    this.messagesContainer.innerHTML = ''
  }

  private serialize(): PulsarAIState {
    const state: PulsarAIState =  {
      deserializer: PulsarAIView.SERIALIZATION_ID,

      modelMetadata: this.modelSelector.getModelMetadata(),

      messageContext: this.messageContext.serialize()
    }

    return state
  }

  destroy() {
    this.divContainer.remove()

    // TODO
    // if (this.projectBrowser && this.projectBrowser.element) {
    //   this.projectBrowser.element.remove()
    // }
  }

  getElement() {
    return this.divContainer
  }

  getTitle() {
    return 'Pulsar AI'
  }

  getURI() {
    return 'atom://pulsar-ai-view'
  }

  getIconName() {
    return 'book'
  }
}
