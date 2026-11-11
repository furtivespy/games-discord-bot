import { MOCK_OAUTH_CODE, MOCK_USER } from "./mockFixtures";

export type MockDiscordSdkOptions = {
  clientId?: string;
  channelId?: string;
  guildId?: string;
};

/**
 * Local stand-in for the Discord Embedded App SDK surface this client uses.
 * It does not speak Discord's Activity iframe / postMessage protocol.
 */
export class MockDiscordSDK {
  readonly clientId: string;
  readonly channelId: string;
  readonly guildId: string;
  readonly commands: {
    authorize: (args: unknown) => Promise<{ code: string }>;
    authenticate: (args: { access_token: string }) => Promise<{
      access_token: string;
      user: {
        id: string;
        username: string;
        global_name: string;
      };
    }>;
  };

  constructor(clientId: string, options: MockDiscordSdkOptions = {}) {
    this.clientId = clientId || options.clientId || "mock-client-id";
    this.channelId = String(options.channelId || "").trim();
    this.guildId = String(options.guildId || "").trim();
    this.commands = {
      authorize: async () => ({ code: MOCK_OAUTH_CODE }),
      authenticate: async ({ access_token }) => ({
        access_token,
        user: {
          id: MOCK_USER.id,
          username: MOCK_USER.username,
          global_name: MOCK_USER.global_name,
        },
      }),
    };
  }

  async ready(): Promise<void> {
    return undefined;
  }
}
