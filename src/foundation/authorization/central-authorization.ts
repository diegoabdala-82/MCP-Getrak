/**
 * US-002 — Isolamento obrigatório por central.
 *
 * `central` pode ser parâmetro de contexto de qualquer tool, mas nunca é
 * aceita livremente: deve ser validada contra as centrais autorizadas do
 * consumidor antes de qualquer chamada à API Core. Uma central por execução,
 * por padrão (Regra de Negócio do PRD). Toda tentativa cross-central deve ser
 * bloqueada e registrada em auditoria.
 */

import { ErrorCodes, McpToolError } from "../../domain/errors.js";
import type { ConsumerContext } from "../identity/consumer-context.js";

/**
 * Resolve a lista de centrais autorizadas para um consumidor.
 *
 * GAP-004 (Backlog, US-002 — Open): o modelo de autorização por central não
 * está detalhado tecnicamente no PRD/Technical Brief ("tratar como
 * Engineering Discovery no refinamento"). Esta interface mantém a fonte de
 * autorização plugável e isolada da lógica de bloqueio em si, para que a
 * definição futura do modelo real (ex.: tabela de permissões, claim de
 * token, serviço de autorização corporativo) não exija reescrever o guard.
 */
export interface CentralAuthorizationProvider {
  getAuthorizedCentrals(consumerId: string): Promise<readonly string[]>;
}

/**
 * Provider provisório baseado em mapa estático de configuração
 * (consumer_id -> centrais autorizadas). Não é o modelo de autorização
 * definitivo (GAP-004 permanece aberto) — serve para permitir o
 * desenvolvimento e teste do guard antes de o modelo real ser definido.
 */
export class StaticCentralAuthorizationProvider implements CentralAuthorizationProvider {
  constructor(private readonly authorizedCentralsByConsumer: Readonly<Record<string, readonly string[]>>) {}

  async getAuthorizedCentrals(consumerId: string): Promise<readonly string[]> {
    return this.authorizedCentralsByConsumer[consumerId] ?? [];
  }
}

export interface AssertCentralAuthorizedParams {
  consumer: ConsumerContext;
  central: string;
}

export class CentralAuthorizationGuard {
  constructor(private readonly provider: CentralAuthorizationProvider) {}

  /**
   * Bloqueia a execução se a central solicitada não estiver entre as
   * centrais autorizadas do consumidor. A gravação em auditoria de toda
   * tentativa bloqueada (US-002 AC; US-005) é responsabilidade de quem chama
   * este guard como parte do pipeline único de execução de tool
   * (`ToolRuntime`) — evita duplicar o registro de auditoria aqui.
   */
  async assertAuthorized(params: AssertCentralAuthorizedParams): Promise<void> {
    const authorizedCentrals = await this.provider.getAuthorizedCentrals(params.consumer.consumer_id);

    if (authorizedCentrals.includes(params.central)) {
      return;
    }

    throw new McpToolError({
      code: ErrorCodes.CENTRAL_NOT_AUTHORIZED,
      message: `Central "${params.central}" is not authorized for this consumer.`,
      retryable: false,
    });
  }
}
