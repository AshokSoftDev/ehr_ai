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

export const getDailySummaryTool = new DynamicStructuredTool({
  name: 'get_daily_summary',
  description:
    'Get a daily clinic summary including appointment counts, visit status breakdown. ' +
    'Use for questions like "how is today going?", "clinic summary", "daily overview".',
  schema: z.object({
    date: z.string().optional().describe('Date for summary (YYYY-MM-DD), defaults to today'),
  }),
  func: async (input: any) => {
    try {
      const token = getToken();
      const api = createApiClient(token);
      const targetDate = input.date || new Date().toISOString().split('T')[0];

      const [appointmentsRes, statusCountsRes] = await Promise.allSettled([
        api.get('/appointments', {
          params: { dateFrom: targetDate, dateTo: targetDate, limit: 100 },
        }),
        api.get('/visits/status-counts', {
          params: { date: targetDate },
        }),
      ]);

      let appointmentData = { total: 0, appointments: [] as any[] };
      if (appointmentsRes.status === 'fulfilled') {
        const d = appointmentsRes.value.data?.data || appointmentsRes.value.data;
        appointmentData = {
          total: d.total || 0,
          appointments: d.appointments || [],
        };
      }

      let statusCounts = {};
      if (statusCountsRes.status === 'fulfilled') {
        statusCounts = statusCountsRes.value.data?.data || statusCountsRes.value.data || {};
      }

      const statusBreakdown: Record<string, number> = {};
      appointmentData.appointments.forEach((a: any) => {
        const st = (a.appointment_status as string) || 'UNKNOWN';
        statusBreakdown[st] = (statusBreakdown[st] || 0) + 1;
      });

      return JSON.stringify({
        success: true,
        date: targetDate,
        summary: {
          totalAppointments: appointmentData.total,
          appointmentsByStatus: statusBreakdown,
          visitStatusCounts: statusCounts,
        },
      });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const dashboardTools = [getDailySummaryTool];
