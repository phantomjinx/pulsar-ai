import { BaseChatModel, type BaseChatModelParams } from "@langchain/core/language_models/chat_models"
import { AIMessage, BaseMessage } from "@langchain/core/messages"
import { ChatGeneration, type ChatResult } from "@langchain/core/outputs"
import { type CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager"
import { type BaseChatModelCallOptions } from "@langchain/core/language_models/chat_models"

// A mock chat model that returns a canned response
export class MockChatModel extends BaseChatModel {
  constructor(fields?: BaseChatModelParams) {
    super(fields ?? {})
  }

  // This method is required by the abstract class
  _identifyingParams(): Record<string, any> {
    return { model: "mock-chat-model" }
  }

  _llmType(): string {
    return "mock-chat-model"
  }

  async _generate(messages: BaseMessage[], options: BaseChatModelCallOptions, runManager?: CallbackManagerForLLMRun): Promise<ChatResult> {
    const lastHumanMessage = [...messages]
      .reverse()
      .find(m => m._getType() === "human")?.content?.toString() || "your message"

    await new Promise(resolve => setTimeout(resolve, 250))

    const responseText = `{${lastHumanMessage}} mock response`
    const message = new AIMessage(responseText)

    const generation: ChatGeneration = {
      message,
      text: responseText,
    }

    return {
      generations: [generation],
    }
  }
}
