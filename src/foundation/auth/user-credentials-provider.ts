/**
 * US-046 — Autenticação via token delegado por sessão do usuário.
 *
 * Resolve a credencial do usuário Getrak (login/senha) usada para obter o
 * token delegado (`oauth2Password`), a partir da configuração da conexão
 * MCP — nunca do agente de IA, nunca em tempo de execução de uma tool.
 *
 * ED-ID-05 (Open, não bloqueante — mecanismo exato de coleta/armazenamento
 * da credencial de usuário ainda não é decisão fechada de produto):
 * implementado aqui com o mínimo necessário para funcionar em homologação,
 * espelhando exatamente o mesmo padrão já usado para credenciais técnicas
 * (`secrets-provider.ts` / `aws-secrets-provider.ts`) — variável de
 * ambiente por usuário em desenvolvimento local, AWS Secrets Manager (um
 * segredo por usuário) em produção. Não é uma UI de login; é configuração
 * de conexão, como já decidido em US-046 Business Rules / Out of Scope.
 *
 * O shape do segredo é idêntico ao de `PasswordGrantSecret` (client_id/
 * client_secret da aplicação OAuth do MCP + username/password do usuário
 * Getrak + token_url) — client_id/client_secret aqui identificam o cliente
 * OAuth (RFC 6749 §2.3.1, Basic Auth), não o usuário; presumivelmente os
 * mesmos em todas as credenciais de usuário de um mesmo ambiente, mas
 * armazenados por segredo para não acoplar a essa suposição.
 */

import type { Environment } from "../../config/environment.js";
import type { PasswordGrantSecret } from "./types.js";

export type UserCredential = Omit<PasswordGrantSecret, "auth_scheme">;

export class MissingUserCredentialError extends Error {
  constructor(environment: Environment, userId: string) {
    super(
      `No delegated user credential configured for user "${userId}" in environment "${environment}". ` +
        `The user must (re)configure their Getrak login in the MCP connection settings.`,
    );
    this.name = "MissingUserCredentialError";
  }
}

export interface UserCredentialsProvider {
  getCredential(environment: Environment, userId: string): Promise<UserCredential>;
}

/**
 * Implementação de referência local/dev — variáveis de ambiente do
 * processo do servidor MCP, mesma convenção de `EnvSecretsProvider`:
 * `GETRAK_MCP_{ENVIRONMENT}_OAUTH2PASSWORD_USER_{USER_ID}_{FIELD}`.
 */
export class EnvUserCredentialsProvider implements UserCredentialsProvider {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  async getCredential(environment: Environment, userId: string): Promise<UserCredential> {
    const prefix = `GETRAK_MCP_${environment.toUpperCase()}_OAUTH2PASSWORD_USER_${sanitizeForEnvVar(userId)}`;

    const clientId = this.env[`${prefix}_CLIENT_ID`];
    const clientSecret = this.env[`${prefix}_CLIENT_SECRET`];
    const username = this.env[`${prefix}_USERNAME`];
    const password = this.env[`${prefix}_PASSWORD`];
    const tokenUrl = this.env[`${prefix}_TOKEN_URL`];

    if (!clientId || !clientSecret || !username || !password || !tokenUrl) {
      throw new MissingUserCredentialError(environment, userId);
    }

    return { client_id: clientId, client_secret: clientSecret, username, password, token_url: tokenUrl };
  }
}

function sanitizeForEnvVar(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "_");
}
