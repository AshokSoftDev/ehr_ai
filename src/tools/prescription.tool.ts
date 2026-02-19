import { DynamicTool } from '@langchain/core/tools';
import { createApiClient, getApiErrorMessage } from '../utils/api-client';
import { getAuthToken } from './patient.tool';

/**
 * Prescription Tools - Only CREATE, UPDATE, DELETE operations via EHR API
 * For reading/searching, use the queryDatabaseTool instead
 */

// Create prescription
export const createPrescriptionTool = new DynamicTool({
  name: 'create_prescription',
  description: 'Create a new prescription. Input should be a JSON object with: visit_id (number), patient_id (number), drug_name (string). Optional: appointment_id, doctor_id, drug_id, drug_generic, drug_type, drug_dosage, drug_measure, instruction, duration, duration_type, quantity, morning_bf, morning_af, noon_bf, noon_af, evening_bf, evening_af, night_bf, night_af, notes.',
  func: async (input: string) => {
    try {
      const token = getAuthToken();
      if (!token) return JSON.stringify({ error: 'Authentication required' });

      const prescriptionData = JSON.parse(input || '{}');
      const api = createApiClient(token);
      const response = await api.post('/visits/prescriptions', prescriptionData);
      return JSON.stringify({ success: true, data: response.data, message: 'Prescription created successfully' });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

// Update prescription
export const updatePrescriptionTool = new DynamicTool({
  name: 'update_prescription',
  description: 'Update an existing prescription. Input should be a JSON object with prescriptionId and fields to update.',
  func: async (input: string) => {
    try {
      const token = getAuthToken();
      if (!token) return JSON.stringify({ error: 'Authentication required' });

      const params = JSON.parse(input || '{}');
      if (!params.prescriptionId) return JSON.stringify({ error: 'prescriptionId is required' });
      
      const { prescriptionId, ...updateData } = params;
      const api = createApiClient(token);
      const response = await api.put(`/visits/prescriptions/${prescriptionId}`, updateData);
      return JSON.stringify({ success: true, data: response.data, message: 'Prescription updated successfully' });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

// Soft delete prescription
export const deletePrescriptionTool = new DynamicTool({
  name: 'delete_prescription',
  description: 'Soft delete a prescription. Input should be a JSON object with prescriptionId (number).',
  func: async (input: string) => {
    try {
      const token = getAuthToken();
      if (!token) return JSON.stringify({ error: 'Authentication required' });

      const params = JSON.parse(input || '{}');
      if (!params.prescriptionId) return JSON.stringify({ error: 'prescriptionId is required' });
      
      const api = createApiClient(token);
      const response = await api.delete(`/visits/prescriptions/${params.prescriptionId}`);
      return JSON.stringify({ success: true, data: response.data, message: 'Prescription deleted successfully' });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const prescriptionTools = [
  createPrescriptionTool,
  updatePrescriptionTool,
  deletePrescriptionTool,
];
