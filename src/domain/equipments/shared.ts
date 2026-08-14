/**
 * Helpers compartilhados pelas tools do domínio Equipamentos (Epic 4,
 * US-020, US-021). Os 2 endpoints de origem usam `oauth2ClientCredentials`,
 * escopo `Integracao` (confirmado em `reference/openapi.json`), mesmo
 * esquema/escopo do domínio Veículos (Epic 2).
 *
 * `sistema` (central): confirmado em `GET /v0.2/equipamentos/integracao`
 * com descrição explícita "Filter by central" — enviado desde o início
 * (lição do achado tardio no Epic 2, ver domain/vehicles/shared.ts).
 * `GET /v0.2/equipamentos/integracao/posicaobancada/{modulo}` NÃO tem esse
 * parâmetro (confirmado — só aceita `modulo` via path), mesmo padrão já
 * visto em endpoints de lookup por identificador específico
 * (get_vehicle_category, get_equipment_bench_position).
 */

import type { Environment } from "../../config/environment.js";
import type { ApiCoreClient, ApiCoreQueryValue } from "../../foundation/http/api-core-client.js";
import { buildLimitOffsetPagination } from "../shared.js";

export { centralSchema, paginationInputShape, normalizeItem, extractArray, buildPaginationMeta } from "../shared.js";

export const EQUIPMENTS_AUTH_SCHEME = "oauth2ClientCredentials" as const;

export interface EquipmentsToolDeps {
  apiCoreClient: ApiCoreClient;
}

export function buildUpstreamPagination(
  input: { page?: number; page_size?: number },
  limitParamName: "limit",
): { query: Record<string, number>; page: number; page_size: number } {
  return buildLimitOffsetPagination(input, limitParamName);
}

export interface CallEquipmentsEndpointParams {
  apiCoreClient: ApiCoreClient;
  path: string;
  query: Record<string, ApiCoreQueryValue>;
  environment: Environment;
  central: string;
}

export function callEquipmentsEndpoint<T>(params: CallEquipmentsEndpointParams): Promise<T> {
  return params.apiCoreClient.get<T>({
    path: params.path,
    query: params.query,
    environment: params.environment,
    central: params.central,
    authScheme: EQUIPMENTS_AUTH_SCHEME,
  });
}
