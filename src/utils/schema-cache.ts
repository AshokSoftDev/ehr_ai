import { pgQuery } from './pg-client';

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

interface TableSchema {
  tableName: string;
  columns: ColumnInfo[];
  displayColumns: string[];  // Columns safe to show in responses
  statusColumn: string | null;  // Column to filter active records
}

// Cached schema
let schemaCache: TableSchema[] | null = null;

// Columns to NEVER show in AI responses (IDs, audit fields)
const HIDDEN_COLUMNS = [
  // Primary/Foreign key IDs
  'patient_id', 'doctor_id', 'visit_id', 'appointment_id', 'prescription_id',
  'id', 'user_id', 'group_id', 'module_id', 'location_id', 'drug_id',
  'allergy_id', 'clinical_note_id', 'invoice_id', 'receipt_id', 'document_id',
  // Audit fields
  'createdAt', 'createdBy', 'updatedAt', 'updatedBy',
  'created_at', 'created_by', 'updated_at', 'updated_by',
  // Other internal fields
  'password', 'passwordHash', 'salt', 'refreshToken', 'token',
];

// Status columns to identify for filtering
const STATUS_COLUMNS = ['status', 'activeStatus', 'active_status', 'isActive', 'is_active', 'active'];

/**
 * Check if a column should be hidden from AI
 */
function isHiddenColumn(columnName: string): boolean {
  const lowerName = columnName.toLowerCase();
  // Hide if it's in the explicit list
  if (HIDDEN_COLUMNS.some(h => h.toLowerCase() === lowerName)) {
    return true;
  }
  // Hide if it ends with _id (except mrn which looks like an ID but isn't)
  if (lowerName.endsWith('_id') && lowerName !== 'mrn') {
    return true;
  }
  // Hide if it's a UUID column (contains 'uuid' or is typically a FK)
  return false;
}

/**
 * Load database schema and cache it
 */
export async function loadSchemaCache(): Promise<TableSchema[]> {
  if (schemaCache) {
    return schemaCache;
  }

  try {
    // Get all tables
    const tablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    const tablesResult = await pgQuery(tablesQuery);
    
    // Get columns for each table
    const schema: TableSchema[] = [];
    
    for (const table of tablesResult.rows) {
      const tableName = (table as { table_name: string }).table_name;
      
      const columnsQuery = `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = $1
        ORDER BY ordinal_position;
      `;
      const columnsResult = await pgQuery(columnsQuery, [tableName]);
      const columns = columnsResult.rows as ColumnInfo[];
      
      // Filter columns to only show safe ones
      const displayColumns = columns
        .filter(c => !isHiddenColumn(c.column_name))
        .map(c => c.column_name);
      
      // Find status column for this table
      const statusColumn = columns.find(c => 
        STATUS_COLUMNS.includes(c.column_name)
      )?.column_name || null;
      
      schema.push({
        tableName,
        columns,
        displayColumns,
        statusColumn,
      });
    }
    
    schemaCache = schema;
    console.log(`[Schema] Loaded ${schema.length} tables`);
    return schema;
  } catch (error) {
    console.error('[Schema] Failed to load:', error);
    return [];
  }
}

/**
 * Get cached schema
 */
export function getSchemaCache(): TableSchema[] | null {
  return schemaCache;
}

/**
 * Format schema for AI prompt - only show display columns
 */
export function formatSchemaForPrompt(schema: TableSchema[]): string {
  if (!schema.length) {
    return 'Schema not available.';
  }

  const lines: string[] = [
    '## DATABASE SCHEMA (only showing columns safe to display):',
    '',
    '**IMPORTANT: Only use these columns in SELECT. Never select or display ID columns!**',
    ''
  ];
  
  for (const table of schema) {
    if (table.displayColumns.length === 0) continue;
    
    const columnNames = table.displayColumns.map(c => `"${c}"`).join(', ');
    const statusNote = table.statusColumn ? ` | Filter: "${table.statusColumn}" = 1` : '';
    
    lines.push(`### "${table.tableName}"${statusNote}`);
    lines.push(`Columns: ${columnNames}`);
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Get list of hidden columns
 */
export function getHiddenColumns(): string[] {
  return HIDDEN_COLUMNS;
}

/**
 * Clear schema cache (useful for refresh)
 */
export function clearSchemaCache(): void {
  schemaCache = null;
}
