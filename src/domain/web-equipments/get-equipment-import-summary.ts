/**
 * US-102 — Consultar resumo de importação de equipamento.
 * Endpoint: GET /v1.0/equipments/files/{id}/summary (não depreciado,
 * oauth2Password/GetrakWeb — token delegado). Mesma família de dados de
 * `get_equipment_import_items` (US-101) — resumo agregado em vez do
 * detalhamento linha a linha; mesma avaliação de utilidade real (ver
 * comentário de `search-equipment-import-requests.ts`).
 *
 * Confirmado contra chamada real em homologação nesta rodada:
 *   - Id existente (`126`): HTTP 200, `{total: 4, failures: 2,
 *     success: 2}` — consistente com o total de itens observado em
 *     `get_equipment_import_items` para o mesmo id.
 *   - Id inexistente (`999999`): HTTP 404 limpo, `{"error":"Import not
 *     found"}` (mensagem ligeiramente diferente da de
 *     `get_equipment_import_items`, `"Equipment import not found"` — mas
 *     ambas mapeadas para o mesmo código de domínio, já que o texto exato
 *     nunca é repassado ao consumidor).
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { callGetrakWebEndpoint, centralSchema, normalizeItem, type WebEquipmentsToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/equipments/files/{id}/summary";

export const getEquipmentImportSummaryInputSchema = z.object({
  central: centralSchema,
  id: z.number().int().positive(),
});

export type GetEquipmentImportSummaryInput = z.infer<typeof getEquipmentImportSummaryInputSchema>;

export interface GetEquipmentImportSummaryData {
  summary: Record<string, unknown>;
}

export function createGetEquipmentImportSummaryTool(
  deps: WebEquipmentsToolDeps,
): DomainToolRegistration<GetEquipmentImportSummaryInput, GetEquipmentImportSummaryData> {
  const definition: ToolDefinition<GetEquipmentImportSummaryInput, GetEquipmentImportSummaryData> = {
    name: "get_equipment_import_summary",
    risk: "low",
    requiresCentral: true,
    inputSchema: getEquipmentImportSummaryInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callGetrakWebEndpoint<Record<string, unknown>>({
        deps,
        path: `/v1.0/equipments/files/${input.id}/summary`,
        query: {},
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
        notFoundCode: "EQUIPMENT_IMPORT_NOT_FOUND",
      });

      return {
        data: { summary: normalizeItem(raw) },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_equipment_import_summary",
      description: "Get the aggregated success/failure counts of a specific bulk equipment import job within an authorized central.",
      intent: "read",
      domain: "web_equipments",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
