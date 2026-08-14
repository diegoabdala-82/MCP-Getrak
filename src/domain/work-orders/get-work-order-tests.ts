/**
 * US-023 — Consultar testes de uma ordem de serviço.
 * Endpoint: GET /v1.0/installers/work-orders/{workOrderId}/tests (v1.0,
 * vigente). Confirmado contra reference/openapi.json: `workOrderId` path
 * param obrigatório; paginação nativa `page`/`per_page` (mesmo nome do
 * padrão MCP — tradução direta, como em US-018); resposta paginada real
 * `{data: [...], page, pages, total}`, permitindo `total_items`/`has_more`
 * exatos.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { normalizePagination, type PaginationMeta } from "../../foundation/pagination/pagination.js";
import {
  callWorkOrdersEndpoint,
  centralSchema,
  normalizeItem,
  paginationInputShape,
  type WorkOrdersToolDeps,
} from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/installers/work-orders/{workOrderId}/tests";

export const getWorkOrderTestsInputSchema = z.object({
  central: centralSchema,
  work_order_id: z.string().min(1, "work_order_id is required"),
  ...paginationInputShape,
});

export type GetWorkOrderTestsInput = z.infer<typeof getWorkOrderTestsInputSchema>;

export interface GetWorkOrderTestsData {
  tests: Record<string, unknown>[];
  pagination: PaginationMeta;
}

interface RawWorkOrderTestsResponse {
  data?: Record<string, unknown>[];
  page?: number;
  pages?: number;
  total?: number;
}

export function createGetWorkOrderTestsTool(
  deps: WorkOrdersToolDeps,
): DomainToolRegistration<GetWorkOrderTestsInput, GetWorkOrderTestsData> {
  const definition: ToolDefinition<GetWorkOrderTestsInput, GetWorkOrderTestsData> = {
    name: "get_work_order_tests",
    risk: "low",
    requiresCentral: true,
    inputSchema: getWorkOrderTestsInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const { page, page_size } = normalizePagination(input);

      const raw = await callWorkOrdersEndpoint<RawWorkOrderTestsResponse>({
        apiCoreClient: deps.apiCoreClient,
        path: `/v1.0/installers/work-orders/${encodeURIComponent(input.work_order_id)}/tests`,
        query: { page, per_page: page_size },
        environment: ctx.environment,
        central: input.central,
        notFoundCode: "WORK_ORDER_NOT_FOUND",
      });

      const tests = (raw.data ?? []).map(normalizeItem);

      return {
        data: {
          tests,
          pagination: {
            page: raw.page ?? page,
            page_size,
            total_items: raw.total ?? null,
            has_more: raw.page !== undefined && raw.pages !== undefined ? raw.page < raw.pages : null,
          },
        },
        endpoints: [SOURCE_ENDPOINT],
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_work_order_tests",
      description: "Get the tests associated with a work order.",
      intent: "read",
      domain: "work_orders",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
