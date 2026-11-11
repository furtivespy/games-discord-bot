export const MOCK_OAUTH_CODE = "mock-oauth-code";

export const MOCK_USER = {
  id: "mock-user-1",
  username: "qatester",
  global_name: "QA Tester",
} as const;

export const DEFAULT_MOCK_CHANNEL_ID = "mock-channel";
export const DEFAULT_MOCK_GUILD_ID = "mock-guild";

export const SNAPSHOT_FIXTURES = [
  "populated",
  "no-game",
  "not-a-player",
] as const;

export const GAME_LIST_FIXTURES = [
  "several-games",
  "one-game",
  "no-games",
] as const;

export type SnapshotFixture = (typeof SNAPSHOT_FIXTURES)[number];
export type GameListFixture = (typeof GAME_LIST_FIXTURES)[number];

export function isSnapshotFixture(value: string): value is SnapshotFixture {
  return (SNAPSHOT_FIXTURES as readonly string[]).includes(value);
}

export function isGameListFixture(value: string): value is GameListFixture {
  return (GAME_LIST_FIXTURES as readonly string[]).includes(value);
}
