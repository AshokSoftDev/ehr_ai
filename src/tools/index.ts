/**
 * AI Tools Registry — All tools available to the LangGraph agent
 *
 * Architecture: All reads and writes go through the EHR API.
 * No raw SQL, no direct database access.
 */

import { patientTools } from './patient.tool';
import { doctorTools } from './doctor.tool';
import { appointmentTools } from './appointment.tool';
import { visitTools } from './visit.tool';
import { prescriptionTools } from './prescription.tool';
import { billingTools } from './billing.tool';
import { dashboardTools } from './dashboard.tool';
import { patientContextTools } from './patient-context.tool';

// Combine all tools
export const allTools = [
  ...patientTools,
  ...doctorTools,
  ...appointmentTools,
  ...visitTools,
  ...prescriptionTools,
  ...billingTools,
  ...dashboardTools,
  ...patientContextTools,
];

// Export individual tool groups for selective use
export {
  patientTools,
  doctorTools,
  appointmentTools,
  visitTools,
  prescriptionTools,
  billingTools,
  dashboardTools,
  patientContextTools,
};
