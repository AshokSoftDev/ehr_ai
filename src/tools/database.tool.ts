import { DynamicTool } from '@langchain/core/tools';
import { pgQuery, closePgPool } from '../utils/pg-client';

/**
 * Database Tools - Schema introspection and read-only queries
 */

// List all tables
export const listTablesTool = new DynamicTool({
  name: 'list_database_tables',
  description: 'List all tables in the database. Input should be an empty JSON object {}.',
  func: async () => {
    try {
      const query = `
        SELECT table_name, table_type
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `;
      const result = await pgQuery(query);
      return JSON.stringify({
        success: true,
        tables: result.rows.map((r: { table_name: string }) => r.table_name),
        count: result.rowCount,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Database query failed';
      return JSON.stringify({ error: message });
    }
  },
});

// Get table schema
export const getTableSchemaTool = new DynamicTool({
  name: 'get_table_schema',
  description: 'Get the schema (columns and relationships) of a specific table. Input should be a JSON object with tableName (string).',
  func: async (input: string) => {
    try {
      const params = JSON.parse(input || '{}');
      if (!params.tableName) return JSON.stringify({ error: 'tableName is required' });
      
      // Get columns
      const columnsQuery = `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = $1
        ORDER BY ordinal_position;
      `;
      const columnsResult = await pgQuery(columnsQuery, [params.tableName]);

      // Get foreign keys
      const fkQuery = `
        SELECT
          kcu.column_name as column,
          ccu.table_name AS foreign_table,
          ccu.column_name AS foreign_column
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = $1;
      `;
      const fkResult = await pgQuery(fkQuery, [params.tableName]);

      return JSON.stringify({
        success: true,
        table: params.tableName,
        columns: columnsResult.rows,
        foreignKeys: fkResult.rows,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Schema query failed';
      return JSON.stringify({ error: message });
    }
  },
});

// Execute read-only query
export const queryDatabaseTool = new DynamicTool({
  name: 'query_database',
  description: 'Execute a read-only SELECT query on the database. Input can be either a plain SQL query string OR a JSON object with "query" field. Examples: SELECT * FROM "Patient" WHERE "firstName" ILIKE \'%john%\' LIMIT 10',
  func: async (input: string) => {
    try {
      // Try to parse as JSON first, otherwise treat as raw SQL
      let sqlQuery: string;
      let limit = 50;
      
      try {
        const params = JSON.parse(input);
        sqlQuery = params.query || input;
        limit = params.limit || 50;
      } catch {
        // Input is plain SQL string
        sqlQuery = input;
      }
      
      if (!sqlQuery || !sqlQuery.trim()) {
        return JSON.stringify({ error: 'Query is required. Please provide a SQL SELECT query.' });
      }
      
      // Safety checks
      const queryUpper = sqlQuery.toUpperCase().trim();
      const dangerousKeywords = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE', 'GRANT', 'REVOKE'];
      
      for (const keyword of dangerousKeywords) {
        if (queryUpper.includes(keyword)) {
          return JSON.stringify({ 
            error: `Query contains forbidden keyword: ${keyword}. Only SELECT queries are allowed.` 
          });
        }
      }

      if (!queryUpper.startsWith('SELECT')) {
        return JSON.stringify({ error: 'Only SELECT queries are allowed. Query must start with SELECT.' });
      }

      // Add LIMIT if not present
      let safeQuery = sqlQuery;
      if (!queryUpper.includes('LIMIT')) {
        safeQuery = `${sqlQuery} LIMIT ${limit}`;
      }

      console.log('[DB Query]:', safeQuery); // Debug logging
      
      const result = await pgQuery(safeQuery);
      return JSON.stringify({
        success: true,
        rowCount: result.rowCount,
        data: result.rows,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Query execution failed';
      console.error('[DB Error]:', message); // Debug logging
      return JSON.stringify({ 
        success: false, 
        error: message,
        hint: 'Check table/column names. Tables are PascalCase with double quotes: "Patient", "Doctor"'
      });
    }
  },
});

// Cleanup function
export const cleanupDatabase = async () => {
  await closePgPool();
};

export const databaseTools = [
  listTablesTool,
  getTableSchemaTool,
  queryDatabaseTool,
];
