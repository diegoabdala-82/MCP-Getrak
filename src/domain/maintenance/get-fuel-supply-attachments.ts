/**
 * US-054 — Consultar anexos de abastecimento.
 * Endpoint: GET /v2.0/maintenance/fuel-supply/{id}/attachments (não
 * depreciado, oauth2Password/GetrakWeb — token delegado).
 *
 * DECISÃO REGISTRADA — tool separada de `get_fuel_supply_details`
 * (US-053), NÃO bundled, conforme instruído pela tarefa a avaliar antes de
 * codificar. Racional, baseado em evidência empírica coletada antes de
 * decidir (não uma preferência a priori):
 *   1. **Não existe mecanismo de `include[]` (ou equivalente) no endpoint
 *      de detalhe para trazer anexos embutidos.** Testado explicitamente:
 *      `GET /v2.0/maintenance/fuel-supply/{id}` não aceita nenhum
 *      parâmetro de request documentado além do `id` no path, e o
 *      endpoint irmão de manutenções (`.../maintenances/{id}`) — que TEM
 *      um `include[]` funcional para outras relações (`last_execution`,
 *      `services`) — não reconhece `include[]=attachments` (testado:
 *      resposta idêntica com ou sem esse parâmetro). Ou seja, bundlar
 *      exigiria uma segunda chamada HTTP interna sempre, escondida do
 *      consumidor, não uma composição nativa da API Core.
 *   2. **Anexos são um recurso conceitualmente distinto, com seu próprio
 *      ciclo de vida** — cada item tem `status` (`completed`/`failed`/
 *      `pending_upload`) e uma `file_url` **pré-assinada com expiração
 *      curta** (`expires_at` ~1h após `created_at`, confirmado no exemplo
 *      do openapi.json). Embutir isso sempre na resposta de detalhe
 *      obrigaria toda chamada de `get_fuel_supply_details` a pagar o
 *      custo de uma segunda consulta e devolver links que podem expirar
 *      antes de serem usados, mesmo quando o consumidor não pediu anexos.
 *   3. **Consistente com o padrão já estabelecido no restante do
 *      projeto** para pares detalhe+drill-down relacionado: sempre tools
 *      separadas, nunca embutidas (US-065/US-066 no Epic 15, US-101/
 *      US-102 no Epic 21, `get_equipment_tag_details` vs. `search_
 *      equipment_tags` no Epic 21). Bundlar aqui seria a primeira exceção
 *      a esse padrão em todo o projeto, sem um motivo técnico forte o
 *      suficiente (a API não oferece nenhuma forma nativa de compor os
 *      dois).
 *
 * Confirmado contra chamada real em homologação nesta rodada:
 *   - Id existente sem anexos: HTTP 200, `{"data": []}` — lista vazia
 *     normalizada, não erro (estado real válido, testado com o mesmo
 *     abastecimento usado para `get_fuel_supply_details`).
 *   - Id inexistente: HTTP 404 limpo, `{"error":"Fuel supply not
 *     found"}` — mesma mensagem de `get_fuel_supply_details`, mapeado
 *     para o mesmo código `FUEL_SUPPLY_NOT_FOUND`. Diferente do achado
 *     de inconsistência 404-vs-500 visto em Epic 15/21 — aqui os dois
 *     endpoints irmãos (detalhe e anexos) se comportam de forma
 *     consistente.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { callGetrakWebEndpoint, centralSchema, normalizeItem, type MaintenanceToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /v2.0/maintenance/fuel-supply/{id}/attachments";

export const getFuelSupplyAttachmentsInputSchema = z.object({
  central: centralSchema,
  id: z.number().int().positive(),
});

export type GetFuelSupplyAttachmentsInput = z.infer<typeof getFuelSupplyAttachmentsInputSchema>;

export interface GetFuelSupplyAttachmentsData {
  attachments: Record<string, unknown>[];
}

export function createGetFuelSupplyAttachmentsTool(
  deps: MaintenanceToolDeps,
): DomainToolRegistration<GetFuelSupplyAttachmentsInput, GetFuelSupplyAttachmentsData> {
  const definition: ToolDefinition<GetFuelSupplyAttachmentsInput, GetFuelSupplyAttachmentsData> = {
    name: "get_fuel_supply_attachments",
    risk: "low",
    requiresCentral: true,
    inputSchema: getFuelSupplyAttachmentsInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callGetrakWebEndpoint<Record<string, unknown>>({
        deps,
        path: `/v2.0/maintenance/fuel-supply/${input.id}/attachments`,
        query: {},
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
        notFoundCode: "FUEL_SUPPLY_NOT_FOUND",
      });

      const attachments = Array.isArray(raw.data) ? (raw.data as Record<string, unknown>[]) : [];

      return {
        data: { attachments: attachments.map(normalizeItem) },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_fuel_supply_attachments",
      description: "Get the file attachments (receipts/photos) of a specific fuel supply record within an authorized central. File URLs are short-lived presigned links.",
      intent: "read",
      domain: "maintenance",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
