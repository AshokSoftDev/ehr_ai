import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { createApiClient, getApiErrorMessage } from '../utils/api-client';
import { getCurrentToken } from '../utils/token-context';

/* eslint-disable @typescript-eslint/no-explicit-any */

function getToken(): string {
  const token = getCurrentToken();
  if (!token) throw new Error('Authentication required');
  return token;
}

// ─── READ TOOLS ───

export const searchVisitsTool = new DynamicStructuredTool({
  name: 'search_visits',
  description:
    'Search visits with filters. Use for questions like "patient visits", "visits today". ' +
    'Returns paginated list with total count.',
  schema: z.object({
    dateFrom: z.string().optional().describe('Start date (YYYY-MM-DD)'),
    dateTo: z.string().optional().describe('End date (YYYY-MM-DD)'),
    doctor: z.string().optional().describe('Filter by doctor name or specialty'),
    patient: z.string().optional().describe('Filter by patient name or MRN'),
    status: z.string().optional().describe('Filter by appointment status'),
    page: z.number().optional().describe('Page number (default 1)'),
    limit: z.number().optional().describe('Results per page, max 100 (default 20)'),
  }),
  func: async (input: any) => {
    try {
      const token = getToken();
      const api = createApiClient(token);
      const params: Record<string, unknown> = {};
      if (input.dateFrom) params.dateFrom = input.dateFrom;
      if (input.dateTo) params.dateTo = input.dateTo;
      if (input.doctor) params.doctor = input.doctor;
      if (input.patient) params.patient = input.patient;
      if (input.status) params.status = input.status;
      params.page = input.page || 1;
      params.limit = Math.min(input.limit || 20, 100);

      const response = await api.get('/visits', { params });
      const data = response.data?.data || response.data;
      return JSON.stringify({
        success: true,
        total: data.total || 0,
        page: data.page || 1,
        totalPages: data.totalPages || 1,
        visits: data.visits || [],
      });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const getVisitStatusCountsTool = new DynamicStructuredTool({
  name: 'get_visit_status_counts',
  description:
    'Get visit status counts for a specific date and/or doctor. ' +
    'Returns counts grouped by status (booked, checked-in, with doctor, checked-out). ' +
    'Useful for dashboard-style summaries.',
  schema: z.object({
    date: z.string().optional().describe('Date (YYYY-MM-DD), defaults to today'),
    doctorId: z.string().optional().describe('Filter by doctor ID'),
  }),
  func: async (input: any) => {
    try {
      const token = getToken();
      const api = createApiClient(token);
      const params: Record<string, string> = {};
      if (input.date) params.date = input.date;
      if (input.doctorId) params.doctorId = input.doctorId;

      const response = await api.get('/visits/status-counts', { params });
      const data = response.data?.data || response.data;
      return JSON.stringify({ success: true, statusCounts: data });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const visitTools = [searchVisitsTool, getVisitStatusCountsTool];
