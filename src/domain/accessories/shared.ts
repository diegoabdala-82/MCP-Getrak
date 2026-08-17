/**
 * Helpers compartilhados pelas tools do domínio Accessories (Epic 10,
 * US-035, US-036, US-037). Os 3 endpoints usam `oauth2Password`/`GetrakWeb`
 * (token delegado — ver `domain/getrak-web-shared.ts`), confirmados contra
 * `reference/openapi.json` (v1.0, não depreciado).
 */

export { GETRAK_WEB_AUTH_SCHEME, GETRAK_WEB_SCOPE, callGetrakWebEndpoint } from "../getrak-web-shared.js";
export type { GetrakWebToolDeps as AccessoriesToolDeps } from "../getrak-web-shared.js";
export {
  centralSchema,
  paginationInputShape,
  normalizeItem,
  extractPagePerPageEnvelope,
  buildPagePerPagePagination,
} from "../shared.js";
