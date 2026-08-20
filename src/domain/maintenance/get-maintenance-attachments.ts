/**
 * US-060 — Consultar anexos de manutenção.
 * Endpoint: GET /v2.0/maintenance/maintenances/{id}/attachments (não
 * depreciado, oauth2Password/GetrakWeb — token delegado).
 *
 * DECISÃO REGISTRADA — tool separada de `get_maintenance_details`
 * (US-059), NÃO bundled. Mesmo racional de `get_fuel_supply_attachments`
 * (US-054, ver aquele arquivo para o detalhamento completo), reforçado
 * aqui por um teste adicional específico: `GET /v2.0/maintenance/
 * maintenances/{id}` — que TEM um `include[]` funcional e confirmado
 * (usado por `get_maintenance_details` para `last_execution`/`services`,
 * ver aquele arquivo) — foi testado explicitamente com
 * `include[]=attachments` e não teve NENHUM efeito (resposta idêntica
 * com ou sem esse valor). Ou seja, mesmo o único mecanismo de composição
 * nativo que este domínio realmente tem (`include[]` no detalhe de
 * manutenção) não estende a anexos — não é uma limitação genérica de
 * "endpoints de detalhe nunca aceitam parâmetro nenhum" (esse não é o
 * caso aqui), é uma limitação real e específica confirmada por teste
 * direto. Mesmos anexos com `file_url` pré-assinada de expiração curta
 * (~1h) e ciclo de vida próprio (`completed`/`failed`/`pending_upload`)
 * — mesmo argumento de custo/relevância do US-054.
 *
 * Confirmado contra chamada real em homologação nesta rodada:
 *   - Id existente sem anexos: HTTP 200, `{"data": []}` — lista vazia
 *     normalizada, não erro.
 *   - Id inexistente: HTTP 404 limpo, `{"error":"Maintenance not
 *     found"}` — mesma mensagem de `get_maintenance_details`, mapeado
 *     para o mesmo código `MAINTENANCE_NOT_FOUND`. Mesmo par
 *     consistente 404/404 já visto em `get_fuel_supply_details`/
 *     `get_fuel_supply_attachments` (US-053/054) — diferente da
 *     inconsistência 404-vs-500 vista em Epic 15/21 para pares
 *     análogos.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { callGetrakWebEndpoint, centralSchema, normalizeItem, type MaintenanceToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /v2.0/maintenance/maintenances/{id}/attachments";

export const getMaintenanceAttachmentsInputSchema = z.object({
  central: centralSchema,
  id: z.number().int().positive(),
});

export type GetMaintenanceAttachmentsInput = z.infer<typeof getMaintenanceAttachmentsInputSchema>;

export interface GetMaintenanceAttachmentsData {
  attachments: Record<string, unknown>[];
}

export function createGetMaintenanceAttachmentsTool(
  deps: MaintenanceToolDeps,
): DomainToolRegistration<GetMaintenanceAttachmentsInput, GetMaintenanceAttachmentsData> {
  const definition: ToolDefinition<GetMaintenanceAttachmentsInput, GetMaintenanceAttachmentsData> = {
    name: "get_maintenance_attachments",
    risk: "low",
    requiresCentral: true,
    inputSchema: getMaintenanceAttachmentsInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callGetrakWebEndpoint<Record<string, unknown>>({
        deps,
        path: `/v2.0/maintenance/maintenances/${input.id}/attachments`,
        query: {},
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
        notFoundCode: "MAINTENANCE_NOT_FOUND",
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
      name: "get_maintenance_attachments",
      description: "Get the file attachments (invoices/photos) of a specific maintenance within an authorized central. File URLs are short-lived presigned links.",
      intent: "read",
      domain: "maintenance",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
