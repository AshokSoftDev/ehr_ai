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

export const searchAppointmentsTool = new DynamicStructuredTool({
  name: 'search_appointments',
  description:
    'Search appointments with filters. Use dateFrom and dateTo for date range queries. ' +
    'For "today\'s appointments" use today\'s date for both dateFrom and dateTo. ' +
    'Returns paginated list with total count.',
  schema: z.object({
    dateFrom: z.string().optional().describe('Start date filter (YYYY-MM-DD)'),
    dateTo: z.string().optional().describe('End date filter (YYYY-MM-DD)'),
    patientName: z.string().optional().describe('Filter by patient name'),
    doctorName: z.string().optional().describe('Filter by doctor name'),
    mrn: z.string().optional().describe('Filter by patient MRN'),
    search: z.string().optional().describe('General search term'),
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
      if (input.patientName) params.patientName = input.patientName;
      if (input.doctorName) params.doctorName = input.doctorName;
      if (input.mrn) params.mrn = input.mrn;
      if (input.search) params.search = input.search;
      params.page = input.page || 1;
      params.limit = Math.min(input.limit || 20, 100);

      const response = await api.get('/appointments', { params });
      const data = response.data?.data || response.data;
      return JSON.stringify({
        success: true,
        total: data.total || 0,
        page: data.page || 1,
        totalPages: data.totalPages || 1,
        appointments: (data.appointments || []).map((a: any) => ({
          appointmentId: a.appointment_id,
          appointmentDate: a.appointment_date,
          startTime: a.start_time,
          endTime: a.end_time,
          appointmentType: a.appointment_type,
          appointmentStatus: a.appointment_status,
          reasonForVisit: a.reason_for_visit,
          patientName: `${a.patient_firstName || ''} ${a.patient_lastName || ''}`.trim(),
          patientMrn: a.patient_mrn,
          doctorName: `${a.doctor_title || ''} ${a.doctor_firstName || ''} ${a.doctor_lastName || ''}`.trim(),
          doctorSpecialty: a.doctor_specialty,
        })),
      });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const getCheckedOutAppointmentsTool = new DynamicStructuredTool({
  name: 'get_checked_out_appointments',
  description: 'Get completed/checked-out appointments. Useful for visit history queries.',
  schema: z.object({
    dateFrom: z.string().optional().describe('Start date (YYYY-MM-DD)'),
    dateTo: z.string().optional().describe('End date (YYYY-MM-DD)'),
    page: z.number().optional().describe('Page number (default 1)'),
    limit: z.number().optional().describe('Results per page (default 20)'),
  }),
  func: async (input: any) => {
    try {
      const token = getToken();
      const api = createApiClient(token);
      const response = await api.get('/appointments/completed', { params: input });
      const data = response.data?.data || response.data;
      return JSON.stringify({ success: true, data });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const getAppointmentDoctorsTool = new DynamicStructuredTool({
  name: 'get_appointment_doctors',
  description: 'Get list of doctors available for appointments.',
  schema: z.object({}),
  func: async () => {
    try {
      const token = getToken();
      const api = createApiClient(token);
      const response = await api.get('/appointments/doctors');
      const data = response.data?.data || response.data;
      return JSON.stringify({ success: true, doctors: data });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const searchPatientMrnTool = new DynamicStructuredTool({
  name: 'search_patient_mrn',
  description: 'Search for patients by MRN prefix. Returns matching patient IDs and MRNs.',
  schema: z.object({
    search: z.string().describe('MRN prefix to search'),
  }),
  func: async (input: any) => {
    try {
      const token = getToken();
      const api = createApiClient(token);
      const response = await api.get('/appointments/search/mrn', {
        params: { search: input.search },
      });
      const data = response.data?.data || response.data;
      return JSON.stringify({ success: true, results: data });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

// ─── WRITE TOOLS ───

export const createAppointmentTool = new DynamicStructuredTool({
  name: 'create_appointment',
  description:
    'Create a new appointment. Requires patient_id, doctor_id, appointment_date, start_time, end_time, appointment_type.',
  schema: z.object({
    patient_id: z.number().describe('Patient ID (numeric)'),
    doctor_id: z.string().describe('Doctor ID (UUID)'),
    appointment_date: z.string().describe('Appointment date (YYYY-MM-DD)'),
    start_time: z.string().describe('Start time (ISO datetime)'),
    end_time: z.string().describe('End time (ISO datetime)'),
    appointment_type: z.string().describe('Type (Consultation, Follow-up, etc.)'),
    reason_for_visit: z.string().optional(),
    appointment_status: z.string().optional().describe('Status (default BOOKED)'),
    notes: z.string().optional(),
  }),
  func: async (input: any) => {
    try {
      const token = getToken();
      const api = createApiClient(token);
      const response = await api.post('/appointments', input);
      return JSON.stringify({
        success: true,
        message: 'Appointment created successfully',
        data: response.data,
      });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const updateAppointmentTool = new DynamicStructuredTool({
  name: 'update_appointment',
  description: 'Update an existing appointment.',
  schema: z.object({
    appointmentId: z.number().describe('Appointment ID'),
    appointment_date: z.string().optional(),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    appointment_status: z.string().optional(),
    reason_for_visit: z.string().optional(),
    notes: z.string().optional(),
  }),
  func: async (input: any) => {
    try {
      const token = getToken();
      const { appointmentId, ...updateData } = input;
      const api = createApiClient(token);
      const response = await api.put(`/appointments/${appointmentId}`, updateData);
      return JSON.stringify({
        success: true,
        message: 'Appointment updated successfully',
        data: response.data,
      });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const cancelAppointmentTool = new DynamicStructuredTool({
  name: 'cancel_appointment',
  description: 'Cancel/soft-delete an appointment.',
  schema: z.object({
    appointmentId: z.number().describe('Appointment ID to cancel'),
  }),
  func: async (input: any) => {
    try {
      const token = getToken();
      const api = createApiClient(token);
      const response = await api.delete(`/appointments/${input.appointmentId}`);
      return JSON.stringify({
        success: true,
        message: 'Appointment cancelled successfully',
        data: response.data,
      });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const appointmentTools = [
  searchAppointmentsTool,
  getCheckedOutAppointmentsTool,
  getAppointmentDoctorsTool,
  searchPatientMrnTool,
  createAppointmentTool,
  updateAppointmentTool,
  cancelAppointmentTool,
];
