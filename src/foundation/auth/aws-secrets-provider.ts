/**
 * US-001 — Autenticação técnica por ambiente / TD-02 — Hospedagem e gestão
 * de segredos. Implementação de produção do `SecretsProvider` sobre AWS
 * Secrets Manager, criptografado com AWS KMS. Acesso via IAM Roles for
 * Tasks — este módulo nunca recebe nem usa credenciais AWS estáticas; a
 * autenticação com a AWS é resolvida pelo SDK a partir da role da task ECS.
 *
 * Convenção de nome de segredo: `getrak-mcp/{environment}/{auth_scheme}`,
 * com o valor armazenado como JSON contendo os campos exigidos por
 * `AuthSecret` (client_id, client_secret, token_url e, para
 * oauth2Password, username/password).
 */

import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import type { Environment } from "../../config/environment.js";
import { MissingSecretError } from "./secrets-provider.js";
import type { SecretsProvider } from "./secrets-provider.js";
import type { AuthScheme, AuthSecret } from "./types.js";

interface RawSecretJson {
  client_id: string;
  client_secret: string;
  token_url: string;
  username?: string;
  password?: string;
}

export class AwsSecretsManagerProvider implements SecretsProvider {
  constructor(private readonly client: SecretsManagerClient = new SecretsManagerClient({})) {}

  async getSecret(environment: Environment, authScheme: AuthScheme): Promise<AuthSecret> {
    const secretId = buildSecretId(environment, authScheme);
    const response = await this.client.send(new GetSecretValueCommand({ SecretId: secretId }));

    if (!response.SecretString) {
      throw new MissingSecretError(environment, authScheme, secretId);
    }

    const parsed = JSON.parse(response.SecretString) as RawSecretJson;

    if (authScheme === "oauth2ClientCredentials") {
      return {
        auth_scheme: "oauth2ClientCredentials",
        client_id: parsed.client_id,
        client_secret: parsed.client_secret,
        token_url: parsed.token_url,
      };
    }

    if (!parsed.username || !parsed.password) {
      throw new MissingSecretError(environment, authScheme, `${secretId} (username/password)`);
    }

    return {
      auth_scheme: "oauth2Password",
      client_id: parsed.client_id,
      client_secret: parsed.client_secret,
      username: parsed.username,
      password: parsed.password,
      token_url: parsed.token_url,
    };
  }
}

function buildSecretId(environment: Environment, authScheme: AuthScheme): string {
  return `getrak-mcp/${environment}/${authScheme}`;
}
