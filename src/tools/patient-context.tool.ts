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

export const getPatientAllergiesTool = new DynamicStructuredTool({
  name: 'get_patient_allergies',
  description:
    'Get a list of allergies (including severity and notes) for a specific patient. Use this when asked about patient allergies or adverse reactions.',
  schema: z.object({
    patientId: z.number().describe('The numeric patient ID'),
  }),
  func: async (input: any) => {
    try {
      const token = getToken();
      const api = createApiClient(token);
      const response = await api.get(`/patients/${input.patientId}/allergies`);
      return JSON.stringify({ success: true, allergies: response.data || response.data?.data });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const getPatientEmergencyContactsTool = new DynamicStructuredTool({
  name: 'get_patient_emergency',
  description:
    'Get the emergency contact information (name, relation, phone number) for a specific patient.',
  schema: z.object({
    patientId: z.number().describe('The numeric patient ID'),
  }),
  func: async (input: any) => {
    try {
      const token = getToken();
      const api = createApiClient(token);
      const response = await api.get(`/patients/${input.patientId}/emergency`);
      return JSON.stringify({ success: true, emergencyContacts: response.data || response.data?.data });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const getPatientInfoTool = new DynamicStructuredTool({
  name: 'get_patient_info',
  description:
    'Get extended patient information such as blood group, occupation, overseas status, and primary doctor.',
  schema: z.object({
    patientId: z.number().describe('The numeric patient ID'),
  }),
  func: async (input: any) => {
    try {
      const token = getToken();
      const api = createApiClient(token);
      const response = await api.get(`/patients/${input.patientId}/info`);
      return JSON.stringify({ success: true, patientInfo: response.data || response.data?.data });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const patientContextTools = [
  getPatientAllergiesTool,
  getPatientEmergencyContactsTool,
  getPatientInfoTool,
];
