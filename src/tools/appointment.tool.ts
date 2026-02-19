import { DynamicTool } from '@langchain/core/tools';
import { createApiClient, getApiErrorMessage } from '../utils/api-client';
import { getAuthToken } from './patient.tool';

/**
 * Appointment Tools - Only CREATE, UPDATE, DELETE operations via EHR API
 * For reading/searching, use the queryDatabaseTool instead
 */

// Create appointment
export const createAppointmentTool = new DynamicTool({
  name: 'create_appointment',
  description: 'Create a new appointment. Input should be a JSON object with: patient_id (number), doctor_id (string), appointment_date (ISO date), start_time (ISO datetime), end_time (ISO datetime), appointment_type (string). Optional: duration, reason_for_visit, appointment_status, notes.',
  func: async (input: string) => {
    try {
      const token = getAuthToken();
      if (!token) return JSON.stringify({ error: 'Authentication required' });

      const appointmentData = JSON.parse(input || '{}');
      const api = createApiClient(token);
      const response = await api.post('/appointments', appointmentData);
      return JSON.stringify({ success: true, data: response.data, message: 'Appointment created successfully' });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

// Update appointment
export const updateAppointmentTool = new DynamicTool({
  name: 'update_appointment',
  description: 'Update an existing appointment. Input should be a JSON object with appointmentId and fields to update.',
  func: async (input: string) => {
    try {
      const token = getAuthToken();
      if (!token) return JSON.stringify({ error: 'Authentication required' });

      const params = JSON.parse(input || '{}');
      if (!params.appointmentId) return JSON.stringify({ error: 'appointmentId is required' });
      
      const { appointmentId, ...updateData } = params;
      const api = createApiClient(token);
      const response = await api.put(`/appointments/${appointmentId}`, updateData);
      return JSON.stringify({ success: true, data: response.data, message: 'Appointment updated successfully' });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

// Cancel/Soft delete appointment
export const deleteAppointmentTool = new DynamicTool({
  name: 'delete_appointment',
  description: 'Cancel/soft delete an appointment. Input should be a JSON object with appointmentId (number).',
  func: async (input: string) => {
    try {
      const token = getAuthToken();
      if (!token) return JSON.stringify({ error: 'Authentication required' });

      const params = JSON.parse(input || '{}');
      if (!params.appointmentId) return JSON.stringify({ error: 'appointmentId is required' });
      
      const api = createApiClient(token);
      const response = await api.delete(`/appointments/${params.appointmentId}`);
      return JSON.stringify({ success: true, data: response.data, message: 'Appointment cancelled successfully' });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const appointmentTools = [
  createAppointmentTool,
  updateAppointmentTool,
  deleteAppointmentTool,
];
