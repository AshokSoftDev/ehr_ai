import { Router } from 'express';
import { chatController } from '../controllers/chat.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { chatRequestSchema } from '../schemas/chat.schema';

const router = Router();

// Health check (no auth required)
router.get('/health', chatController.health);

// Protected routes
router.post('/', authenticate, validate(chatRequestSchema), chatController.chat);
router.delete('/:conversationId', authenticate, chatController.clearConversation);

export default router;
