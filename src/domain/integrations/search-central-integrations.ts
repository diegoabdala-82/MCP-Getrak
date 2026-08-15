/**
 * US-039 — Listar integrações de central.
 * Endpoint: GET /v1.0/integrations (v1.0, vigente, oauth2Password/GetrakWeb
 * — token delegado). Confirmado contra reference/openapi.json: query params
 * reais `page, perPage, fields[] (array, style=form/explode=false -> um
 * único valor separado por vírgula, ex.: "id,central,status" — diferente de
 * search-geofences.ts, onde fields[] é repetido, não comma-joined; mesma
 * heterogeneidade real já vista em Epic 2/9/ED-01), include[] (idem,
 * explode=false, único valor documentado: "provider"), filters[id][eq],
 * filters[provider_id][eq], filters[status][eq] (active|error|inactive),
 * order[id] (asc|desc), order[created_at] (asc|desc)`. Paginação real =
 * page/per_page com envelope `{data, page, pages, total}`.
 *
 * SENSIBILIDADE SINALIZADA (não mascarada aqui, mesmo tratamento já
 * aplicado a cnpj/email em Epic 9 — mascaramento é só na auditoria, CLAUDE.md
 * Seção 8): o item de integração documentado no openapi.json inclui
 * `credentials.token` (token de acesso do provedor externo). A tool passa
 * o dado adiante como retornado pela API Core, sem mascaramento adicional
 * — mas expõe `fields` para que o consumidor restrinja quais campos
 * recebe, se preferir omitir `credentials`. Sinalizado no PR.
 *
 * NOME DA TOOL: spec sugeriu `list_central_integrations`; renomeada para
 * `search_central_integrations` — tem filtros reais (id, provider_id,
 * status), mesma convenção já aplicada em Epic 9/Accessories.
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
  type IntegrationsToolDeps,
} from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/integrations";

const INTEGRATION_FIELDS = [
  "id",
  "provider_id",
  "central_id",
  "central",
  "status",
  "credentials",
  "status_detail",
  "sync_client",
  "sync_user",
  "created_at",
  "updated_at",
] as const;

export const searchCentralIntegrationsInputSchema = z.object({
  central: centralSchema,
  id: z.string().optional(),
  provider_id: z.string().optional(),
  status: z.enum(["active", "error", "inactive"]).optional(),
  fields: z.array(z.enum(INTEGRATION_FIELDS)).optional(),
  include_provider: z.boolean().optional(),
  sort_by: z.enum(["id", "created_at"]).optional(),
  sort_direction: z.enum(["asc", "desc"]).optional(),
  ...paginationInputShape,
});

export type SearchCentralIntegrationsInput = z.infer<typeof searchCentralIntegrationsInputSchema>;

export interface SearchCentralIntegrationsData {
  integrations: Record<string, unknown>[];
  pagination: ReturnType<typeof extractPagePerPageEnvelope>["meta"];
}

export function createSearchCentralIntegrationsTool(
  deps: IntegrationsToolDeps,
): DomainToolRegistration<SearchCentralIntegrationsInput, SearchCentralIntegrationsData> {
  const definition: ToolDefinition<SearchCentralIntegrationsInput, SearchCentralIntegrationsData> = {
    name: "search_central_integrations",
    risk: "low",
    requiresCentral: true,
    inputSchema: searchCentralIntegrationsInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildPagePerPagePagination(input, "perPage");
      const sortQuery = input.sort_by ? { [`order[${input.sort_by}]`]: input.sort_direction ?? "asc" } : {};

      const raw = await callGetrakWebEndpoint<unknown>({
        deps,
        path: "/v1.0/integrations",
        query: {
          "fields[]": input.fields?.join(","),
          "include[]": input.include_provider ? "provider" : undefined,
          "filters[id][eq]": input.id,
          "filters[provider_id][eq]": input.provider_id,
          "filters[status][eq]": input.status,
          ...sortQuery,
          ...upstreamPagination.query,
        },
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
      });

      const { items, meta } = extractPagePerPageEnvelope(raw, upstreamPagination.page, upstreamPagination.page_size);

      return {
        data: { integrations: items.map(normalizeItem), pagination: meta },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "search_central_integrations",
      description:
        "Search the third-party integrations configured for an authorized central. " +
        "Response items may include integration credentials as returned by the API Core (use `fields` to restrict them).",
      intent: "read",
      domain: "integrations",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
