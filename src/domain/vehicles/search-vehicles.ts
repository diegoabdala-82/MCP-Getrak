/**
 * US-008 — Buscar veículos por identificador, placa ou filtros.
 * Endpoint: GET /v0.2/veiculos/integracao (v0.2, vigente, oauth2ClientCredentials/Integracao).
 * Confirmado contra reference/openapi.json: query params reais
 * `sistema, ativo, placa, cnpjCliente, cliente, subcliente, ordem, limite, offset, id`;
 * resposta é um array de objetos de veículo; paginação real = limite/offset
 * (não page/per_page).
 *
 * CORRIGIDO (achado ao revisitar o openapi.json com resolução completa de
 * parâmetros `$ref` durante a pesquisa do Epic 4): `sistema` é descrito
 * apenas como "dev" NESTE endpoint especificamente, mas o mesmo parâmetro,
 * no mesmo formato, aparece em ~40 outras rotas da família "integracao" do
 * openapi.json consistentemente documentado como central
 * ("Central unique identifier", "Filter by central" em
 * /v0.2/equipamentos/integracao, etc.) — inclusive em
 * GET /v0.2/veiculos/integracao/veiculoSuspenderIntegracao, endpoint irmão
 * deste, onde a descrição É "Central unique identifier". A versão anterior
 * desta tool não enviava `sistema`, na suposição (errada, GAP-004-like) de
 * que o isolamento por central era só resolvido pela credencial técnica.
 * Corrigido para enviar `sistema: central` explicitamente também.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import {
  buildPaginationMeta,
  buildUpstreamPagination,
  callVehiclesEndpoint,
  centralSchema,
  extractArray,
  normalizeItem,
  paginationInputShape,
  type VehiclesToolDeps,
} from "./shared.js";

const SOURCE_ENDPOINT = "GET /v0.2/veiculos/integracao";

export const searchVehiclesInputSchema = z.object({
  central: centralSchema,
  id: z.string().optional(),
  plate: z.string().optional(),
  active_status: z.enum(["Y", "D", "I", "S"]).optional(),
  client_cnpj: z.string().optional(),
  client_id: z.string().optional(),
  subclient_id: z.string().optional(),
  sort: z.string().optional(),
  ...paginationInputShape,
});

export type SearchVehiclesInput = z.infer<typeof searchVehiclesInputSchema>;

export interface SearchVehiclesData {
  vehicles: Record<string, unknown>[];
  pagination: ReturnType<typeof buildPaginationMeta>;
}

export function createSearchVehiclesTool(
  deps: VehiclesToolDeps,
): DomainToolRegistration<SearchVehiclesInput, SearchVehiclesData> {
  const definition: ToolDefinition<SearchVehiclesInput, SearchVehiclesData> = {
    name: "search_vehicles",
    risk: "low",
    requiresCentral: true,
    inputSchema: searchVehiclesInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildUpstreamPagination(input, "limite");

      const raw = await callVehiclesEndpoint<unknown>({
        apiCoreClient: deps.apiCoreClient,
        path: "/v0.2/veiculos/integracao",
        query: {
          sistema: input.central,
          id: input.id,
          placa: input.plate,
          ativo: input.active_status,
          cnpjCliente: input.client_cnpj,
          cliente: input.client_id,
          subcliente: input.subclient_id,
          ordem: input.sort,
          ...upstreamPagination.query,
        },
        environment: ctx.environment,
        central: input.central,
      });

      const vehicles = extractArray(raw).map(normalizeItem);

      return {
        data: {
          vehicles,
          pagination: buildPaginationMeta(vehicles, upstreamPagination.page, upstreamPagination.page_size),
        },
        endpoints: [SOURCE_ENDPOINT],
      };
    },
  };

  return {
    catalogEntry: {
      name: "search_vehicles",
      description: "Search vehicles by identifier, plate or supported filters within an authorized central.",
      intent: "read",
      domain: "vehicles",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
