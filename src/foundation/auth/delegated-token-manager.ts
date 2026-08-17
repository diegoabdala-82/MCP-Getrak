/**
 * US-046 — Autenticação via token delegado por sessão do usuário.
 * US-048 — Cache de tokens em dois namespaces (este é o namespace delegado).
 *
 * Paralelo a `AuthManager` (credencial técnica, Epic 3/5 — não tocado por
 * esta tarefa), mas para o modelo de identidade delegada (TD-05): a
 * credencial usada para obter o token é a do usuário Getrak (login/senha
 * configurados uma vez na conexão MCP), não uma credencial técnica
 * resolvida por ambiente. Mesmo padrão de cache-then-fetch-then-cache do
 * `AuthManager` — uma nova tentativa após expiração do cache já É a
 * renovação exigida pelo AC de US-046 (não precisa de retry-loop dedicado).
 *
 * `central` faz parte do namespace de cache (US-048) — e, ao contrário do
 * que uma versão anterior deste comentário presumia, o token REALMENTE
 * varia por central: confirmado contra uma chamada real fornecida pelo
 * time (16/08/2026), o `username` enviado ao endpoint de emissão é o
 * composto `{username}@{central}`, não o login isolado. Ou seja, a mesma
 * pessoa em duas centrais diferentes é, do ponto de vista da API Core,
 * duas identidades OAuth distintas — o namespace por central não é só
 * isolamento de cache, é correção (tokens de centrais diferentes não são
 * intercambiáveis).
 */

import type { Environment } from "../../config/environment.js";
import { ErrorCodes, McpToolError } from "../../domain/errors.js";
import { normalizeUpstreamTransportError, UpstreamNetworkError, UpstreamTimeoutError } from "../errors/error-normalizer.js";
import type { OAuth2Client } from "./oauth2-client.js";
import { TokenRequestFailedError } from "./oauth2-client.js";
import { buildDelegatedTokenNamespace, TOKEN_EXPIRY_SAFETY_MARGIN_SECONDS, type TokenCache } from "./token-cache.js";
import { MissingUserCredentialError, type UserCredentialsProvider } from "./user-credentials-provider.js";

/**
 * Placeholder até que a API Core disponibilize um identificador real de
 * sessão delegada (ED-ID-02) e/ou o transporte MCP defina uma estrutura de
 * sessão por conexão (GAP em `foundation/identity/consumer-context.ts`).
 * Não bloqueante — o namespace continua correto/isolado por
 * environment+central+user_id mesmo com um session_id fixo, só não
 * distingue múltiplas sessões simultâneas do mesmo usuário ainda.
 */
export const DEFAULT_DELEGATED_SESSION_ID = "default";

export interface GetDelegatedAccessTokenParams {
  environment: Environment;
  central: string;
  userId: string;
  sessionId?: string;
}

export class DelegatedTokenManager {
  constructor(
    private readonly userCredentialsProvider: UserCredentialsProvider,
    private readonly tokenCache: TokenCache,
    private readonly oauth2Client: OAuth2Client,
    private readonly now: () => number = Date.now,
  ) {}

  async getAccessToken(params: GetDelegatedAccessTokenParams): Promise<string> {
    const sessionId = params.sessionId ?? DEFAULT_DELEGATED_SESSION_ID;
    const namespace = buildDelegatedTokenNamespace({
      environment: params.environment,
      central: params.central,
      userId: params.userId,
      sessionId,
    });

    const cached = await this.tokenCache.get(namespace);
    const now = this.now();
    if (cached && cached.expires_at > now) {
      return cached.access_token;
    }

    let credential;
    try {
      credential = await this.userCredentialsProvider.getCredential(params.environment, params.userId);
    } catch (err) {
      throw this.normalizeDelegatedAuthError(err);
    }

    let tokenResponse;
    try {
      tokenResponse = await this.oauth2Client.fetchToken({
        auth_scheme: "oauth2Password",
        client_id: credential.client_id,
        client_secret: credential.client_secret,
        // Confirmado contra chamada real (16/08/2026): o endpoint espera
        // `{username}@{central}`, não o login isolado — ver comentário no
        // topo do arquivo.
        username: `${credential.username}@${params.central}`,
        password: credential.password,
        token_url: credential.token_url,
      });
    } catch (err) {
      throw this.normalizeDelegatedAuthError(err);
    }

    const ttlSeconds = Math.max(tokenResponse.expires_in - TOKEN_EXPIRY_SAFETY_MARGIN_SECONDS, 0);
    const expiresAt = now + ttlSeconds * 1000;

    await this.tokenCache.set(
      namespace,
      { access_token: tokenResponse.access_token, expires_at: expiresAt },
      ttlSeconds,
    );

    return tokenResponse.access_token;
  }

  /**
   * US-046 AC: falha de renovação (credencial de usuário inválida/expirada
   * na API Core) deve sinalizar de forma controlada que o consumidor
   * precisa atualizar a credencial (ED-ID-06) — nunca travar
   * silenciosamente nem tentar indefinidamente. Distinto de falha
   * transitória de rede/timeout, que continua retryable normalmente.
   */
  private normalizeDelegatedAuthError(err: unknown): McpToolError {
    if (err instanceof UpstreamTimeoutError || err instanceof UpstreamNetworkError) {
      return normalizeUpstreamTransportError(err);
    }

    if (err instanceof TokenRequestFailedError) {
      return new McpToolError({
        code: ErrorCodes.USER_CREDENTIAL_INVALID,
        message:
          "The stored user credential was rejected by the Getrak API Core (invalid or expired password). " +
          "Update the user's login/password in the MCP connection configuration.",
        retryable: false,
        upstreamStatus: err.status,
      });
    }

    if (err instanceof MissingUserCredentialError) {
      return new McpToolError({
        code: ErrorCodes.USER_CREDENTIAL_INVALID,
        message: err.message,
        retryable: false,
      });
    }

    if (err instanceof McpToolError) {
      return err;
    }

    return new McpToolError({
      code: ErrorCodes.INTERNAL_ERROR,
      message: "Unexpected internal error while obtaining a delegated user token.",
      retryable: false,
      cause: err,
    });
  }
}
