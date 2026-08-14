/**
 * US-024 — Consultar definição de testes de uma ordem de serviço.
 * Endpoint: GET /v1.0/installers/work-orders/{workOrderId}/tests-definition
 * (v1.0, vigente). Confirmado contra reference/openapi.json: `workOrderId`
 * é o único parâmetro (path, obrigatório); sem paginação nativa (não
 * documentada); resposta é um array plano de
 * `{id, work_order_id, test_definition_id, required, status, created_at,
 * updated_at}`.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { callWorkOrdersEndpoint, centralSchema, normalizeItem, type WorkOrdersToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/installers/work-orders/{workOrderId}/tests-definition";

export const getWorkOrderTestsDefinitionInputSchema = z.object({
  central: centralSchema,
  work_order_id: z.string().min(1, "work_order_id is required"),
});

export type GetWorkOrderTestsDefinitionInput = z.infer<typeof getWorkOrderTestsDefinitionInputSchema>;

export interface GetWorkOrderTestsDefinitionData {
  tests_definition: Record<string, unknown>[];
}

export function createGetWorkOrderTestsDefinitionTool(
  deps: WorkOrdersToolDeps,
): DomainToolRegistration<GetWorkOrderTestsDefinitionInput, GetWorkOrderTestsDefinitionData> {
  const definition: ToolDefinition<GetWorkOrderTestsDefinitionInput, GetWorkOrderTestsDefinitionData> = {
    name: "get_work_order_tests_definition",
    risk: "low",
    requiresCentral: true,
    inputSchema: getWorkOrderTestsDefinitionInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callWorkOrdersEndpoint<unknown>({
        apiCoreClient: deps.apiCoreClient,
        path: `/v1.0/installers/work-orders/${encodeURIComponent(input.work_order_id)}/tests-definition`,
        query: {},
        environment: ctx.environment,
        central: input.central,
        notFoundCode: "WORK_ORDER_NOT_FOUND",
      });

      const tests_definition = (Array.isArray(raw) ? (raw as Record<string, unknown>[]) : []).map(normalizeItem);

      return {
        data: { tests_definition },
        endpoints: [SOURCE_ENDPOINT],
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_work_order_tests_definition",
      description: "Get the expected test definition for a work order.",
      intent: "read",
      domain: "work_orders",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
