import { describe, expect, it, vi } from "vitest";
import { TokenRequestFailedError } from "../../src/foundation/auth/oauth2-client.js";
import { MultipartFormOAuth2Client } from "../../src/foundation/auth/multipart-oauth2-client.js";

function fakeFetch(response: Response) {
  return vi.fn().mockResolvedValue(response);
}

describe("MultipartFormOAuth2Client — formato real do endpoint de token para o fluxo delegado (GetrakWeb)", () => {
  it("envia o corpo como multipart/form-data (FormData), não x-www-form-urlencoded", async () => {
    const fetchImpl = fakeFetch(new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 }));
    const client = new MultipartFormOAuth2Client(fetchImpl);

    await client.fetchToken({
      auth_scheme: "oauth2Password",
      client_id: "test-client-id",
      client_secret: "test-client-secret",
      username: "test-user@central-1",
      password: "test-pass",
      token_url: "https://api.getrak.com/newkoauth/oauth/token",
    });

    const [, options] = fetchImpl.mock.calls[0];
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get("grant_type")).toBe("password");
    expect(options.body.get("username")).toBe("test-user@central-1");
    expect(options.body.get("password")).toBe("test-pass");
  });

  it("não define Content-Type manualmente (o fetch nativo define o boundary do multipart sozinho)", async () => {
    const fetchImpl = fakeFetch(new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 }));
    const client = new MultipartFormOAuth2Client(fetchImpl);

    await client.fetchToken({
      auth_scheme: "oauth2Password",
      client_id: "cid",
      client_secret: "csecret",
      username: "user@central",
      password: "pass",
      token_url: "https://api.getrak.com/newkoauth/oauth/token",
    });

    const [, options] = fetchImpl.mock.calls[0];
    expect(options.headers["Content-Type"]).toBeUndefined();
  });

  it("autentica o client via HTTP Basic Auth, igual ao modelo técnico", async () => {
    const fetchImpl = fakeFetch(new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 }));
    const client = new MultipartFormOAuth2Client(fetchImpl);

    await client.fetchToken({
      auth_scheme: "oauth2Password",
      client_id: "test-client-id",
      client_secret: "test-client-secret",
      username: "user@central",
      password: "pass",
      token_url: "https://api.getrak.com/newkoauth/oauth/token",
    });

    const [, options] = fetchImpl.mock.calls[0];
    const expectedAuth = `Basic ${Buffer.from("test-client-id:test-client-secret").toString("base64")}`;
    expect(options.headers.Authorization).toBe(expectedAuth);
  });

  it("envia grant_type=client_credentials sem username/password quando o esquema é oauth2ClientCredentials", async () => {
    const fetchImpl = fakeFetch(new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 }));
    const client = new MultipartFormOAuth2Client(fetchImpl);

    await client.fetchToken({
      auth_scheme: "oauth2ClientCredentials",
      client_id: "cid",
      client_secret: "csecret",
      token_url: "https://api.getrak.com/newkoauth/oauth/token",
    });

    const [, options] = fetchImpl.mock.calls[0];
    expect(options.body.get("grant_type")).toBe("client_credentials");
    expect(options.body.get("username")).toBeNull();
  });

  it("lança TokenRequestFailedError com o status HTTP quando o token endpoint rejeita a credencial", async () => {
    const fetchImpl = fakeFetch(new Response(null, { status: 401 }));
    const client = new MultipartFormOAuth2Client(fetchImpl);

    const promise = client.fetchToken({
      auth_scheme: "oauth2Password",
      client_id: "cid",
      client_secret: "wrong",
      username: "user@central",
      password: "wrong",
      token_url: "https://api.getrak.com/newkoauth/oauth/token",
    });

    await expect(promise).rejects.toBeInstanceOf(TokenRequestFailedError);
    await expect(promise).rejects.toMatchObject({ status: 401 });
  });
});
