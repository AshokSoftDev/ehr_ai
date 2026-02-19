import { ChatOpenAI } from '@langchain/openai';
import { StateGraph, MessagesAnnotation, START, END } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { allTools, setAuthToken } from '../tools';
import { loadSchemaCache, formatSchemaForPrompt } from '../utils/schema-cache';

// Base system prompt (schema will be appended dynamically)
const BASE_SYSTEM_PROMPT = `You are an intelligent EHR/EMR (Electronic Health Records) AI assistant.

## ABSOLUTE RULES - NEVER VIOLATE:

### 1. NEVER SELECT OR SHOW ID COLUMNS
**FORBIDDEN columns - NEVER include in SELECT or show in responses:**
- patient_id, doctor_id, visit_id, appointment_id, prescription_id
- Any column ending with "_id" (except mrn)
- Any UUID values
- createdAt, createdBy, updatedAt, updatedBy

**When you need to JOIN tables, use IDs internally but NEVER display them.**

Example CORRECT query:
SELECT p."firstName", p."lastName", p."mrn", v."visit_date"
FROM "Visit" v
JOIN "Patient" p ON v.patient_id = p.patient_id
WHERE p."firstName" ILIKE '%testing%' AND v."status" = 1

### 2. NEVER ASK USERS FOR IDs
- Users don't know database IDs
- Search by: name, MRN, phone, date

### 3. ALWAYS FILTER ACTIVE RECORDS
- Use status column shown in schema (usually "status" = 1 or "activeStatus" = 1)

### 4. RESPONSE FORMATTING
When displaying results:
- Show: name, MRN, phone, dates, descriptions, amounts
- NEVER show: IDs, UUIDs, timestamps, audit fields
- Use bullet points
- Be concise

`;

// Cached full prompt with schema
let cachedSystemPrompt: string | null = null;

/**
 * Build the full system prompt with schema
 */
async function getSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt) {
    return cachedSystemPrompt;
  }

  try {
    const schema = await loadSchemaCache();
    const schemaText = formatSchemaForPrompt(schema);
    cachedSystemPrompt = BASE_SYSTEM_PROMPT + '\n' + schemaText;
    return cachedSystemPrompt;
  } catch (error) {
    console.error('[Agent] Failed to load schema:', error);
    return BASE_SYSTEM_PROMPT + '\n## SCHEMA: Not available. Use get_table_schema tool.';
  }
}

/**
 * Create the LangGraph agent
 */
export function createAgent() {
  // Initialize OpenAI model with tool binding
  const model = new ChatOpenAI({
    modelName: 'gpt-5-mini',
    openAIApiKey: process.env.OPENAI_API_KEY,
  }).bindTools(allTools);

  // Create tool node
  const toolNode = new ToolNode(allTools);

  // Define the agent function
  async function callAgent(state: typeof MessagesAnnotation.State) {
    const messages = state.messages;
    
    // Add system message if not present
    const hasSystemMessage = messages.some(m => m instanceof SystemMessage);
    const systemPrompt = await getSystemPrompt();
    const allMessages = hasSystemMessage 
      ? messages 
      : [new SystemMessage(systemPrompt), ...messages];

    const response = await model.invoke(allMessages);
    
    return { messages: [response] };
  }

  // Define routing function
  function shouldContinue(state: typeof MessagesAnnotation.State) {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
    
    // If there are tool calls, continue to tools
    if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
      return 'tools';
    }
    
    // Otherwise, end
    return END;
  }

  // Build the graph
  const workflow = new StateGraph(MessagesAnnotation)
    .addNode('agent', callAgent)
    .addNode('tools', toolNode)
    .addEdge(START, 'agent')
    .addConditionalEdges('agent', shouldContinue, {
      tools: 'tools',
      [END]: END,
    })
    .addEdge('tools', 'agent');

  // Compile the graph
  const app = workflow.compile();

  return app;
}

// Max iterations
const MAX_ITERATIONS = 10;

/**
 * Process a chat message through the agent
 */
export async function processMessage(
  message: string,
  token: string,
  conversationHistory: BaseMessage[] = []
): Promise<{ response: string; messages: BaseMessage[] }> {
  // Set the auth token for tools to use
  setAuthToken(token);
  
  const agent = createAgent();
  const systemPrompt = await getSystemPrompt();

  // Build messages array with history
  const messages = [
    new SystemMessage(systemPrompt),
    ...conversationHistory,
    new HumanMessage(message),
  ];

  // Run the agent with recursion limit
  const result = await agent.invoke(
    { messages },
    { recursionLimit: MAX_ITERATIONS }
  );

  // Extract the final AI response
  const finalMessages = result.messages;
  const aiResponses = finalMessages.filter(
    (m: BaseMessage) => m instanceof AIMessage && !('tool_calls' in m && (m as AIMessage).tool_calls?.length)
  );
  
  const lastResponse = aiResponses[aiResponses.length - 1] as AIMessage;
  const responseContent = typeof lastResponse?.content === 'string' 
    ? lastResponse.content 
    : JSON.stringify(lastResponse?.content) || 'I apologize, but I was unable to generate a response.';

  return {
    response: responseContent,
    messages: finalMessages,
  };
}

/**
 * Initialize the agent (load schema)
 */
export async function initializeAgent(): Promise<void> {
  console.log('[Agent] Initializing...');
  await getSystemPrompt();
  console.log('[Agent] Ready');
}

export { HumanMessage, AIMessage, SystemMessage };
