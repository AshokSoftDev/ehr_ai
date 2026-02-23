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

export const searchDoctorsTool = new DynamicStructuredTool({
  name: 'search_doctors',
  description: 'Search doctors by name or specialty. Returns a list of matching doctors.',
  schema: z.object({
    search: z.string().optional().describe('Search by doctor name'),
    specialty: z.string().optional().describe('Filter by specialty'),
  }),
  func: async (input: any) => {
    try {
      const token = getToken();
      const api = createApiClient(token);
      const params: Record<string, string> = {};
      if (input.search) params.search = input.search;
      if (input.specialty) params.specialty = input.specialty;

      const response = await api.get('/doctors', { params });
      const data = response.data?.data || response.data;
      const doctors = data.doctors || data || [];
      return JSON.stringify({
        success: true,
        total: data.total || doctors.length,
        doctors: (Array.isArray(doctors) ? doctors : []).map((d: any) => ({
          doctorId: d.id,
          title: d.title,
          firstName: d.firstName,
          lastName: d.lastName,
          displayName: d.displayName,
          specialty: d.specialty,
          degree: d.degree,
          email: d.email,
          licenceNo: d.licenceNo,
        })),
      });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const getDoctorDetailsTool = new DynamicStructuredTool({
  name: 'get_doctor_details',
  description: 'Get full details for a specific doctor by their ID.',
  schema: z.object({
    doctorId: z.string().describe('The doctor UUID/ID'),
  }),
  func: async (input: any) => {
    try {
      const token = getToken();
      const api = createApiClient(token);
      const response = await api.get(`/doctors/${input.doctorId}`);
      const d = response.data?.data || response.data;
      return JSON.stringify({
        success: true,
        doctor: {
          doctorId: d.id,
          title: d.title,
          firstName: d.firstName,
          lastName: d.lastName,
          displayName: d.displayName,
          specialty: d.specialty,
          degree: d.degree,
          email: d.email,
          licenceNo: d.licenceNo,
          address: d.address,
          city: d.city,
          state: d.state,
        },
      });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

// ─── WRITE TOOLS ───

export const createDoctorTool = new DynamicStructuredTool({
  name: 'create_doctor',
  description:
    'Create a new doctor record. Required: title, firstName, lastName, specialty, email, degree, displayName, displayColor, licenceNo, dob.',
  schema: z.object({
    title: z.string().describe('Title (Dr, Prof)'),
    firstName: z.string(),
    lastName: z.string(),
    dob: z.string().describe('Date of birth (YYYY-MM-DD)'),
    email: z.string(),
    licenceNo: z.string(),
    degree: z.string(),
    specialty: z.string(),
    displayName: z.string(),
    displayColor: z.string().describe('Display color hex code, e.g. #3b82f6'),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    pincode: z.string().optional(),
  }),
  func: async (input: any) => {
    try {
      const token = getToken();
      const api = createApiClient(token);
      const response = await api.post('/doctors', input);
      return JSON.stringify({
        success: true,
        message: 'Doctor created successfully',
        data: response.data,
      });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const updateDoctorTool = new DynamicStructuredTool({
  name: 'update_doctor',
  description: 'Update an existing doctor record.',
  schema: z.object({
    doctorId: z.string().describe('The doctor UUID/ID'),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    specialty: z.string().optional(),
    email: z.string().optional(),
    degree: z.string().optional(),
  }),
  func: async (input: any) => {
    try {
      const token = getToken();
      const { doctorId, ...updateData } = input;
      const api = createApiClient(token);
      const response = await api.put(`/doctors/${doctorId}`, updateData);
      return JSON.stringify({
        success: true,
        message: 'Doctor updated successfully',
        data: response.data,
      });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const deleteDoctorTool = new DynamicStructuredTool({
  name: 'delete_doctor',
  description: 'Soft delete a doctor record.',
  schema: z.object({
    doctorId: z.string().describe('The doctor UUID/ID'),
  }),
  func: async (input: any) => {
    try {
      const token = getToken();
      const api = createApiClient(token);
      const response = await api.delete(`/doctors/${input.doctorId}`);
      return JSON.stringify({
        success: true,
        message: 'Doctor deleted successfully',
        data: response.data,
      });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const doctorTools = [
  searchDoctorsTool,
  getDoctorDetailsTool,
  createDoctorTool,
  updateDoctorTool,
  deleteDoctorTool,
];
