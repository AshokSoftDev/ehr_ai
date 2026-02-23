import { processMessage } from '../agent/agent';
import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { prisma } from '../utils/prisma';
import { runWithToken } from '../utils/token-context';

// In-memory conversation store (for production, use Redis or database)
const conversationStore = new Map<string, BaseMessage[]>();

// Simple rate limiter per user
const rateLimiter = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30; // messages per minute
const RATE_WINDOW = 60 * 1000; // 1 minute

export interface ChatRequest {
  message: string;
  conversationId?: string;
}

export interface ChatResponse {
  success: boolean;
  response: string;
  conversationId: string;
  timestamp: string;
}

export interface UserContext {
  userId: string;
  email: string;
  accountType: string;
  groupId?: string | null;
}

/**
 * ChatService - Handles AI chat interactions
 */
export class ChatService {
  /**
   * Process a chat message
   */
  async chat(request: ChatRequest, token: string, user: UserContext): Promise<ChatResponse> {
    const { message, conversationId } = request;

    // Rate limiting check
    this.checkRateLimit(user.userId);

    // Get or create conversation ID
    const convId = conversationId || this.generateConversationId();

    // Get conversation history
    const history = conversationStore.get(convId) || [];

    // Check RBAC permissions
    await this.checkPermissions(user);

    // Add context to message
    const contextualMessage = this.addContext(message, user);

    try {
      // Process through the agent within a token context
      // This makes the token available to all tools via AsyncLocalStorage
      const result = await runWithToken(token, () =>
        processMessage(contextualMessage, token, history)
      );

      // Update conversation history
      const updatedHistory = [
        ...history,
        new HumanMessage(message),
        new AIMessage(result.response),
      ];

      // Limit history to last 20 messages
      const trimmedHistory = updatedHistory.slice(-20);
      conversationStore.set(convId, trimmedHistory);

      // Log the interaction
      await this.logInteraction(user.userId, convId, message, result.response);

      return {
        success: true,
        response: result.response,
        conversationId: convId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      console.error('[ChatService] Error:', errorMessage);

      // Provide user-friendly error messages
      let userMessage = 'I encountered an unexpected error. Please try again.';
      if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        userMessage = 'The AI service is experiencing high demand. Please wait a moment and try again.';
      } else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
        userMessage = 'The request took too long. Please try a simpler question or try again.';
      } else if (errorMessage.includes('permission')) {
        userMessage = errorMessage;
      }

      return {
        success: false,
        response: userMessage,
        conversationId: convId,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Clear conversation history
   */
  clearConversation(conversationId: string): boolean {
    return conversationStore.delete(conversationId);
  }

  /**
   * Get conversation history
   */
  getHistory(conversationId: string): BaseMessage[] {
    return conversationStore.get(conversationId) || [];
  }

  /**
   * Rate limiting per user
   */
  private checkRateLimit(userId: string): void {
    const now = Date.now();
    const record = rateLimiter.get(userId);

    if (!record || now > record.resetAt) {
      rateLimiter.set(userId, { count: 1, resetAt: now + RATE_WINDOW });
      return;
    }

    if (record.count >= RATE_LIMIT) {
      throw new Error('Rate limit exceeded. Please wait a moment before sending more messages.');
    }

    record.count++;
  }

  /**
   * Check RBAC permissions
   */
  private async checkPermissions(user: UserContext): Promise<void> {
    // Root users have all permissions
    if (user.accountType === 'root' || !user.groupId) {
      return;
    }

    try {
      const module = await prisma.module.findFirst({
        where: { name: 'AI Chat' },
        select: { id: true },
      });

      if (module) {
        const permission = await prisma.groupModulePermission.findUnique({
          where: {
            groupId_moduleId: {
              groupId: user.groupId,
              moduleId: module.id,
            },
          },
          select: { hasAccess: true },
        });

        if (!permission?.hasAccess) {
          throw new Error('You do not have permission to use the AI Chat feature');
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('permission')) {
        throw error;
      }
      console.warn('[ChatService] AI Chat module not found, allowing access');
    }
  }

  /**
   * Add context to the user message (date, time, user info)
   */
  private addContext(message: string, user: UserContext): string {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeStr = now.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return `[Context: User "${user.email}" (${user.accountType}), Current date: ${dateStr}, Time: ${timeStr}, Today: ${now.toISOString().split('T')[0]}]

User message: ${message}`;
  }

  /**
   * Generate a unique conversation ID
   */
  private generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Log interaction for KPI tracking
   */
  private async logInteraction(
    userId: string,
    conversationId: string,
    userMessage: string,
    aiResponse: string
  ): Promise<void> {
    console.log(`[ChatLog] User: ${userId}, Conv: ${conversationId}, Msg: ${userMessage.length}chars, Response: ${aiResponse.length}chars`);
  }
}

export const chatService = new ChatService();
