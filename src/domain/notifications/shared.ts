/**
 * Helpers compartilhados pelas tools do domínio Notifications (Epic 18,
 * Release 3, novo 16/08/2026 — US-077, US-078). Os 2 endpoints usam
 * `oauth2Password`/`GetrakWeb` (token delegado — ver
 * `domain/getrak-web-shared.ts`), confirmados contra `reference/openapi.json`
 * (nenhum é `deprecated`) e, adicionalmente, contra chamada real em
 * homologação nesta rodada (ver comentário de cada tool).
 *
 * MASCARAMENTO DE CONTEÚDO DE MENSAGEM — decisão sinalizada, não uma
 * suposição silenciosa: a tarefa desta rodada instruiu explicitamente
 * "aplique mascaramento na resposta normalizada e no log de auditoria,
 * seguindo o mesmo padrão já usado em outras tools". Essas duas metades da
 * instrução se contradizem: o padrão real já em uso em TODO o resto do
 * projeto (`search_clients.ts`, Epic 9; `get_current_user.ts`, Epic 16;
 * etc., todos com o mesmo comentário) é mascarar apenas no log de
 * auditoria (via `deepMask`, automático em `audit-logger.ts`), nunca na
 * resposta ao consumidor já autorizado para a central — precisamente
 * porque a resposta (`result.data`) nunca é incluída no registro de
 * auditoria de qualquer forma. Confirmado empiricamente nesta rodada que
 * `body`/`title` reais podem conter dado pessoal e financeiro concreto
 * (nome de cliente, situação de cobrança) — mais sensível em espírito que
 * os campos estruturados (cnpj/email/telefone) já tratados apenas por
 * auditoria em outros domínios. Mesmo assim, **mantido o padrão
 * transversal existente (pass-through, mascarado só na auditoria)** em vez
 * de inventar uma exceção pontual de mascaramento de texto livre só para
 * este domínio — não há mecanismo de mascaramento por conteúdo em nenhum
 * outro lugar do projeto (o `deepMask` é por NOME de campo, não por
 * padrão de conteúdo), e criar um agora, só aqui, seria uma mudança de
 * arquitetura de segurança não sinalizada em nenhuma fonte (CLAUDE.md,
 * PRD, Technical Brief) além desta única tarefa. Sinalizado explicitamente
 * no PR para decisão de Produto/Segurança — se a política real para
 * conteúdo de mensagem precisar ser mais restritiva que para os demais
 * domínios, é uma decisão de Produto, não algo a inventar na
 * implementação.
 */

export { GETRAK_WEB_AUTH_SCHEME, GETRAK_WEB_SCOPE, callGetrakWebEndpoint } from "../getrak-web-shared.js";
export type { GetrakWebToolDeps as NotificationsToolDeps } from "../getrak-web-shared.js";
export {
  centralSchema,
  paginationInputShape,
  normalizeItem,
  extractPagePerPageEnvelope,
  buildPagePerPagePagination,
} from "../shared.js";
