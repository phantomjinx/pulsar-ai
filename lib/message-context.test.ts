import { MessageContext } from './message-context'
import { aiService, SUMMARY_PREFIX } from './ai-service'
import { Message, Role } from './globals'

// Mock the entire aiService since MessageContext depends on it for summarization.
jest.mock('./ai-service', () => ({
  SUMMARY_PREFIX: 'SUMMARY of earlier conversation',
  aiService: {
    summarize: jest.fn(),
  },
}))

// Mock atom.config.get
// @ts-ignore
global.atom = { config: { get: jest.fn() } }

// Helper to generate messages
const generateMessages = (count: number, msgIdx?: number): Message[] => {
  if (!msgIdx) msgIdx = 0
  const messages: Message[] = []
  for (let i = 0; i < count; i++) {
    const role = i % 2 === 0 ? Role.User : Role.Assistant
    messages.push({ role, content: `Message ${msgIdx + i + 1}` })
  }
  return messages
}


describe('MessageContext', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('Should not modify a short history before truncation', async () => {
    // Arrange
    (atom.config.get as jest.Mock).mockReturnValue(6) // historyLimit = 6
    const initialMessages = generateMessages(5)

    // Mock the return value of the aiService.summarize call
    const summaryMessage: Message = {
      role: Role.User, // As we decided
      content: `${SUMMARY_PREFIX}: A summary was made.`,
      summary: true,
    }
    const summarizeSpy = jest.spyOn(aiService, 'summarize').mockResolvedValue(summaryMessage)

    // Create a new instance for this test
    const messageCtx = new MessageContext()
    initialMessages.forEach(msg => messageCtx.addMessage(msg))

    const submissionWindow = await messageCtx.prepareSubmission({} as any) // Pass a dummy chatModel

    // Assert
    expect(submissionWindow.length).toBe(5)
    for (let i = 0; i < submissionWindow.length; i++) {
      expect(submissionWindow[i].content).toBe(`Message ${i + 1}`)
    }
    expect(summarizeSpy).not.toHaveBeenCalled()
  })

  test('Should use last summary as a checkpoint', async () => {
    (atom.config.get as jest.Mock).mockReturnValue(6) // historyLimit = 6
    let initialMessages = []

    console.log(`SUMMARY_PREFIX: ${SUMMARY_PREFIX}`)

    // Manually insert a summary to act as a checkpoint
    const oldSummary = {
      role: Role.User,
      content: `${SUMMARY_PREFIX}: An old summary.`,
      summary: true
    }
    // Add 10 more messages to trigger a new summary
    initialMessages.push(oldSummary, ...generateMessages(10))
    console.log('initialMessages', initialMessages)

    // Mock the return value of the aiService.summarize call
    const summaryMessage: Message = {
      role: Role.User, // As we decided
      content: `${SUMMARY_PREFIX}: A summary was made.`,
      summary: true,
    }
    const summarizeSpy = jest.spyOn(aiService, 'summarize').mockResolvedValue(summaryMessage)

    // Create a new instance for this test
    const messageCtx = new MessageContext()
    initialMessages.forEach(msg => messageCtx.addMessage(msg))

    const submissionWindow = await messageCtx.prepareSubmission({} as any) // Pass a dummy chatModel
    console.log('submissionWindow', submissionWindow)

    expect(summarizeSpy).toHaveBeenCalledTimes(1)
    // Will summarize those messages falling outside the context window
    // ie. those messages more recent than the historyLimit,
    // and include the in the new summary the old summary
    expect(summarizeSpy).toHaveBeenCalledWith(
      [...initialMessages.slice(1, 5) ]
      , {}, oldSummary)

    // The final context should be [summary] + [6 recent messages]
    expect(submissionWindow.length).toBe(7)
    expect(submissionWindow[0].content).toContain('A summary was made.')
    expect(submissionWindow[1].content).toContain('Message 5') // First new message content is Message 8
  })

  test('Should truncate a long history before summarize', async () => {
    (atom.config.get as jest.Mock).mockReturnValue(6) // historyLimit = 6
    const initialMessages = generateMessages(9)

    // Mock the return value of the aiService.summarize call
    const summaryMessage: Message = {
      role: Role.User, // As we decided
      content: `${SUMMARY_PREFIX}: A summary was made.`,
      summary: true,
    }
    const summarizeSpy = jest.spyOn(aiService, 'summarize').mockResolvedValue(summaryMessage)

    // Create a new instance for this test
    const messageCtx = new MessageContext()
    initialMessages.forEach(msg => messageCtx.addMessage(msg))

    const submissionWindow = await messageCtx.prepareSubmission({} as any) // Pass a dummy chatModel

    // Assert
    expect(submissionWindow.length).toBe(6) // Truncated to historyLimit
    // messages should be the last 6 of the 9, ie. [4, 5, 6, 7, 8, 9]
    for (let i = 0; i < submissionWindow.length; i++) {
      expect(submissionWindow[i].content).toBe(`Message ${i + 1 + 3}`)
    }
    expect(summarizeSpy).not.toHaveBeenCalled()
  })

  test('Should summarize and truncate when history reaches both trigger counts', async () => {
    (atom.config.get as jest.Mock).mockReturnValue(6) // historyLimit = 6
    const initialMessages = generateMessages(12) // summaryTriggerCount will be calculated as 10

    // Mock the return value of the aiService.summarize call
    const summaryMessage: Message = {
      role: Role.User, // As we decided
      content: `${SUMMARY_PREFIX}: A summary was made.`,
      summary: true,
    }
    const summarizeSpy = jest.spyOn(aiService, 'summarize').mockResolvedValue(summaryMessage)

    // Create a new instance for this test
    const messageCtx = new MessageContext()
    initialMessages.forEach(msg => messageCtx.addMessage(msg))

    const submissionWindow = await messageCtx.prepareSubmission({} as any) // Pass a dummy chatModel

    expect(summarizeSpy).toHaveBeenCalledTimes(1)

    // Will summarize those messages falling outside the context window
    // ie. those messages more recent than the historyLimit
    expect(summarizeSpy).toHaveBeenCalledWith(initialMessages.slice(0, 6), {}, undefined)

    // The final context should be [summary] + [6 recent messages]
    expect(submissionWindow.length).toBe(7)
    expect(submissionWindow[0].summary).toBe(true)
    expect(submissionWindow[1].content).toBe('Message 7') // messages 7 - 12
  })

  test('Should summarize when history reaches trigger count', async () => {
    (atom.config.get as jest.Mock).mockReturnValue(6) // historyLimit = 6
    const initialMessages = generateMessages(10) // summaryTriggerCount will be 10

    // Mock the return value of the aiService.summarize call
    const summaryMessage: Message = {
      role: Role.User, // As we decided
      content: `${SUMMARY_PREFIX}: A summary was made.`,
      summary: true,
    }
    const summarizeSpy = jest.spyOn(aiService, 'summarize').mockResolvedValue(summaryMessage)

    // Create a new instance for this test
    const messageCtx = new MessageContext()
    initialMessages.forEach(msg => messageCtx.addMessage(msg))

    const submissionWindow = await messageCtx.prepareSubmission({} as any) // Pass a dummy chatModel

    const internalCtxWindow = (messageCtx as any).ctxWindow // Access private state for verification

    expect(summarizeSpy).toHaveBeenCalledTimes(1)
    // The messages to summarize are the ones outside the sliding window (10 - 6 = 4)
    expect(summarizeSpy).toHaveBeenCalledWith(initialMessages.slice(0, 4), expect.anything(), undefined)

    // Check the returned array for the submission
    expect(submissionWindow.length).toBe(7) // 1 summary + 6 recent messages
    expect(submissionWindow[0].content).toContain('A summary was made.')
    expect(submissionWindow[1].content).toBe('Message 5')

    // Also check the internal state was correctly updated
    expect(internalCtxWindow.length).toBe(7)
    expect(internalCtxWindow[0].content).toContain('A summary was made.')
  })
})
