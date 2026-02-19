import { z } from 'zod';

export const chatRequestSchema = z.object({
  message: z.string().min(1, 'Message is required').max(5000, 'Message too long'),
  conversationId: z.string().optional(),
});

export const clearConversationSchema = z.object({
  conversationId: z.string().min(1, 'Conversation ID is required'),
});

export type ChatRequestDto = z.infer<typeof chatRequestSchema>;
export type ClearConversationDto = z.infer<typeof clearConversationSchema>;
