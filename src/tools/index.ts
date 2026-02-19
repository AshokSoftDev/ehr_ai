// Export all tools
import { patientTools, setAuthToken, getAuthToken } from './patient.tool';
import { doctorTools } from './doctor.tool';
import { appointmentTools } from './appointment.tool';
import { visitTools } from './visit.tool';
import { prescriptionTools } from './prescription.tool';
import { databaseTools } from './database.tool';

export const allTools = [
  ...patientTools,
  ...doctorTools,
  ...appointmentTools,
  ...visitTools,
  ...prescriptionTools,
  ...databaseTools,
];

// Re-export auth token functions
export { setAuthToken, getAuthToken };

// Re-export individual tool arrays
export { patientTools } from './patient.tool';
export { doctorTools } from './doctor.tool';
export { appointmentTools } from './appointment.tool';
export { visitTools } from './visit.tool';
export { prescriptionTools } from './prescription.tool';
export { databaseTools } from './database.tool';
