import { Request, Response, NextFunction } from 'express';
import { chatService } from '../services/chat.service';
import { ChatRequestDto } from '../schemas/chat.schema';
import { AppError } from '../middleware/error.middleware';

export class ChatController {
  /**
   * POST /api/v1/chat
   * Process a chat message
   */
  async chat(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      const authHeader = req.headers.authorization;
      const token = typeof authHeader === 'string' ? authHeader.replace('Bearer ', '') : undefined;
      if (!token) {
        throw new AppError('Token not found', 401);
      }

      const body = req.body as ChatRequestDto;
      
      const result = await chatService.chat(
        {
          message: body.message,
          conversationId: body.conversationId,
        },
        token,
        {
          userId: req.user.userId,
          email: req.user.email,
          accountType: req.user.accountType,
          groupId: req.user.groupId,
        }
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/chat/:conversationId
   * Clear conversation history
   */
  async clearConversation(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      const conversationId = req.params.conversationId as string;
      const success = chatService.clearConversation(conversationId);

      res.json({
        success,
        message: success ? 'Conversation cleared' : 'Conversation not found',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/chat/health
   * Check if AI service is healthy
   */
  async health(_req: Request, res: Response) {
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
    const hasDbUrl = !!process.env.DATABASE_URL;

    res.json({
      status: hasOpenAIKey && hasDbUrl ? 'healthy' : 'degraded',
      services: {
        openai: hasOpenAIKey ? 'configured' : 'missing',
        database: hasDbUrl ? 'configured' : 'missing',
      },
      timestamp: new Date().toISOString(),
    });
  }
}

export const chatController = new ChatController();
