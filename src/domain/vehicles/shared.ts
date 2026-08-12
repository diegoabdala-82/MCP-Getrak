/**
 * Helpers compartilhados pelas tools do domínio Veículos (Epic 2, US-008 a
 * US-012). Todos os 5 endpoints de origem usam `oauth2ClientCredentials`,
 * escopo `Integracao` (confirmado em `reference/openapi.json`).
 *
 * Nenhum dos 5 endpoints (`/v0.2/veiculos/...`) aceita `central` como
 * parâmetro de request (nem query, nem path) — ver nota em
 * `foundation/auth/secrets-provider.ts`. Por isso `central` aqui só é usado
 * para: (a) validação de autorização (US-002) e (b) resolução da credencial
 * técnica correta via `ApiCoreClient`/`AuthManager`; nunca é enviado como
 * query param a estes endpoints.
 */

import { z } from "zod";
import type { Environment } from "../../config/environment.js";
import type { ApiCoreClient } from "../../foundation/http/api-core-client.js";
import { normalizeNullableFields } from "../../foundation/envelope/response-envelope.js";
import { normalizePagination, type PaginationMeta } from "../../foundation/pagination/pagination.js";

export const VEHICLES_AUTH_SCHEME = "oauth2ClientCredentials" as const;

export const centralSchema = z.string().min(1, "central is required");

export const paginationInputShape = {
  page: z.number().int().positive().optional(),
  page_size: z.number().int().positive().optional(),
};

export interface VehiclesToolDeps {
  apiCoreClient: ApiCoreClient;
}

/** Normaliza um item bruto (undefined -> null em todos os campos de 1º nível). */
export function normalizeItem(item: Record<string, unknown>): Record<string, unknown> {
  return normalizeNullableFields(item);
}

/**
 * Alguns endpoints deste domínio (`/v0.2/veiculos/categorias`,
 * `/v0.2/veiculos/integracao/veiculoSuspenderIntegracao`) declaram no
 * `openapi.json` um schema de resposta `type: object` (um único registro),
 * mas o nome/descrição do endpoint e a presença de parâmetros de paginação
 * sugerem fortemente que a resposta real é uma lista. Esta é uma
 * inconsistência conhecida da API Core (PRD/Contexto: "objetos
 * inconsistentes"). Tratamos ambas as formas defensivamente em vez de
 * assumir uma delas como certa.
 */
export function extractArray(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) {
    return raw as Record<string, unknown>[];
  }
  if (raw && typeof raw === "object") {
    return [raw as Record<string, unknown>];
  }
  return [];
}

/**
 * Monta a paginação padronizada (US-004) e a traduz para o formato real do
 * endpoint (`limitParamName`/`offset`, ambos confirmados em
 * `reference/openapi.json` por endpoint — `limite` para
 * `/v0.2/veiculos/integracao` e `.../veiculoSuspenderIntegracao`, `limit`
 * para os endpoints de vínculo cliente/subcliente).
 */
export function buildUpstreamPagination(
  input: { page?: number; page_size?: number },
  limitParamName: "limite" | "limit",
): { query: Record<string, number>; page: number; page_size: number } {
  const { page, page_size } = normalizePagination(input);
  return {
    query: { [limitParamName]: page_size, offset: (page - 1) * page_size },
    page,
    page_size,
  };
}

/**
 * `has_more`/`total_items`: nenhum dos endpoints deste domínio retorna uma
 * contagem total no payload — apenas os itens da página. `total_items`
 * fica `null` (US-003: valor ausente normalizado de forma consistente);
 * `has_more` é uma estimativa (página cheia -> provavelmente há mais).
 */
export function buildPaginationMeta(items: unknown[], page: number, page_size: number): PaginationMeta {
  return {
    page,
    page_size,
    total_items: null,
    has_more: items.length >= page_size,
  };
}

export interface CallVehiclesEndpointParams {
  apiCoreClient: ApiCoreClient;
  path: string;
  query: Record<string, string | number | boolean | undefined>;
  environment: Environment;
  central: string;
}

export function callVehiclesEndpoint<T>(params: CallVehiclesEndpointParams): Promise<T> {
  return params.apiCoreClient.get<T>({
    path: params.path,
    query: params.query,
    environment: params.environment,
    central: params.central,
    authScheme: VEHICLES_AUTH_SCHEME,
  });
}
