import { processMessage, HumanMessage, AIMessage } from '../agent/agent';
import { BaseMessage } from '@langchain/core/messages';
import { prisma } from '../utils/prisma';

// In-memory conversation store (for production, use Redis or database)
const conversationStore = new Map<string, BaseMessage[]>();

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
    
    // Get or create conversation ID
    const convId = conversationId || this.generateConversationId();
    
    // Get conversation history
    const history = conversationStore.get(convId) || [];
    
    // Check RBAC permissions
    await this.checkPermissions(user);
    
    // Add context to message
    const contextualMessage = this.addContext(message, user);
    
    try {
      // Process through the agent
      const result = await processMessage(contextualMessage, token, history);
      
      // Update conversation history
      const updatedHistory = [
        ...history,
        new HumanMessage(message),
        new AIMessage(result.response),
      ];
      
      // Limit history to last 20 messages
      const trimmedHistory = updatedHistory.slice(-20);
      conversationStore.set(convId, trimmedHistory);
      
      // Log the interaction for KPI
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
      
      return {
        success: false,
        response: `I encountered an error: ${errorMessage}. Please try again.`,
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
   * Check RBAC permissions
   */
  private async checkPermissions(user: UserContext): Promise<void> {
    // Root users have all permissions
    if (user.accountType === 'root' || !user.groupId) {
      return;
    }

    // Check if user's group has access to AI Chat module
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
      // If module doesn't exist yet, allow access (will be created later)
      console.warn('[ChatService] AI Chat module not found, allowing access');
    }
  }

  /**
   * Add context to the user message
   */
  private addContext(message: string, user: UserContext): string {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return `[Context: User "${user.email}" (${user.accountType}), Current date: ${dateStr}, Time: ${timeStr}]

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
    // TODO: Implement database logging for KPI analytics
    // For now, just log to console
    console.log(`[ChatLog] User: ${userId}, Conv: ${conversationId}, Msg length: ${userMessage.length}, Response length: ${aiResponse.length}`);
  }
}

export const chatService = new ChatService();
