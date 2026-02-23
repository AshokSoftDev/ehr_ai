import { ChatOpenAI } from '@langchain/openai';
import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { StateGraph, MessagesAnnotation, START, END } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { allTools } from '../tools';

/**
 * EHR AI Agent — LangGraph-based agent with API tools
 *
 * Architecture:
 * - Singleton compiled agent (created once, reused)
 * - All data access via EHR API tools (no raw SQL)
 * - Auth token passed per-request via AsyncLocalStorage (token-context.ts)
 * - Topic guardrails in system prompt
 */
 
const MAX_ITERATIONS = 15;

// ─── SYSTEM PROMPT ───

const SYSTEM_PROMPT = `You are an EHR (Electronic Health Record) AI assistant for a clinic/hospital. Your name is "EHR Assistant".

## TOPIC RESTRICTION — STRICTLY ENFORCED
You ONLY help with topics related to clinic/hospital operations:
- Patient records, demographics, search, registration
- Doctor information, specialties, schedules
- Appointments (booking, rescheduling, cancellation, status)
- Visits, clinical notes, diagnoses
- Prescriptions, medications, drug information
- Billing — invoices, receipts, payments, revenue
- Clinic analytics and daily summaries
- Medical context (allergies, emergency contacts, patient info, documents, dental chart)

If a user asks about ANYTHING ELSE (general knowledge, coding, recipes, weather, politics, math, science, personal advice, jokes, stories, translations, etc.), you MUST reply EXACTLY:
"I'm your clinic assistant — I can only help with patient records, appointments, visits, prescriptions, billing, and clinic medical context. Please ask me something related to your clinic operations! 🏥"

NEVER answer non-EHR questions, even if the user insists or says "just this once."

## HOW TO ANSWER EHR QUESTIONS
1. **Use your tools** — ALWAYS use the provided tools to fetch real data. Never make up data.
2. **Verify existence first** — If asked about a specific patient's or doctor's records/schedule, ALWAYS search for that person first (using search_patients or search_doctors) to confirm they exist in the clinic records. If they don't exist, tell the user the person was not found in our records.
3. **For counting** — Use search tools, and read the "total" field from the response.
4. **For "today"** — Use today's date (the current date) as both dateFrom and dateTo.
5. **For "this month"** — Use the 1st of the current month as dateFrom and today as dateTo.
6. **For "this week"** — Calculate the Monday of the current week as dateFrom and today as dateTo.
7. **Chain tools** — For complex queries, call multiple tools. E.g., first search_patients → then search_visits.
8. **Format nicely** — Use bullet points, bold text, and clear structure. Be concise but helpful.

## RULES
- NEVER use technical terms like "database", "system", "API", or "query". Speak naturally to clinic staff (e.g., say "I checked our clinic records" instead of "I searched the database").
- NEVER show internal database IDs, UUIDs, or audit fields (createdBy, updatedBy, etc.)
- NEVER guess or fabricate data — if a tool returns no results, say so clearly
- When creating/updating records, confirm what you're about to do before executing
- For destructive actions (delete), always ask for confirmation first
- Use patient MRN numbers (not IDs) when referencing patients
- Use doctor display names when referencing doctors

## COMMON QUESTIONS MAPPING
Here's how to handle typical questions:

| Question | Tool to Use |
|----------|------------|
| "How many patients?" | search_patients (check total) |
| "Today's appointments" | search_appointments (dateFrom=today, dateTo=today) |
| "Dr. X's schedule" | search_doctors (to verify Dr. X exists) → search_appointments (doctorName="X") |
| "Find patient Ramesh" | search_patients (search="Ramesh") |
| "Patient's prescriptions" | search_patients → search_visits → get_visit_prescriptions |
| "Revenue this month" | search_invoices (from_date, to_date) |
| "Unpaid invoices" | search_invoices (status="sent") |
| "Daily summary" | get_dashboard_metrics → get_dashboard_pipeline |
| "Revenue trend" | get_dashboard_revenue_trend |
| "Today's schedule timeline" | get_dashboard_schedule |
`;

// ─── SINGLETON AGENT ───

type CompiledAgent = ReturnType<typeof buildAgent>;
let cachedAgent: CompiledAgent | null = null;

function buildAgent() {
  const model = new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: 0,
    openAIApiKey: process.env.OPENAI_API_KEY,
  }).bindTools(allTools);

  const toolNode = new ToolNode(allTools);

  async function callAgent(state: typeof MessagesAnnotation.State) {
    const response = await model.invoke(state.messages);
    return { messages: [response] };
  }

  function shouldContinue(state: typeof MessagesAnnotation.State) {
    const lastMessage = state.messages[state.messages.length - 1];
    if (
      lastMessage instanceof AIMessage &&
      lastMessage.tool_calls &&
      lastMessage.tool_calls.length > 0
    ) {
      return 'tools';
    }
    return END;
  }

  const workflow = new StateGraph(MessagesAnnotation)
    .addNode('agent', callAgent)
    .addNode('tools', toolNode)
    .addEdge(START, 'agent')
    .addConditionalEdges('agent', shouldContinue, {
      tools: 'tools',
      [END]: END,
    })
    .addEdge('tools', 'agent');

  return workflow.compile();
}

function getAgent() {
  if (!cachedAgent) {
    console.log('[Agent] Registering tools...');
    cachedAgent = buildAgent();
    console.log('[Agent] Compiled and cached LangGraph agent');
  }
  return cachedAgent;
}

// ─── PUBLIC API ───

/**
 * Process a user message through the AI agent.
 *
 * IMPORTANT: This must be called within a runWithToken() context
 * so that tools can access the auth token via getCurrentToken().
 *
 * @param message - The user's message
 * @param token - JWT auth token (unused directly, kept for API compatibility)
 * @param conversationHistory - Previous messages in this conversation
 */
export async function processMessage(
  message: string,
  _token: string,
  conversationHistory: BaseMessage[] = []
): Promise<{ response: string; messages: BaseMessage[] }> {
  const agent = getAgent();

  const messages = [
    new SystemMessage(SYSTEM_PROMPT),
    ...conversationHistory,
    new HumanMessage(message),
  ];

  const result = await agent.invoke(
    { messages },
    { recursionLimit: MAX_ITERATIONS }
  );

  const finalMessages = result.messages;
  const aiResponses = finalMessages.filter(
    (m: BaseMessage) =>
      m instanceof AIMessage &&
      !('tool_calls' in m && (m as AIMessage).tool_calls?.length)
  );

  const lastResponse = aiResponses[aiResponses.length - 1] as AIMessage;
  const responseContent =
    typeof lastResponse?.content === 'string'
      ? lastResponse.content
      : JSON.stringify(lastResponse?.content) ||
        'I apologize, but I was unable to generate a response. Please try again.';

  return {
    response: responseContent,
    messages: finalMessages,
  };
}
