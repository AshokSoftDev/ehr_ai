import * as readline from 'readline';
import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';
import { processMessage, HumanMessage, AIMessage, initializeAgent } from '../agent/agent';
import { BaseMessage } from '@langchain/core/messages';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
};

const c = colors;

class ChatCLI {
  private rl: readline.Interface;
  private token: string | null = null;
  private conversationHistory: BaseMessage[] = [];
  private apiBaseUrl: string;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    this.apiBaseUrl = process.env.EHR_API_BASE_URL || 'http://localhost:3000/api/v1';
  }

  private print(message: string) {
    console.log(message);
  }

  private printHeader() {
    console.clear();
    this.print(`${c.bgBlue}${c.white}${c.bright}                                                              ${c.reset}`);
    this.print(`${c.bgBlue}${c.white}${c.bright}   🏥 EHR AI Assistant - Powered by OpenAI & LangGraph        ${c.reset}`);
    this.print(`${c.bgBlue}${c.white}${c.bright}                                                              ${c.reset}`);
    this.print('');
    this.print(`${c.dim}Commands:${c.reset}`);
    this.print(`  ${c.cyan}/login <email> <password>${c.reset} - Login to get auth token`);
    this.print(`  ${c.cyan}/clear${c.reset}                   - Clear conversation history`);
    this.print(`  ${c.cyan}/schema${c.reset}                  - Show database tables`);
    this.print(`  ${c.cyan}/help${c.reset}                    - Show available commands`);
    this.print(`  ${c.cyan}/exit${c.reset}                    - Exit the chat`);
    this.print('');
    this.print(`${c.dim}────────────────────────────────────────────────────────────${c.reset}`);
    this.print('');
  }

  private printAI(message: string) {
    this.print(`${c.green}${c.bright}🤖 AI:${c.reset} ${message}`);
  }

  private printUser(message: string) {
    this.print(`${c.blue}${c.bright}👤 You:${c.reset} ${message}`);
  }

  private printError(message: string) {
    this.print(`${c.red}${c.bright}❌ Error:${c.reset} ${message}`);
  }

  private printSuccess(message: string) {
    this.print(`${c.green}✅ ${message}${c.reset}`);
  }

  private printInfo(message: string) {
    this.print(`${c.yellow}ℹ️  ${message}${c.reset}`);
  }

  private async login(email: string, password: string): Promise<boolean> {
    try {
      this.printInfo('Logging in... ' + email + ' ' + password + ' ' + this.apiBaseUrl);
      const response = await axios.post(`${this.apiBaseUrl}/users/login`, {
        email,
        password,
      }).then((data)=>{
        return data.data;
      });

      if (response.data?.accessToken) {
        this.token = response.data.accessToken;
        this.printSuccess(`Logged in as ${email}`);
        return true;
      } else {
        this.printError('Login failed: No token received');
        return false;
      }
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message || error.message
        : 'Unknown error';
      this.printError(`Login failed: ${message}`);
      return false;
    }
  }

  private async processInput(input: string): Promise<void> {
    const trimmed = input.trim();

    if (!trimmed) return;

    // Handle commands
    if (trimmed.startsWith('/')) {
      await this.handleCommand(trimmed);
      return;
    }

    // Check if logged in
    if (!this.token) {
      this.printError('Please login first using: /login <email> <password>');
      return;
    }

    // Process chat message
    this.printUser(trimmed);
    this.print('');
    this.printInfo('Thinking...');

    try {
      const result = await processMessage(trimmed, this.token, this.conversationHistory);
      
      // Clear "Thinking..." line
      process.stdout.write('\x1b[1A\x1b[2K');
      
      // Update history
      this.conversationHistory.push(new HumanMessage(trimmed));
      this.conversationHistory.push(new AIMessage(result.response));
      
      // Keep only last 20 messages
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }

      this.print('');
      this.printAI(result.response);
    } catch (error) {
      process.stdout.write('\x1b[1A\x1b[2K');
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.printError(message);
    }

    this.print('');
  }

  private async handleCommand(command: string): Promise<void> {
    const parts = command.split(' ');
    const cmd = parts[0].toLowerCase();

    switch (cmd) {
      case '/login':
        if (parts.length < 3) {
          this.printError('Usage: /login <email> <password>');
          return;
        }
        await this.login(parts[1], parts[2]);
        break;

      case '/clear':
        this.conversationHistory = [];
        this.printSuccess('Conversation history cleared');
        break;

      case '/schema':
        if (!this.token) {
          this.printError('Please login first');
          return;
        }
        this.printInfo('Fetching database schema...');
        await this.processInput('List all the tables in the database');
        break;

      case '/help':
        this.print('');
        this.print(`${c.bright}Available Commands:${c.reset}`);
        this.print(`  ${c.cyan}/login <email> <password>${c.reset} - Login to the EHR system`);
        this.print(`  ${c.cyan}/clear${c.reset}                   - Clear conversation history`);
        this.print(`  ${c.cyan}/schema${c.reset}                  - Show database tables`);
        this.print(`  ${c.cyan}/help${c.reset}                    - Show this help message`);
        this.print(`  ${c.cyan}/exit${c.reset}                    - Exit the chat`);
        this.print('');
        this.print(`${c.bright}Example Queries:${c.reset}`);
        this.print(`  ${c.dim}"Show me today's appointments"${c.reset}`);
        this.print(`  ${c.dim}"Find patient with MRN P001"${c.reset}`);
        this.print(`  ${c.dim}"Create an appointment for patient 5 with doctor [id] tomorrow at 10am"${c.reset}`);
        this.print(`  ${c.dim}"List all doctors"${c.reset}`);
        this.print(`  ${c.dim}"Show prescriptions for visit 12"${c.reset}`);
        this.print('');
        break;

      case '/exit':
      case '/quit':
        this.print(`${c.yellow}Goodbye! 👋${c.reset}`);
        this.rl.close();
        process.exit(0);
        break;

      default:
        this.printError(`Unknown command: ${cmd}. Type /help for available commands.`);
    }
  }

  public async run(): Promise<void> {
    this.printHeader();

    if (!process.env.OPENAI_API_KEY) {
      this.printError('OPENAI_API_KEY is not set in environment variables');
      this.print(`${c.dim}Please set it in your .env file${c.reset}`);
      this.print('');
    }

    // Initialize agent and load schema
    this.printInfo('Loading database schema...');
    try {
      await initializeAgent();
      this.printSuccess('Schema loaded successfully');
    } catch (error) {
      this.printError('Failed to load schema - queries may not work correctly');
    }

    const prompt = () => {
      this.rl.question(`${c.magenta}> ${c.reset}`, async (input) => {
        await this.processInput(input);
        prompt();
      });
    };

    prompt();
  }
}

// Run CLI
const cli = new ChatCLI();
cli.run().catch(console.error);
