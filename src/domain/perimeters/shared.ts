/**
 * Helpers compartilhados pelas tools do domínio Perimeters (Epic 10,
 * US-040, US-041, US-042). Os 3 endpoints usam `oauth2Password`/`GetrakWeb`
 * (token delegado — ver `domain/getrak-web-shared.ts`), confirmados contra
 * `reference/openapi.json` (v1.0, não depreciado).
 *
 * ACESSO POR PAPEL (US-040/US-042, nota de negócio da spec): o openapi.json
 * documenta que ADMIN/OPERADOR veem todos os registros da central, enquanto
 * CLIENTE/SUBCLIENTE veem apenas os associados à própria empresa — mas o
 * mecanismo pelo qual o MCP obteria o papel (role) do usuário autenticado
 * não está definido em nenhuma fonte disponível (nem PRD, nem Technical
 * Brief, nem o documento de identidade; o endpoint de emissão de token não
 * documenta esse dado na resposta). Decisão tomada (opção b, já prevista no
 * prompt desta tarefa): o MCP **não implementa filtragem própria por
 * papel** — a API Core já aplica essa regra do lado dela (documentado no
 * próprio openapi.json), e o MCP apenas repassa o resultado já filtrado.
 * Nenhuma lógica de papel/role foi adicionada a estas tools.
 */

export { GETRAK_WEB_AUTH_SCHEME, GETRAK_WEB_SCOPE, callGetrakWebEndpoint } from "../getrak-web-shared.js";
export type { GetrakWebToolDeps as PerimetersToolDeps } from "../getrak-web-shared.js";
export {
  centralSchema,
  paginationInputShape,
  normalizeItem,
  extractPagePerPageEnvelope,
  buildPagePerPagePagination,
} from "../shared.js";
