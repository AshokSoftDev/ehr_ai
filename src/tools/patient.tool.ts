import { DynamicTool } from '@langchain/core/tools';
import { createApiClient, getApiErrorMessage } from '../utils/api-client';

// Global token holder (set before using tools)
let authToken: string | null = null;

export function setAuthToken(token: string) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

/**
 * Patient Tools - Only CREATE, UPDATE, DELETE operations via EHR API
 * For reading/searching, use the queryDatabaseTool instead
 */

// Create patient
export const createPatientTool = new DynamicTool({
  name: 'create_patient',
  description: 'Create a new patient record. Input should be a JSON object with: title, firstName, lastName, gender, mobileNumber, address, area, city, state, country, pincode. Optional: dateOfBirth, aadhar, referalSource, comments.',
  func: async (input: string) => {
    try {
      if (!authToken) return JSON.stringify({ error: 'Authentication required' });

      const patientData = JSON.parse(input || '{}');
      const api = createApiClient(authToken);
      const response = await api.post('/patients', patientData);
      return JSON.stringify({ success: true, data: response.data, message: 'Patient created successfully' });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

// Update patient
export const updatePatientTool = new DynamicTool({
  name: 'update_patient',
  description: 'Update an existing patient record. Input should be a JSON object with patientId and fields to update.',
  func: async (input: string) => {
    try {
      if (!authToken) return JSON.stringify({ error: 'Authentication required' });

      const params = JSON.parse(input || '{}');
      if (!params.patientId) return JSON.stringify({ error: 'patientId is required' });
      
      const { patientId, ...updateData } = params;
      const api = createApiClient(authToken);
      const response = await api.put(`/patients/${patientId}`, updateData);
      return JSON.stringify({ success: true, data: response.data, message: 'Patient updated successfully' });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

// Soft delete patient
export const deletePatientTool = new DynamicTool({
  name: 'delete_patient',
  description: 'Soft delete a patient record. Input should be a JSON object with patientId (number).',
  func: async (input: string) => {
    try {
      if (!authToken) return JSON.stringify({ error: 'Authentication required' });

      const params = JSON.parse(input || '{}');
      if (!params.patientId) return JSON.stringify({ error: 'patientId is required' });
      
      const api = createApiClient(authToken);
      const response = await api.delete(`/patients/${params.patientId}`);
      return JSON.stringify({ success: true, data: response.data, message: 'Patient deleted successfully' });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const patientTools = [
  createPatientTool,
  updatePatientTool,
  deletePatientTool,
];
