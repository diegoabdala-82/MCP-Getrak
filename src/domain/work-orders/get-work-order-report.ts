/**
 * US-025 — Consultar relatório de uma ordem de serviço.
 * Endpoint: GET /v0.1/instalador/central/{central}/ordem-servico/{workOrderId}/relatorio
 * (v0.1, vigente — confirmado pela Engenharia, sem equivalente v1.0; não
 * assumir depreciação pelo número de versão, CLAUDE.md Seção 7). Confirmado
 * contra reference/openapi.json: `central` e `workOrderId` são AMBOS
 * parâmetros de PATH obrigatórios — diferente das outras 3 tools deste
 * domínio, aqui `central` é enviado explicitamente na URL, exatamente como
 * a spec de US-025 já indicava ("entrada: central, workOrderId"). Resposta:
 * objeto composto `{device, installerUser, tests, vehicle, workOrder}`, sem
 * chave `data` própria (diferente de US-022) — mais uma inconsistência de
 * resposta entre endpoints irmãos.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { callWorkOrdersEndpoint, centralSchema, normalizeItem, type WorkOrdersToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /v0.1/instalador/central/{central}/ordem-servico/{workOrderId}/relatorio";

export const getWorkOrderReportInputSchema = z.object({
  central: centralSchema,
  work_order_id: z.string().min(1, "work_order_id is required"),
});

export type GetWorkOrderReportInput = z.infer<typeof getWorkOrderReportInputSchema>;

export interface GetWorkOrderReportData {
  report: Record<string, unknown> | null;
}

export function createGetWorkOrderReportTool(
  deps: WorkOrdersToolDeps,
): DomainToolRegistration<GetWorkOrderReportInput, GetWorkOrderReportData> {
  const definition: ToolDefinition<GetWorkOrderReportInput, GetWorkOrderReportData> = {
    name: "get_work_order_report",
    risk: "low",
    requiresCentral: true,
    inputSchema: getWorkOrderReportInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const path =
        `/v0.1/instalador/central/${encodeURIComponent(input.central)}` +
        `/ordem-servico/${encodeURIComponent(input.work_order_id)}/relatorio`;

      const raw = await callWorkOrdersEndpoint<unknown>({
        apiCoreClient: deps.apiCoreClient,
        path,
        query: {},
        environment: ctx.environment,
        central: input.central,
        notFoundCode: "WORK_ORDER_NOT_FOUND",
      });

      const report = raw && typeof raw === "object" ? normalizeItem(raw as Record<string, unknown>) : null;

      return {
        data: { report },
        endpoints: [SOURCE_ENDPOINT],
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_work_order_report",
      description: "Get the consolidated report of a work order.",
      intent: "read",
      domain: "work_orders",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
