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

export const getVisitPrescriptionsTool = new DynamicStructuredTool({
  name: 'get_visit_prescriptions',
  description:
    'Get all prescriptions for a specific visit. Use after searching visits to get medication details.',
  schema: z.object({
    visitId: z.number().describe('The visit ID to get prescriptions for'),
  }),
  func: async (input: any) => {
    try {
      const token = getToken();
      const api = createApiClient(token);
      const response = await api.get(`/visits/${input.visitId}/prescriptions`);
      const data = response.data?.data || response.data;
      return JSON.stringify({
        success: true,
        prescriptions: Array.isArray(data) ? data : data.prescriptions || [],
      });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

// ─── WRITE TOOLS ───

export const createPrescriptionTool = new DynamicStructuredTool({
  name: 'create_prescription',
  description:
    'Create a new prescription for a visit. Requires visit_id and drug_name at minimum.',
  schema: z.object({
    visit_id: z.number().describe('Visit ID'),
    drug_name: z.string().describe('Drug/medication name'),
    drug_generic: z.string().optional().describe('Generic name'),
    drug_type: z.string().optional().describe('Drug type'),
    drug_dosage: z.string().optional().describe('Dosage'),
    drug_measure: z.string().optional().describe('Measure unit'),
    instruction: z.string().optional().describe('Instructions'),
    duration: z.number().optional().describe('Duration number'),
    duration_type: z.string().optional().describe('Duration type (days, weeks, months)'),
    quantity: z.number().optional().describe('Quantity'),
    notes: z.string().optional().describe('Notes'),
  }),
  func: async (input: any) => {
    try {
      const token = getToken();
      const api = createApiClient(token);
      const response = await api.post(`/visits/${input.visit_id}/prescriptions`, input);
      return JSON.stringify({
        success: true,
        message: 'Prescription created successfully',
        data: response.data,
      });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const updatePrescriptionTool = new DynamicStructuredTool({
  name: 'update_prescription',
  description: 'Update an existing prescription.',
  schema: z.object({
    visitId: z.number().describe('Visit ID'),
    prescriptionId: z.number().describe('Prescription ID'),
    drug_name: z.string().optional(),
    drug_dosage: z.string().optional(),
    instruction: z.string().optional(),
    duration: z.number().optional(),
    duration_type: z.string().optional(),
    quantity: z.number().optional(),
    notes: z.string().optional(),
  }),
  func: async (input: any) => {
    try {
      const token = getToken();
      const { visitId, prescriptionId, ...updateData } = input;
      const api = createApiClient(token);
      const response = await api.put(
        `/visits/${visitId}/prescriptions/${prescriptionId}`,
        updateData
      );
      return JSON.stringify({
        success: true,
        message: 'Prescription updated successfully',
        data: response.data,
      });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const deletePrescriptionTool = new DynamicStructuredTool({
  name: 'delete_prescription',
  description: 'Soft delete a prescription.',
  schema: z.object({
    visitId: z.number().describe('Visit ID'),
    prescriptionId: z.number().describe('Prescription ID'),
  }),
  func: async (input: any) => {
    try {
      const token = getToken();
      const api = createApiClient(token);
      const response = await api.delete(
        `/visits/${input.visitId}/prescriptions/${input.prescriptionId}`
      );
      return JSON.stringify({
        success: true,
        message: 'Prescription deleted successfully',
        data: response.data,
      });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const prescriptionTools = [
  getVisitPrescriptionsTool,
  createPrescriptionTool,
  updatePrescriptionTool,
  deletePrescriptionTool,
];
