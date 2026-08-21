/**
 * US-073 — Buscar veículo por placa.
 * Endpoint: GET /v1.0/vehicles/lookup/{plate} (não depreciado,
 * oauth2Password/GetrakWeb — token delegado).
 *
 * ACHADO CRÍTICO, confirmado contra chamada real em homologação nesta
 * rodada — este endpoint **não é** "consultar se esta placa pertence a um
 * veículo rastreado na minha central" (o que a AC da spec pressupõe). É, na
 * prática observada, uma consulta de placa contra uma base nacional de
 * veículos (estilo FIPE/DETRAN) — retorna especificação de fábrica
 * (marca/modelo/chassi/cor/preço FIPE) para QUALQUER placa
 * sintaticamente válida, tenha ela veículo rastreado nesta central ou não:
 *   - Placa completamente inventada (`ZZZ0000`, sem nenhum veículo
 *     correspondente em nenhum cadastro Getrak) retornou HTTP 200 com um
 *     registro completo e plausível (Ford Ka, chassi real, preço FIPE).
 *   - Uma placa que EXISTE na frota desta central (`FMB-6843`, com
 *     `brand`/`vin` propositalmente inválidos no cadastro Getrak, conforme
 *     visto em `search_web_vehicles`) retornou, neste endpoint, uma marca/
 *     modelo/chassi COMPLETAMENTE DIFERENTES (Volkswagen SpaceFox, chassi
 *     real de fábrica) — ou seja, os dados não vêm do cadastro Getrak desta
 *     central, vêm de uma fonte externa/nacional.
 *   - `central_id` aparece no retorno igual em ambos os casos (o central do
 *     usuário autenticado) — não é um filtro real, parece só ser carimbado.
 *   - HTTP 400 (`"Invalid plate format. Expected format: ABC1234 or
 *     ABC1D23"`) só ocorre para formato claramente inválido — nenhuma placa
 *     sintaticamente válida testada (real ou inventada) produziu 404.
 * **Conclusão: a AC "placa sem veículo correspondente -> VEHICLE_NOT_FOUND"
 * não corresponde ao comportamento real observado** — na prática, qualquer
 * placa bem formatada retorna 200 com dados de "consulta de placa"
 * genérica, não "veículo desta central". Implementado fielmente ao
 * endpoint real (não inventada uma checagem adicional de "pertence à
 * central" que não existe na API) — 404 mantido no código para o caso
 * documentado no openapi.json, mesmo não tendo sido observado. Achado
 * central sinalizado no PR para decisão de Produto/Engenharia — pode exigir
 * renomear/reescopar esta tool ou revisar seu caso de uso.
 *
 * Nota sobre o mapeamento de erro: como o HTTP 400 (formato inválido) cai no
 * mesmo branch genérico de `normalizeUpstreamHttpError` que usa o mesmo
 * `notFoundCode` fornecido (não há um segundo parâmetro para um domainCode
 * de 400 separado em `ApiCoreClient`/`error-normalizer.ts` hoje), um 400
 * real também sairia rotulado `VEHICLE_NOT_FOUND` — mesmo trade-off já
 * aceito em `get_user_details` (Epic 16), mas sinalizado aqui com mais
 * força por ser um caso realmente observado nesta rodada (não hipotético).
 * Não alterada a fundação (`error-normalizer.ts`) para resolver isso — fora
 * do escopo desta tarefa.
 *
 * Placa é dado sensível (CLAUDE.md Seção 8) — mascarada apenas no log de
 * auditoria (automático via `deepMask`), nunca na resposta ao consumidor já
 * autorizado, mesmo tratamento das demais tools de veículo.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { callGetrakWebEndpoint, centralSchema, normalizeItem, type WebVehiclesToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/vehicles/lookup/{plate}";

export const getVehicleByPlateInputSchema = z.object({
  central: centralSchema,
  plate: z.string().min(1, "plate is required"),
});

export type GetVehicleByPlateInput = z.infer<typeof getVehicleByPlateInputSchema>;

export interface GetVehicleByPlateData {
  vehicle: Record<string, unknown>;
}

export function createGetVehicleByPlateTool(
  deps: WebVehiclesToolDeps,
): DomainToolRegistration<GetVehicleByPlateInput, GetVehicleByPlateData> {
  const definition: ToolDefinition<GetVehicleByPlateInput, GetVehicleByPlateData> = {
    name: "get_vehicle_by_plate",
    risk: "low",
    requiresCentral: true,
    inputSchema: getVehicleByPlateInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callGetrakWebEndpoint<Record<string, unknown>>({
        deps,
        path: `/v1.0/vehicles/lookup/${encodeURIComponent(input.plate)}`,
        query: {},
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
        notFoundCode: "VEHICLE_NOT_FOUND",
      });

      const vehicle = normalizeItem(raw && typeof raw === "object" ? raw : {});

      return {
        data: { vehicle },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_vehicle_by_plate",
      description:
        "Look up vehicle specification data by license plate. NOTE: empirically this queries a national plate/manufacturer " +
        "database, not necessarily a vehicle tracked by this central — see source comments.",
      intent: "read",
      domain: "web_vehicles",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
