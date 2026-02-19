import dotenv from 'dotenv';
dotenv.config();

import app from './app';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🤖 AI Chatbot server running on http://localhost:${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api/v1/chat`);
});
