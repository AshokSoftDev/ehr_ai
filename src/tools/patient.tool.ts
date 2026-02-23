import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { createApiClient, getApiErrorMessage } from '../utils/api-client';
import { getCurrentToken } from '../utils/token-context';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Patient Tools — Read + Write operations via EHR API
 *
 * Note: We use `func: async (input: any)` because @langchain/core v0.3.x
 * DynamicStructuredTool doesn't properly infer zod types under strict TS.
 * The zod schema still validates input at runtime.
 */

function getToken(): string {
  const token = getCurrentToken();
  if (!token) throw new Error('Authentication required');
  return token;
}

// ─── READ TOOLS ───

export const searchPatientsTool = new DynamicStructuredTool({
  name: 'search_patients',
  description:
    'Search patients by name, MRN, or phone number. Returns a paginated list of matching patients with total count. Use this for questions like "how many patients", "find patient X", "list all patients".',
  schema: z.object({
    search: z.string().optional().describe('Search term — matches patient name, MRN, or phone'),
    page: z.number().optional().describe('Page number (default 1)'),
    limit: z.number().optional().describe('Results per page, max 100 (default 20)'),
  }),
  func: async (input: any) => {
    try {
      const token = getToken();
      const api = createApiClient(token);
      const params: Record<string, string | number> = {};
      if (input.search) params.search = input.search;
      params.page = input.page || 1;
      params.limit = Math.min(input.limit || 20, 100);

      const response = await api.get('/patients', { params });
      const data = response.data?.data || response.data;
      return JSON.stringify({
        success: true,
        total: data.total || data.patients?.length || 0,
        page: data.page || 1,
        totalPages: data.totalPages || 1,
        patients: (data.patients || []).map((p: any) => ({
          patientId: p.patient_id,
          mrn: p.mrn,
          title: p.title,
          firstName: p.firstName,
          lastName: p.lastName,
          gender: p.gender,
          mobileNumber: p.mobileNumber,
          city: p.city,
          age: p.age,
        })),
      });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const getPatientDetailsTool = new DynamicStructuredTool({
  name: 'get_patient_details',
  description:
    'Get full details for a specific patient by their numeric patient ID. Use after search_patients to get more info.',
  schema: z.object({
    patientId: z.number().describe('The numeric patient_id'),
  }),
  func: async (input: any) => {
    try {
      const token = getToken();
      const api = createApiClient(token);
      const response = await api.get(`/patients/${input.patientId}`);
      const p = response.data?.data || response.data;
      return JSON.stringify({
        success: true,
        patient: {
          patientId: p.patient_id,
          mrn: p.mrn,
          title: p.title,
          firstName: p.firstName,
          lastName: p.lastName,
          dateOfBirth: p.dateOfBirth,
          age: p.age,
          gender: p.gender,
          mobileNumber: p.mobileNumber,
          address: p.address,
          area: p.area,
          city: p.city,
          state: p.state,
          country: p.country,
          pincode: p.pincode,
          referalSource: p.referalSource,
          comments: p.comments,
        },
      });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

// ─── WRITE TOOLS ───

export const createPatientTool = new DynamicStructuredTool({
  name: 'create_patient',
  description:
    'Create a new patient record. Requires: title, firstName, lastName, gender, mobileNumber, address, area, city, state, country, pincode.',
  schema: z.object({
    title: z.string().describe('Title (Mr, Mrs, Ms, Dr)'),
    firstName: z.string().describe('First name'),
    lastName: z.string().describe('Last name'),
    gender: z.string().describe('Gender (Male, Female, Other)'),
    mobileNumber: z.string().describe('Phone number'),
    address: z.string().describe('Street address'),
    area: z.string().describe('Area/locality'),
    city: z.string().describe('City'),
    state: z.string().describe('State'),
    country: z.string().describe('Country'),
    pincode: z.string().describe('Pincode/ZIP'),
    dateOfBirth: z.string().optional().describe('Date of birth (YYYY-MM-DD)'),
    aadhar: z.string().optional().describe('Aadhar number'),
    referalSource: z.string().optional().describe('Referral source'),
    comments: z.string().optional().describe('Comments'),
  }),
  func: async (input: any) => {
    try {
      const token = getToken();
      const api = createApiClient(token);
      const response = await api.post('/patients', input);
      return JSON.stringify({
        success: true,
        message: 'Patient created successfully',
        data: response.data,
      });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const updatePatientTool = new DynamicStructuredTool({
  name: 'update_patient',
  description:
    'Update an existing patient record. Provide patientId and only the fields to change.',
  schema: z.object({
    patientId: z.number().describe('The numeric patient_id'),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    mobileNumber: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
  }),
  func: async (input: any) => {
    try {
      const token = getToken();
      const { patientId, ...updateData } = input;
      const api = createApiClient(token);
      const response = await api.put(`/patients/${patientId}`, updateData);
      return JSON.stringify({
        success: true,
        message: 'Patient updated successfully',
        data: response.data,
      });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const deletePatientTool = new DynamicStructuredTool({
  name: 'delete_patient',
  description: 'Soft delete (deactivate) a patient record.',
  schema: z.object({
    patientId: z.number().describe('The numeric patient_id to delete'),
  }),
  func: async (input: any) => {
    try {
      const token = getToken();
      const api = createApiClient(token);
      const response = await api.delete(`/patients/${input.patientId}`);
      return JSON.stringify({
        success: true,
        message: 'Patient deleted successfully',
        data: response.data,
      });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const patientTools = [
  searchPatientsTool,
  getPatientDetailsTool,
  createPatientTool,
  updatePatientTool,
  deletePatientTool,
];
