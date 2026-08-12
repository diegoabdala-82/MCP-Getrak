/**
 * US-001 — Autenticação técnica por ambiente (AC #2) / US-002, US-005, US-007.
 *
 * A identidade do usuário/agente consumidor é resolvida e preservada na
 * camada MCP, independentemente da credencial técnica usada para autenticar
 * na API Core (RF06 / RNF02). São conceitos distintos:
 *   - Identidade de autenticação (API Core): `AuthScheme` + credencial técnica
 *     resolvida por ambiente (ver `foundation/auth`).
 *   - Identidade de autorização/auditoria (MCP): `ConsumerContext` abaixo,
 *     usada para validar central (US-002), filtrar catálogo (US-007) e
 *     registrar auditoria (US-005).
 */

export interface ConsumerContext {
  /** Identificador estável do consumidor/agente na camada MCP. */
  consumer_id: string;
  /** Nome amigável opcional, só para fins de log/observabilidade. */
  display_name?: string;
}

/**
 * Resolve a identidade do consumidor a partir do contexto de conexão MCP.
 *
 * GAP: o mecanismo exato de identificação de conexão (API key, mTLS, header
 * customizado etc.) não está detalhado no PRD/Technical Brief — é um item de
 * Engineering Discovery a resolver durante a integração real de transporte,
 * na mesma categoria de GAP-004 (US-002). Esta interface mantém a resolução
 * de identidade pluggable e isolada, para que a decisão de transporte não
 * vaze para dentro da lógica de negócio das tools.
 */
export interface ConsumerIdentityResolver {
  resolve(connectionContext: unknown): Promise<ConsumerContext>;
}

/**
 * Resolver estático — usa uma identidade fixa (ex.: id de configuração da
 * conexão MCP). Adequado para o piloto de consumidor único (Claude Code)
 * mencionado no PRD; deve ser substituído quando o mecanismo real de
 * identificação por conexão for definido (ver GAP acima).
 */
export class StaticConsumerIdentityResolver implements ConsumerIdentityResolver {
  constructor(private readonly consumer: ConsumerContext) {}

  async resolve(): Promise<ConsumerContext> {
    return this.consumer;
  }
}
