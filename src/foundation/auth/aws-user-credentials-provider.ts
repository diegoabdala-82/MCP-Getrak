/**
 * US-046 — Autenticação via token delegado / ED-ID-05.
 * Implementação de produção de `UserCredentialsProvider` sobre AWS Secrets
 * Manager, mesmo padrão de `aws-secrets-provider.ts` (TD-02): um segredo
 * por usuário, acesso via IAM Roles for Tasks.
 *
 * Convenção de nome de segredo: `getrak-mcp/{environment}/oauth2Password/user/{user_id}`.
 * Valor armazenado como JSON: `{client_id, client_secret, username, password, token_url}`.
 */

import {
  GetSecretValueCommand,
  ResourceNotFoundException,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import type { Environment } from "../../config/environment.js";
import { MissingUserCredentialError, type UserCredential, type UserCredentialsProvider } from "./user-credentials-provider.js";

interface RawUserSecretJson {
  client_id: string;
  client_secret: string;
  username: string;
  password: string;
  token_url: string;
}

export class AwsUserCredentialsProvider implements UserCredentialsProvider {
  constructor(private readonly client: SecretsManagerClient = new SecretsManagerClient({})) {}

  async getCredential(environment: Environment, userId: string): Promise<UserCredential> {
    const secretId = buildSecretId(environment, userId);

    let secretString: string | null;
    try {
      const response = await this.client.send(new GetSecretValueCommand({ SecretId: secretId }));
      secretString = response.SecretString ?? null;
    } catch (err) {
      if (err instanceof ResourceNotFoundException) {
        secretString = null;
      } else {
        throw err;
      }
    }

    if (secretString === null) {
      throw new MissingUserCredentialError(environment, userId);
    }

    const parsed = JSON.parse(secretString) as RawUserSecretJson;
    return {
      client_id: parsed.client_id,
      client_secret: parsed.client_secret,
      username: parsed.username,
      password: parsed.password,
      token_url: parsed.token_url,
    };
  }
}

function buildSecretId(environment: Environment, userId: string): string {
  return `getrak-mcp/${environment}/oauth2Password/user/${userId}`;
}
