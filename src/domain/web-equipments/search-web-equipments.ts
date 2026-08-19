/**
 * US-090 — Buscar equipamentos (Getrak Web).
 * Endpoint: GET /v1.0/equipments (não depreciado, oauth2Password/GetrakWeb
 * — token delegado).
 *
 * Confirmado contra chamada real em homologação nesta rodada:
 *   - MESMO BUG DE PAGINAÇÃO `perPage`/`per_page` do resto do domínio
 *     Getrak Web: `perPage` ignorado (aplica o padrão de 25 do lado do
 *     servidor), `per_page` respeitado. Implementado com `per_page` desde
 *     o início.
 *   - Filtros `[in]` (`status`, `serial_number`, `model_id`, `technology`,
 *     `responsible_id`) aceitam **lista separada por vírgula em um único
 *     valor** (`filters[status][in]=L,D`) — formato do próprio exemplo
 *     documentado no openapi.json para cada um desses 5 parâmetros.
 *     Empiricamente confirmado só para `status` (`L,D` → total 12; `L`
 *     sozinho → total 9; chave repetida sem `[]` também deu 12) — os
 *     outros 4 seguem o mesmo modificador `[in]` com o mesmo formato de
 *     exemplo documentado consistentemente NESTE MESMO endpoint (não uma
 *     suposição cross-endpoint, que já se mostrou arriscada no Epic 19 vs.
 *     Epic 13 — aqui é o mesmo endpoint, o mesmo modificador, repetido).
 *   - `filters[serial_number][eq]` com valor inexistente retorna lista
 *     vazia normalizada (`{data: [], total: 0}`), HTTP 200, nunca erro.
 *   - `fields[]`/`include[]` (documentados, opcionais) não expostos nesta
 *     rodada — não testados; mesma disciplina de redução de risco já
 *     aplicada a outros domínios Getrak Web.
 *
 * SOBREPOSIÇÃO COM US-020 (`search_equipments`, Epic 4,
 * `GET /v0.2/equipamentos/integracao`, `oauth2ClientCredentials`) —
 * investigada conforme instruído, comparando os campos reais desta tool
 * (confirmados agora) com o shape documentado/já implementado de US-020:
 *   - US-020 (`oauth2ClientCredentials`): `{chip, equipamento, id_veiculo,
 *     modulo, placa, sistema}` — visão orientada a VÍNCULO COM VEÍCULO
 *     (módulo, placa, id do veículo vinculado), nomes de campo em
 *     português.
 *   - US-090 (esta tool, `oauth2Password`): `{apn, carrier_name, central,
 *     chip_serial_number, created_at, description, device, device_number,
 *     model: {...}, serial_number, status, updated_at, user}` — visão
 *     orientada a INVENTÁRIO/ATIVO DE TELECOM (modelo do dispositivo,
 *     operadora/APN, chip, ciclo de vida via `status` L/D/M/A), nomes de
 *     campo em inglês, **sem nenhum campo de vínculo com veículo**
 *     (`id_veiculo`/`placa` não existem aqui).
 *   - **Conclusão: mesmo domínio nominal ("busca de equipamentos"), mas
 *     conjuntos de campos quase inteiramente disjuntos** — a sobreposição
 *     é de NOME/ESPAÇO CONCEITUAL, não de dado duplicado. US-020 responde
 *     "que veículo usa este equipamento" (visão de frota); US-090 responde
 *     "qual é o estado deste ativo de telecom" (visão de inventário). Isso
 *     é uma sobreposição bem mais fraca que a já registrada entre US-070/
 *     US-008 (Epic 17), que retornavam conceitos de cadastro de veículo
 *     quase idênticos. **Nenhuma tool consolidada ou descartada** — decisão
 *     de Produto/Engenharia, sinalizada no PR.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import {
  buildPagePerPagePagination,
  callGetrakWebEndpoint,
  centralSchema,
  extractPagePerPageEnvelope,
  normalizeItem,
  paginationInputShape,
  type WebEquipmentsToolDeps,
} from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/equipments";

const SORTABLE_FIELDS = ["serial_number", "status"] as const;

function joinList(values: string[] | number[] | undefined): string | undefined {
  return values && values.length > 0 ? values.join(",") : undefined;
}

export const searchWebEquipmentsInputSchema = z.object({
  central: centralSchema,
  search: z.string().optional(),
  serial_number: z.string().optional(),
  serial_number_contains: z.string().optional(),
  serial_numbers: z.array(z.string().min(1)).optional(),
  device_number_contains: z.string().optional(),
  carrier_name_contains: z.string().optional(),
  apn_contains: z.string().optional(),
  device_phone_contains: z.string().optional(),
  chip_serial_number_contains: z.string().optional(),
  statuses: z.array(z.string().min(1)).optional(),
  model_ids: z.array(z.number().int()).optional(),
  technologies: z.array(z.string().min(1)).optional(),
  tag_id: z.string().optional(),
  responsible_ids: z.array(z.number().int()).optional(),
  sort_by: z.enum(SORTABLE_FIELDS).optional(),
  sort_direction: z.enum(["ASC", "DESC"]).optional(),
  ...paginationInputShape,
});

export type SearchWebEquipmentsInput = z.infer<typeof searchWebEquipmentsInputSchema>;

export interface SearchWebEquipmentsData {
  equipments: Record<string, unknown>[];
  pagination: ReturnType<typeof extractPagePerPageEnvelope>["meta"];
}

export function createSearchWebEquipmentsTool(
  deps: WebEquipmentsToolDeps,
): DomainToolRegistration<SearchWebEquipmentsInput, SearchWebEquipmentsData> {
  const definition: ToolDefinition<SearchWebEquipmentsInput, SearchWebEquipmentsData> = {
    name: "search_web_equipments",
    risk: "low",
    requiresCentral: true,
    inputSchema: searchWebEquipmentsInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildPagePerPagePagination(input, "per_page");
      const sortQuery = input.sort_by ? { [`order[${input.sort_by}]`]: input.sort_direction ?? "ASC" } : {};

      const raw = await callGetrakWebEndpoint<unknown>({
        deps,
        path: "/v1.0/equipments",
        query: {
          "filters[search][inc]": input.search,
          "filters[serial_number][eq]": input.serial_number,
          "filters[serial_number][inc]": input.serial_number_contains,
          "filters[serial_number][in]": joinList(input.serial_numbers),
          "filters[device_number][inc]": input.device_number_contains,
          "filters[carrier_name][inc]": input.carrier_name_contains,
          "filters[apn][inc]": input.apn_contains,
          "filters[device_phone][inc]": input.device_phone_contains,
          "filters[chip_serial_number][inc]": input.chip_serial_number_contains,
          "filters[status][in]": joinList(input.statuses),
          "filters[model_id][in]": joinList(input.model_ids),
          "filters[technology][in]": joinList(input.technologies),
          "filters[tag_id][eq]": input.tag_id,
          "filters[responsible_id][in]": joinList(input.responsible_ids),
          ...sortQuery,
          ...upstreamPagination.query,
        },
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
      });

      const { items, meta } = extractPagePerPageEnvelope(raw, upstreamPagination.page, upstreamPagination.page_size);

      return {
        data: { equipments: items.map(normalizeItem), pagination: meta },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "search_web_equipments",
      description:
        "Search telecom/asset-inventory equipments (device, chip, carrier, lifecycle status) within an authorized central. Distinct from search_equipments (Epic 4), which returns vehicle-linkage data instead.",
      intent: "read",
      domain: "web_equipments",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
