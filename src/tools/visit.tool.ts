import { DynamicTool } from '@langchain/core/tools';
import { createApiClient, getApiErrorMessage } from '../utils/api-client';
import { getAuthToken } from './patient.tool';

/**
 * Visit Tools - Only CREATE, UPDATE, DELETE operations via EHR API
 * For reading/searching, use the queryDatabaseTool instead
 */

// Create visit
export const createVisitTool = new DynamicTool({
  name: 'create_visit',
  description: 'Create a new visit record. Input should be a JSON object with: patient_id (number), doctor_id (string), visit_date (ISO date), visit_type (string). Optional: appointment_id, reason_for_visit, location_id.',
  func: async (input: string) => {
    try {
      const token = getAuthToken();
      if (!token) return JSON.stringify({ error: 'Authentication required' });

      const visitData = JSON.parse(input || '{}');
      const api = createApiClient(token);
      const response = await api.post('/visits', visitData);
      return JSON.stringify({ success: true, data: response.data, message: 'Visit created successfully' });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

// Update visit
export const updateVisitTool = new DynamicTool({
  name: 'update_visit',
  description: 'Update an existing visit record. Input should be a JSON object with visitId and fields to update.',
  func: async (input: string) => {
    try {
      const token = getAuthToken();
      if (!token) return JSON.stringify({ error: 'Authentication required' });

      const params = JSON.parse(input || '{}');
      if (!params.visitId) return JSON.stringify({ error: 'visitId is required' });
      
      const { visitId, ...updateData } = params;
      const api = createApiClient(token);
      const response = await api.put(`/visits/${visitId}`, updateData);
      return JSON.stringify({ success: true, data: response.data, message: 'Visit updated successfully' });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

// Soft delete visit
export const deleteVisitTool = new DynamicTool({
  name: 'delete_visit',
  description: 'Soft delete a visit record. Input should be a JSON object with visitId (number).',
  func: async (input: string) => {
    try {
      const token = getAuthToken();
      if (!token) return JSON.stringify({ error: 'Authentication required' });

      const params = JSON.parse(input || '{}');
      if (!params.visitId) return JSON.stringify({ error: 'visitId is required' });
      
      const api = createApiClient(token);
      const response = await api.delete(`/visits/${params.visitId}`);
      return JSON.stringify({ success: true, data: response.data, message: 'Visit deleted successfully' });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const visitTools = [
  createVisitTool,
  updateVisitTool,
  deleteVisitTool,
];
