import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { createApiClient, getApiErrorMessage } from '../utils/api-client';
import { getCurrentToken } from '../utils/token-context';

function getToken(): string {
  const token = getCurrentToken();
  if (!token) throw new Error('Authentication required');
  return token;
}

export const getDashboardMetricsTool = new DynamicStructuredTool({
  name: 'get_dashboard_metrics',
  description:
    'Get top KPI metrics for a specific date (appointments count, total revenue, patients registered). ' +
    'Use for questions like "what is our revenue today?", "how many patients today?", "daily overview".',
  schema: z.object({
    date: z.string().optional().describe('Date for metrics (YYYY-MM-DD), defaults to today'),
  }),
  func: async (input) => {
    try {
      const api = createApiClient(getToken());
      const targetDate = input.date || new Date().toISOString().split('T')[0];
      const res = await api.get('/dashboard/metrics', { params: { date: targetDate } });
      return JSON.stringify(res.data);
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const getDashboardPipelineTool = new DynamicStructuredTool({
  name: 'get_dashboard_pipeline',
  description:
    'Get the current real-time patient flow pipeline for today (booked, checked-in, with doctor, payment pending, completed).',
  schema: z.object({
    date: z.string().optional().describe('Date for pipeline (YYYY-MM-DD), defaults to today'),
  }),
  func: async (input) => {
    try {
      const api = createApiClient(getToken());
      const targetDate = input.date || new Date().toISOString().split('T')[0];
      const res = await api.get('/dashboard/pipeline', { params: { date: targetDate } });
      return JSON.stringify(res.data);
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const getDashboardScheduleTool = new DynamicStructuredTool({
  name: 'get_dashboard_schedule',
  description:
    'Get today\'s upcoming appointments schedule (timeline). Shows patient name, doctor, time, and status.',
  schema: z.object({
    date: z.string().optional().describe('Date for schedule (YYYY-MM-DD), defaults to today'),
    limit: z.number().optional().describe('Max number of appointments to return, defaults to 10'),
  }),
  func: async (input) => {
    try {
      const api = createApiClient(getToken());
      const targetDate = input.date || new Date().toISOString().split('T')[0];
      const res = await api.get('/dashboard/schedule', { 
        params: { date: targetDate, limit: input.limit || 10 } 
      });
      return JSON.stringify(res.data);
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const getDashboardRevenueTrendTool = new DynamicStructuredTool({
  name: 'get_dashboard_revenue_trend',
  description:
    'Get the revenue trend (billed vs collected) over the past N days. Used for financial reporting charts.',
  schema: z.object({
    days: z.number().optional().describe('Number of days to look back, defaults to 7'),
  }),
  func: async (input) => {
    try {
      const api = createApiClient(getToken());
      const res = await api.get('/dashboard/revenue-trend', { 
        params: { days: input.days || 7 } 
      });
      return JSON.stringify(res.data);
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const dashboardTools = [
  getDashboardMetricsTool,
  getDashboardPipelineTool,
  getDashboardScheduleTool,
  getDashboardRevenueTrendTool,
];
