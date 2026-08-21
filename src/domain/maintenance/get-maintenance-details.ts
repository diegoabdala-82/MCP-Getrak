/**
 * US-059 — Consultar detalhe de manutenção.
 * Endpoint: GET /v2.0/maintenance/maintenances/{id} (não depreciado,
 * oauth2Password/GetrakWeb — token delegado).
 *
 * ACHADO CRÍTICO — a própria spec desta User Story exige que o detalhe
 * inclua "serviços associados + última execução", e o schema de resposta
 * documentado no `openapi.json` mostra `services`/`last_execution` como
 * propriedades sempre presentes do objeto de detalhe. **Isso é FALSO no
 * comportamento real**: confirmado empiricamente que
 * `GET /v2.0/maintenance/maintenances/{id}` SEM nenhum parâmetro extra
 * NÃO retorna `services` nem `last_execution` (as chaves ficam totalmente
 * ausentes do objeto, não `null`). O endpoint só os inclui quando
 * recebe o MESMO parâmetro `include[]` documentado apenas para o
 * endpoint de LISTA irmão (`GET /v2.0/maintenance/maintenances`,
 * `include[]=last_execution`/`include[]=services`) — um parâmetro que o
 * `openapi.json` não documenta como aceito pelo endpoint de detalhe, mas
 * que na prática é aceito e necessário. **Se esta tool não enviasse
 * `include[]` proativamente, ela violaria seu próprio critério de
 * aceite** (a spec exige os dois campos no detalhe) sem nenhum aviso —
 * um bug de conformidade encontrado e corrigido só por não confiar
 * cegamente na documentação (CLAUDE.md Seção 7).
 *
 * Por isso, `include[]=last_execution&include[]=services` é **sempre
 * enviado, incondicionalmente, não exposto como parâmetro de entrada da
 * tool** — não haveria motivo de negócio para o consumidor pedir menos
 * do que o próprio critério de aceite da User Story exige.
 *
 * Testado explicitamente e descartado como alternativa:
 * `include[]=attachments` não tem NENHUM efeito (resposta idêntica com
 * ou sem esse valor) — não existe suporte nativo da API Core para
 * compor anexos no detalhe; ver decisão de não-bundle em
 * `get-fuel-supply-attachments.ts`/`get-maintenance-attachments.ts`.
 *
 * Confirmado também:
 *   - Id existente: HTTP 200, objeto completo com `last_execution: {id,
 *     date, odometer, hourmeter}` (todos `null` quando nunca executada) e
 *     `services: [{id, name, step, performed, service_id, value_cents,
 *     original_value_cents, created_at, created_by, updated_at,
 *     updated_by}]`.
 *   - Id inexistente: HTTP 404 limpo, `{"error":"Maintenance not
 *     found"}` — mapeado para `MAINTENANCE_NOT_FOUND` via `notFoundCode`.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { callGetrakWebEndpoint, centralSchema, normalizeItem, type MaintenanceToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /v2.0/maintenance/maintenances/{id}";

export const getMaintenanceDetailsInputSchema = z.object({
  central: centralSchema,
  id: z.number().int().positive(),
});

export type GetMaintenanceDetailsInput = z.infer<typeof getMaintenanceDetailsInputSchema>;

export interface GetMaintenanceDetailsData {
  maintenance: Record<string, unknown>;
}

export function createGetMaintenanceDetailsTool(
  deps: MaintenanceToolDeps,
): DomainToolRegistration<GetMaintenanceDetailsInput, GetMaintenanceDetailsData> {
  const definition: ToolDefinition<GetMaintenanceDetailsInput, GetMaintenanceDetailsData> = {
    name: "get_maintenance_details",
    risk: "low",
    requiresCentral: true,
    inputSchema: getMaintenanceDetailsInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callGetrakWebEndpoint<Record<string, unknown>>({
        deps,
        path: `/v2.0/maintenance/maintenances/${input.id}`,
        query: {
          // Não documentado para este endpoint no openapi.json, mas
          // confirmado necessário para trazer `services`/`last_execution`
          // — ver comentário do topo do arquivo.
          "include[]": ["last_execution", "services"],
        },
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
        notFoundCode: "MAINTENANCE_NOT_FOUND",
      });

      return {
        data: { maintenance: normalizeItem(raw) },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_maintenance_details",
      description: "Get details of a single maintenance by id, including its associated services and last execution, within an authorized central.",
      intent: "read",
      domain: "maintenance",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
