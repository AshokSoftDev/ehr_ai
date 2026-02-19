import { DynamicTool } from '@langchain/core/tools';
import { createApiClient, getApiErrorMessage } from '../utils/api-client';
import { getAuthToken } from './patient.tool';

/**
 * Doctor Tools - Only CREATE, UPDATE, DELETE operations via EHR API
 * For reading/searching, use the queryDatabaseTool instead
 */

// Create doctor
export const createDoctorTool = new DynamicTool({
  name: 'create_doctor',
  description: 'Create a new doctor record. Input should be a JSON object with: title, firstName, lastName, specialty, email. Optional: phone, licenseNumber, bio.',
  func: async (input: string) => {
    try {
      const token = getAuthToken();
      if (!token) return JSON.stringify({ error: 'Authentication required' });

      const doctorData = JSON.parse(input || '{}');
      const api = createApiClient(token);
      const response = await api.post('/doctors', doctorData);
      return JSON.stringify({ success: true, data: response.data, message: 'Doctor created successfully' });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

// Update doctor
export const updateDoctorTool = new DynamicTool({
  name: 'update_doctor',
  description: 'Update an existing doctor record. Input should be a JSON object with doctorId and fields to update.',
  func: async (input: string) => {
    try {
      const token = getAuthToken();
      if (!token) return JSON.stringify({ error: 'Authentication required' });

      const params = JSON.parse(input || '{}');
      if (!params.doctorId) return JSON.stringify({ error: 'doctorId is required' });
      
      const { doctorId, ...updateData } = params;
      const api = createApiClient(token);
      const response = await api.put(`/doctors/${doctorId}`, updateData);
      return JSON.stringify({ success: true, data: response.data, message: 'Doctor updated successfully' });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

// Soft delete doctor
export const deleteDoctorTool = new DynamicTool({
  name: 'delete_doctor',
  description: 'Soft delete a doctor record. Input should be a JSON object with doctorId (string/UUID).',
  func: async (input: string) => {
    try {
      const token = getAuthToken();
      if (!token) return JSON.stringify({ error: 'Authentication required' });

      const params = JSON.parse(input || '{}');
      if (!params.doctorId) return JSON.stringify({ error: 'doctorId is required' });
      
      const api = createApiClient(token);
      const response = await api.delete(`/doctors/${params.doctorId}`);
      return JSON.stringify({ success: true, data: response.data, message: 'Doctor deleted successfully' });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const doctorTools = [
  createDoctorTool,
  updateDoctorTool,
  deleteDoctorTool,
];
