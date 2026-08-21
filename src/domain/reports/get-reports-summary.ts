/**
 * US-050 — Consultar resumo de relatórios.
 * Endpoint: GET /v1.0/report/reports/summary (não depreciado,
 * oauth2Password/GetrakWeb — token delegado).
 *
 * Confirmado contra chamada real em homologação nesta rodada:
 *   - Funciona sem nenhum parâmetro — retorna a agregação sobre todo o
 *     histórico disponível (`{reports: {individual, scheduled}, schedules}`),
 *     diferente de `search_reports` (US-049), que exige `page`/`per_page`
 *     juntos sob pena de HTTP 500 (ver `search-reports.ts`). Não há
 *     paginação neste endpoint — resposta é um único objeto agregado.
 *   - `filters[report_type][notin]` (documentado, opcional) FUNCIONA e
 *     tem efeito real mensurável: sem filtro, `{individual: 454, scheduled:
 *     769}`; excluindo `km_traveled`, `{individual: 448, scheduled: 695}`;
 *     excluindo `speed`, `{individual: 355, scheduled: 607}` — reduções
 *     reais e distintas por tipo, confirmando que o filtro é aplicado de
 *     fato (não um no-op). O valor de exemplo do próprio openapi.json
 *     (`filters[report_type][notin]=individual`) é um exemplo pouco feliz
 *     da documentação — `individual` não é um `report_type` real (é uma
 *     categoria do objeto de resposta `reports.individual`), por isso não
 *     tem efeito nenhum quando usado como valor do filtro; não é um bug do
 *     endpoint, só um mau exemplo de documentação, registrado aqui para não
 *     ser confundido com um achado de comportamento quebrado.
 *   - Mesmo padrão de wire do Epic 13 (ver `search-reports.ts`): múltiplos
 *     valores exigem repetir a chave de query **sem** sufixo `[]`
 *     (`filters[report_type][notin][]=...` é silenciosamente ignorado,
 *     retornando os números não filtrados).
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { callGetrakWebEndpoint, centralSchema, normalizeItem, type ReportsToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/report/reports/summary";

export const getReportsSummaryInputSchema = z.object({
  central: centralSchema,
  exclude_report_types: z.array(z.string().min(1)).optional(),
});

export type GetReportsSummaryInput = z.infer<typeof getReportsSummaryInputSchema>;

export interface GetReportsSummaryData {
  summary: Record<string, unknown>;
}

export function createGetReportsSummaryTool(
  deps: ReportsToolDeps,
): DomainToolRegistration<GetReportsSummaryInput, GetReportsSummaryData> {
  const definition: ToolDefinition<GetReportsSummaryInput, GetReportsSummaryData> = {
    name: "get_reports_summary",
    risk: "low",
    requiresCentral: true,
    inputSchema: getReportsSummaryInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callGetrakWebEndpoint<Record<string, unknown>>({
        deps,
        path: "/v1.0/report/reports/summary",
        query: {
          "filters[report_type][notin]": input.exclude_report_types,
        },
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
      });

      const summary = normalizeItem(raw && typeof raw === "object" ? raw : {});

      return {
        data: { summary },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_reports_summary",
      description: "Get aggregated counts of generated reports and active schedules for an authorized central.",
      intent: "read",
      domain: "reports",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
