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

export const searchInvoicesTool = new DynamicStructuredTool({
  name: 'search_invoices',
  description:
    'Search invoices with filters. Use for billing queries like "unpaid invoices", ' +
    '"revenue this month", "invoices for patient X". Returns paginated list.',
  schema: z.object({
    patient_id: z.number().optional().describe('Filter by patient ID'),
    visit_id: z.number().optional().describe('Filter by visit ID'),
    status: z.string().optional().describe('Invoice status: draft, sent, paid, cancelled'),
    from_date: z.string().optional().describe('From date (YYYY-MM-DD)'),
    to_date: z.string().optional().describe('To date (YYYY-MM-DD)'),
    search: z.string().optional().describe('Search term'),
    page: z.number().optional().describe('Page number (default 1)'),
    limit: z.number().optional().describe('Results per page, max 100 (default 20)'),
  }),
  func: async (input: any) => {
    try {
      const token = getToken();
      const api = createApiClient(token);
      const params: Record<string, unknown> = {};
      if (input.patient_id) params.patient_id = input.patient_id;
      if (input.visit_id) params.visit_id = input.visit_id;
      if (input.status) params.status = input.status;
      if (input.from_date) params.from_date = input.from_date;
      if (input.to_date) params.to_date = input.to_date;
      if (input.search) params.search = input.search;
      params.page = input.page || 1;
      params.limit = Math.min(input.limit || 20, 100);

      const response = await api.get('/billing/invoices', { params });
      const data = response.data?.data || response.data;
      return JSON.stringify({
        success: true,
        total: data.total || 0,
        page: data.page || 1,
        totalPages: data.totalPages || 1,
        invoices: data.invoices || data || [],
      });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const getInvoiceDetailsTool = new DynamicStructuredTool({
  name: 'get_invoice_details',
  description:
    'Get full details of a specific invoice including line items, totals, and payment status.',
  schema: z.object({
    invoiceId: z.number().describe('Invoice ID'),
  }),
  func: async (input: any) => {
    try {
      const token = getToken();
      const api = createApiClient(token);
      const response = await api.get(`/billing/invoices/${input.invoiceId}`);
      const data = response.data?.data || response.data;
      return JSON.stringify({ success: true, invoice: data });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const searchReceiptsTool = new DynamicStructuredTool({
  name: 'search_receipts',
  description:
    'Search payment receipts. Use for questions about payments received, collection summaries.',
  schema: z.object({
    patient_id: z.number().optional().describe('Filter by patient ID'),
    invoice_id: z.number().optional().describe('Filter by invoice ID'),
    payment_method: z.string().optional().describe('Filter: cash, card, upi, bank_transfer, other'),
    from_date: z.string().optional().describe('From date (YYYY-MM-DD)'),
    to_date: z.string().optional().describe('To date (YYYY-MM-DD)'),
    search: z.string().optional(),
    page: z.number().optional().describe('Page number (default 1)'),
    limit: z.number().optional().describe('Results per page, max 100 (default 20)'),
  }),
  func: async (input: any) => {
    try {
      const token = getToken();
      const api = createApiClient(token);
      const params: Record<string, unknown> = {};
      if (input.patient_id) params.patient_id = input.patient_id;
      if (input.invoice_id) params.invoice_id = input.invoice_id;
      if (input.payment_method) params.payment_method = input.payment_method;
      if (input.from_date) params.from_date = input.from_date;
      if (input.to_date) params.to_date = input.to_date;
      if (input.search) params.search = input.search;
      params.page = input.page || 1;
      params.limit = Math.min(input.limit || 20, 100);

      const response = await api.get('/billing/receipts', { params });
      const data = response.data?.data || response.data;
      return JSON.stringify({
        success: true,
        total: data.total || 0,
        receipts: data.receipts || data || [],
      });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const getReceiptDetailsTool = new DynamicStructuredTool({
  name: 'get_receipt_details',
  description: 'Get full details of a specific payment receipt.',
  schema: z.object({
    receiptId: z.number().describe('Receipt ID'),
  }),
  func: async (input: any) => {
    try {
      const token = getToken();
      const api = createApiClient(token);
      const response = await api.get(`/billing/receipts/${input.receiptId}`);
      const data = response.data?.data || response.data;
      return JSON.stringify({ success: true, receipt: data });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const getBillingVisitsTool = new DynamicStructuredTool({
  name: 'get_billing_visits',
  description:
    'Get consolidated billing visits — shows visits with invoice and receipt summaries. ' +
    'Useful for billing overview and outstanding amount queries.',
  schema: z.object({
    search: z.string().optional().describe('Search by patient name/MRN'),
    status: z.string().optional().describe('Filter by billing status'),
    page: z.number().optional().describe('Page number (default 1)'),
    limit: z.number().optional().describe('Results per page, max 100 (default 20)'),
  }),
  func: async (input: any) => {
    try {
      const token = getToken();
      const api = createApiClient(token);
      const params: Record<string, unknown> = {};
      if (input.search) params.search = input.search;
      if (input.status) params.status = input.status;
      params.page = input.page || 1;
      params.limit = Math.min(input.limit || 20, 100);

      const response = await api.get('/billing/visits', { params });
      const data = response.data?.data || response.data;
      return JSON.stringify({ success: true, data });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

// ─── WRITE TOOLS ───

export const createInvoiceTool = new DynamicStructuredTool({
  name: 'create_invoice',
  description: 'Create a new invoice for a patient visit.',
  schema: z.object({
    patient_id: z.number().describe('Patient ID'),
    visit_id: z.number().describe('Visit ID'),
    items: z
      .array(
        z.object({
          item_type: z.string().describe('Type: drug, procedure, package, custom'),
          item_name: z.string().describe('Item name'),
          quantity: z.number().optional().describe('Quantity (default 1)'),
          unit_amount: z.number().optional().describe('Unit amount (default 0)'),
          discount_type: z.string().optional().describe('Discount type: percentage or fixed (default percentage)'),
          discount_value: z.number().optional().describe('Discount value (default 0)'),
          tax_applicable: z.boolean().optional().describe('Is tax applicable (default true)'),
          notes: z.string().optional(),
        })
      )
      .describe('Invoice line items'),
    discount_type: z.string().optional().describe('Overall discount: percentage or fixed'),
    discount_value: z.number().optional().describe('Overall discount value'),
    coupon_code: z.string().optional().describe('Coupon code (e.g., CC100)'),
    notes: z.string().optional(),
  }),
  func: async (input: any) => {
    try {
      const token = getToken();
      const api = createApiClient(token);
      const response = await api.post('/billing/invoices', input);
      return JSON.stringify({
        success: true,
        message: 'Invoice created successfully',
        data: response.data,
      });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const createReceiptTool = new DynamicStructuredTool({
  name: 'create_receipt',
  description: 'Record a payment receipt against an invoice.',
  schema: z.object({
    invoice_id: z.number().describe('Invoice ID'),
    patient_id: z.number().describe('Patient ID'),
    amount: z.number().describe('Payment amount'),
    payment_method: z.string().describe('Payment method: cash, card, upi, bank_transfer, other'),
    payment_date: z.string().optional().describe('Payment date (YYYY-MM-DD)'),
    notes: z.string().optional(),
  }),
  func: async (input: any) => {
    try {
      const token = getToken();
      const api = createApiClient(token);
      const response = await api.post('/billing/receipts', input);
      return JSON.stringify({
        success: true,
        message: 'Receipt created successfully',
        data: response.data,
      });
    } catch (error) {
      return JSON.stringify({ error: getApiErrorMessage(error) });
    }
  },
});

export const billingTools = [
  searchInvoicesTool,
  getInvoiceDetailsTool,
  searchReceiptsTool,
  getReceiptDetailsTool,
  getBillingVisitsTool,
  createInvoiceTool,
  createReceiptTool,
];
