import { actionRequestUrl } from "./handshake";
import {
  CHANNEL_POST_FAILED_NOTICE,
  newActionRequestId,
  readVisualActionResponse,
  visualActionErrorMessage,
  visualHandActionBody,
  type HandActionKind,
} from "./visualActions";
import { shouldApplySnapshot } from "./requestSeq";

export type HandCardActionConfig = {
  apiHost: string;
  mock: boolean;
  channelId: string;
  guildId: string;
};

export type HandCardActionSession = {
  config: HandCardActionConfig;
  accessToken: string;
  guildId: string;
};

export type HandCardActionCard = {
  id?: unknown;
};

export type SubmitHandCardActionHooks = {
  getSession: () => HandCardActionSession | null;
  isActionInFlight: () => boolean;
  selectedChannelId: (requestedChannelId: string) => string;
  setDeckActionsLocked: (locked: boolean) => void;
  setInspectActionError: (message: string | null) => void;
  setActionNotice: (message: string | null) => void;
  closeInspectAfterFailedAction: () => void;
  closeCardInspect: () => void;
  flushDeferredSnapshot: () => void;
  applySnapshot: (
    config: HandCardActionConfig,
    payload: Record<string, unknown>
  ) => void;
  readFixture?: () => string;
  fetchImpl?: typeof fetch;
  requestId?: () => string;
  locationProtocol?: () => string;
  onSettled?: () => void;
};

function failHandAction(
  hooks: SubmitHandCardActionHooks,
  stillThisGame: () => boolean,
  message: string
) {
  hooks.closeInspectAfterFailedAction();
  if (!stillThisGame()) return;
  hooks.setDeckActionsLocked(false);
  hooks.setActionNotice(message);
  hooks.flushDeferredSnapshot();
}

export async function submitHandCardAction(
  kind: HandActionKind,
  card: HandCardActionCard | null | undefined,
  hooks: SubmitHandCardActionHooks
): Promise<void> {
  const session = hooks.getSession();
  const cardId = typeof card?.id === "string" ? card.id.trim() : "";
  if (!session || !cardId) {
    hooks.closeInspectAfterFailedAction();
    hooks.setActionNotice("Could not reach the game.");
    hooks.flushDeferredSnapshot();
    return;
  }
  if (hooks.isActionInFlight()) return;
  const channelId = hooks.selectedChannelId(session.config.channelId);
  const guildId = session.guildId || session.config.guildId;
  const stillRequestedGame = () =>
    shouldApplySnapshot({
      isCurrent: true,
      selectedChannelId: hooks.selectedChannelId(session.config.channelId),
      requestedChannelId: channelId,
    });
  const requestId = hooks.requestId ? hooks.requestId() : newActionRequestId();
  hooks.setDeckActionsLocked(true);
  hooks.setInspectActionError(null);
  const fetchFn = hooks.fetchImpl || fetch;
  const protocol = hooks.locationProtocol
    ? hooks.locationProtocol()
    : typeof window !== "undefined"
      ? window.location.protocol
      : "https:";
  try {
    const response = await fetchFn(
      actionRequestUrl(session.config.apiHost, protocol),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          visualHandActionBody({
            action: kind,
            cardId,
            channelId,
            guildId,
            requestId,
            fixture: session.config.mock ? hooks.readFixture?.() : undefined,
          })
        ),
      }
    );
    const result = await readVisualActionResponse(response);
    if (result.kind !== "snapshot") {
      failHandAction(
        hooks,
        stillRequestedGame,
        visualActionErrorMessage(
          result.payload.error,
          typeof result.payload.message === "string" ? result.payload.message : null
        )
      );
      return;
    }
    if (!stillRequestedGame()) return;
    hooks.closeCardInspect();
    hooks.applySnapshot(session.config, result.payload);
    hooks.setActionNotice(
      result.payload.channelPosted === false ? CHANNEL_POST_FAILED_NOTICE : null
    );
  } catch {
    failHandAction(hooks, stillRequestedGame, visualActionErrorMessage("action_failed"));
  } finally {
    hooks.setDeckActionsLocked(false);
    hooks.onSettled?.();
  }
}
