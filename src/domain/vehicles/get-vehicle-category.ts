/**
 * US-009 — Consultar categoria de um veículo.
 * Endpoint: GET /v0.2/veiculos/categorias (v0.2, vigente, oauth2ClientCredentials/Integracao).
 *
 * DESVIO CONHECIDO DA SPEC (sinalizado, não decidido silenciosamente): a
 * spec da US-009 descreve a entrada como "identificador de veículo ou
 * categoria", mas o endpoint real, confirmado em reference/openapi.json,
 * não aceita NENHUM parâmetro de request — é uma listagem estática de todas
 * as categorias cadastradas (`{id, descricao}` cada). Não há, no
 * openapi.json, nenhum meio de filtrar por veículo ou por id de categoria
 * nesta rota. Implementado aqui como "listar todas as categorias de
 * veículo", que é o único comportamento que o endpoint real suporta;
 * qualquer forma de "categoria de UM veículo específico" exigiria um
 * endpoint diferente, não identificado nas fontes disponíveis.
 *
 * O schema de resposta declarado é `type: object` (um único registro), mas
 * o nome do endpoint e sua descrição ("Recover vehicle categories", plural)
 * sugerem uma lista — tratado defensivamente via `extractArray`.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { callVehiclesEndpoint, centralSchema, extractArray, normalizeItem, type VehiclesToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /v0.2/veiculos/categorias";

export const getVehicleCategoryInputSchema = z.object({
  central: centralSchema,
});

export type GetVehicleCategoryInput = z.infer<typeof getVehicleCategoryInputSchema>;

export interface GetVehicleCategoryData {
  categories: Record<string, unknown>[];
}

export function createGetVehicleCategoryTool(
  deps: VehiclesToolDeps,
): DomainToolRegistration<GetVehicleCategoryInput, GetVehicleCategoryData> {
  const definition: ToolDefinition<GetVehicleCategoryInput, GetVehicleCategoryData> = {
    name: "get_vehicle_category",
    risk: "low",
    requiresCentral: true,
    inputSchema: getVehicleCategoryInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callVehiclesEndpoint<unknown>({
        apiCoreClient: deps.apiCoreClient,
        path: "/v0.2/veiculos/categorias",
        query: {},
        environment: ctx.environment,
        central: input.central,
      });

      const categories = extractArray(raw).map(normalizeItem);

      return {
        data: { categories },
        endpoints: [SOURCE_ENDPOINT],
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_vehicle_category",
      description: "List vehicle categories available within an authorized central.",
      intent: "read",
      domain: "vehicles",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
