/**
 * US-022 — Consultar detalhes de uma ordem de serviço.
 * Endpoint: GET /v1.0/installers/work-orders/{workOrderId} (v1.0, vigente —
 * o legado GET /v0.1/instalador/central/ordem-servico/{workOrderId}/detalhes
 * está depreciado e não deve ser usado). Confirmado contra
 * reference/openapi.json: `workOrderId` é path param obrigatório (integer);
 * `fields[]`/`include[]` existem mas não fazem parte do contrato desta
 * spec ("entrada: workOrderId" apenas) — não expostos. Resposta:
 * `{data: {...detalhes da ordem...}}` (chave `data` própria do endpoint,
 * distinta do envelope `data` do MCP — desembrulhada aqui).
 *
 * Sem parâmetro de central na URL (mesmo padrão de lookup por identificador
 * específico já visto em get_vehicle_category/get_equipment_bench_position)
 * — `workOrderId` sozinho identifica a ordem de forma inequívoca.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { callWorkOrdersEndpoint, centralSchema, normalizeItem, type WorkOrdersToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/installers/work-orders/{workOrderId}";

export const getWorkOrderDetailsInputSchema = z.object({
  central: centralSchema,
  work_order_id: z.string().min(1, "work_order_id is required"),
});

export type GetWorkOrderDetailsInput = z.infer<typeof getWorkOrderDetailsInputSchema>;

export interface GetWorkOrderDetailsData {
  work_order: Record<string, unknown> | null;
}

interface RawWorkOrderDetailsResponse {
  data?: Record<string, unknown> | null;
}

export function createGetWorkOrderDetailsTool(
  deps: WorkOrdersToolDeps,
): DomainToolRegistration<GetWorkOrderDetailsInput, GetWorkOrderDetailsData> {
  const definition: ToolDefinition<GetWorkOrderDetailsInput, GetWorkOrderDetailsData> = {
    name: "get_work_order_details",
    risk: "low",
    requiresCentral: true,
    inputSchema: getWorkOrderDetailsInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callWorkOrdersEndpoint<RawWorkOrderDetailsResponse>({
        apiCoreClient: deps.apiCoreClient,
        path: `/v1.0/installers/work-orders/${encodeURIComponent(input.work_order_id)}`,
        query: {},
        environment: ctx.environment,
        central: input.central,
        notFoundCode: "WORK_ORDER_NOT_FOUND",
      });

      const work_order = raw.data && typeof raw.data === "object" ? normalizeItem(raw.data) : null;

      return {
        data: { work_order },
        endpoints: [SOURCE_ENDPOINT],
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_work_order_details",
      description: "Get the details of a work order.",
      intent: "read",
      domain: "work_orders",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
