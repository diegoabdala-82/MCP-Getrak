/**
 * US-092 — Buscar dispositivos.
 * Endpoint: GET /v1.0/equipments/devices (não depreciado, oauth2Password/
 * GetrakWeb — token delegado).
 *
 * ACHADO CRÍTICO — este endpoint NÃO PAGINA, sob nenhuma convenção
 * testada. Confirmado empiricamente antes de codificar: `page`, `per_page`,
 * `perPage`, `limit` e `offset` foram todos testados isoladamente e em
 * combinação — nenhum teve qualquer efeito no tamanho da resposta. O
 * endpoint SEMPRE retorna a lista completa de dispositivos da central:
 * nesta central de demonstração, ~18.200 itens, ~9 MB por chamada, mesmo
 * sem filtro nenhum.
 *
 * Tratado com `createClientSideSliceAdapter` (mesmo padrão já usado em
 * `get_centrals`, Epic 9, para o mesmo problema) — o corte de
 * página/tamanho é aplicado no lado do MCP, depois de já ter recebido a
 * lista inteira da API Core. Isso respeita o CONTRATO de página/tamanho
 * do consumidor da tool (nunca mais que `page_size` itens na resposta),
 * mas **não elimina o custo real de rede/memória de buscar a lista
 * inteira a cada chamada** — uma limitação real do endpoint upstream, não
 * do MCP. Sinalizado explicitamente via `warnings` na resposta (mesmo
 * padrão de `get_centrals`), recomendando o uso do filtro
 * `full_device_number` (busca exata, testado e confirmado abaixo) sempre
 * que o consumidor souber o dispositivo específico que procura.
 *
 * FILTROS testados individualmente:
 *   - `filters[full_device_number]` — busca exata, confirmada funcionando
 *     (1 resultado para um `device_number` real; 0 para um valor
 *     inventado).
 *   - `filters[status]` — reduz a lista real (18219 → 15808 com
 *     `status=Y`), mas não resolve o problema de paginação por si só
 *     (ainda pode ser uma lista muito grande).
 *   - Os parâmetros documentados de nível raiz `device` e `serial_number`
 *     (sem `filters[...]`) foram testados e são **confirmadamente
 *     inúteis/quebrados para filtragem**: `device=<valor real>` retornou a
 *     lista INTEIRA sem filtrar (mesmo tamanho de bytes que sem nenhum
 *     parâmetro); `serial_number=<qualquer valor>` sozinho retornou HTTP
 *     400 `{"error":"Device is mandatory"}` — um erro que não faz sentido
 *     para o parâmetro enviado, sugerindo que esses dois parâmetros têm
 *     uma semântica interna diferente da de um filtro simples (talvez
 *     usados apenas por outra rota de consumo do mesmo endpoint). **Não
 *     expostos como parâmetros da tool** — nem `device` nem
 *     `serial_number`; só os dois filtros `filters[...]` confirmados
 *     funcionando.
 *   - `central` (documentado como "Central identifier required for
 *     integration users") não é enviado — não se aplica ao fluxo de token
 *     delegado (`oauth2Password`/`GetrakWeb`), mesmo padrão de todo o
 *     resto do domínio Getrak Web (a central já está implícita na
 *     identidade do usuário autenticado).
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import {
  callGetrakWebEndpoint,
  centralSchema,
  createClientSideSliceAdapter,
  normalizeItem,
  normalizePagination,
  paginationInputShape,
  type WebEquipmentsToolDeps,
} from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/equipments/devices";

const sliceAdapter = createClientSideSliceAdapter<Record<string, unknown>>({
  extractItems: (raw) => (Array.isArray(raw.data) ? (raw.data as Record<string, unknown>[]) : []),
});

export const searchEquipmentDevicesInputSchema = z.object({
  central: centralSchema,
  full_device_number: z.string().optional(),
  status: z.string().optional(),
  ...paginationInputShape,
});

export type SearchEquipmentDevicesInput = z.infer<typeof searchEquipmentDevicesInputSchema>;

export interface SearchEquipmentDevicesData {
  devices: Record<string, unknown>[];
  pagination: ReturnType<typeof sliceAdapter.fromUpstreamResponse>["meta"];
}

export function createSearchEquipmentDevicesTool(
  deps: WebEquipmentsToolDeps,
): DomainToolRegistration<SearchEquipmentDevicesInput, SearchEquipmentDevicesData> {
  const definition: ToolDefinition<SearchEquipmentDevicesInput, SearchEquipmentDevicesData> = {
    name: "search_equipment_devices",
    risk: "low",
    requiresCentral: true,
    inputSchema: searchEquipmentDevicesInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callGetrakWebEndpoint<Record<string, unknown>>({
        deps,
        path: "/v1.0/equipments/devices",
        query: {
          "filters[full_device_number]": input.full_device_number,
          "filters[status]": input.status,
        },
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
      });

      const pagination = normalizePagination(input);
      const { items, meta } = sliceAdapter.fromUpstreamResponse(raw, pagination);

      const warnings: string[] = [];
      if (!input.full_device_number) {
        warnings.push(
          "This upstream endpoint does not support server-side pagination or filtering by device/serial_number " +
            "(confirmed broken) — every call fetches the entire device list for the central internally before " +
            "slicing it to the requested page. Use full_device_number for an exact match when possible to avoid " +
            "large upstream responses.",
        );
      }

      return {
        data: { devices: items.map(normalizeItem), pagination: meta },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
        warnings,
      };
    },
  };

  return {
    catalogEntry: {
      name: "search_equipment_devices",
      description:
        "Search equipment devices (chip/SIM, carrier, tag) within an authorized central. The upstream endpoint has no native pagination — results are sliced client-side.",
      intent: "read",
      domain: "web_equipments",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
