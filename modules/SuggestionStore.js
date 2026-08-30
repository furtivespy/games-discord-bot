const { nanoid } = require("nanoid");

const GLOBAL_SUGGEST_SCOPE = "global";
const SUGGEST_COLLECTION = "suggest";
const SUGGEST_CHANNEL = "x";

const SUGGESTION_STATUS = {
  SUGGESTED: "SUGGESTED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  REJECTED: "REJECTED",
};

const STATUS_RANK = {
  [SUGGESTION_STATUS.REJECTED]: 1,
  [SUGGESTION_STATUS.SUGGESTED]: 2,
  [SUGGESTION_STATUS.COMPLETED]: 3,
  [SUGGESTION_STATUS.IN_PROGRESS]: 4,
};

const defaultSuggestion = {
  id: "",
  user: "",
  userId: "",
  suggestion: "",
  status: SUGGESTION_STATUS.SUGGESTED,
  votes: {
    count: 0,
    voters: [],
  },
  createdAt: null,
  updatedAt: null,
  sourceGuildIds: [],
};

function normalizeSuggestionText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function suggestionKey(suggestion) {
  return normalizeSuggestionText(suggestion?.suggestion);
}

function toTime(value) {
  if (!value) return NaN;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? NaN : time;
}

function earlierDate(a, b) {
  const aTime = toTime(a);
  const bTime = toTime(b);
  if (Number.isNaN(aTime)) return b || a || null;
  if (Number.isNaN(bTime)) return a;
  return aTime <= bTime ? a : b;
}

function laterDate(a, b) {
  const aTime = toTime(a);
  const bTime = toTime(b);
  if (Number.isNaN(aTime)) return b || a || null;
  if (Number.isNaN(bTime)) return a;
  return aTime >= bTime ? a : b;
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => value != null && value !== ""))].map(String);
}

function pickStatus(a, b) {
  const aRank = STATUS_RANK[a] || 0;
  const bRank = STATUS_RANK[b] || 0;
  return aRank >= bRank ? a || b : b || a;
}

function mergeVoters(a, b) {
  const voters = uniqueStrings([
    ...(a?.votes?.voters || []),
    ...(b?.votes?.voters || []),
  ]);
  return { count: voters.length, voters };
}

function ensureSuggestionShape(raw) {
  const now = new Date();
  const source = raw && typeof raw === "object" ? raw : {};
  const votes = source.votes && Array.isArray(source.votes.voters)
    ? {
        voters: uniqueStrings(source.votes.voters),
        count: uniqueStrings(source.votes.voters).length,
      }
    : { count: 0, voters: [] };

  return {
    ...defaultSuggestion,
    ...source,
    id: source.id || nanoid(),
    user: source.user || "Unknown User",
    userId: source.userId || "",
    suggestion: source.suggestion || "",
    status: source.status || SUGGESTION_STATUS.SUGGESTED,
    votes,
    createdAt: source.createdAt || now,
    updatedAt: source.updatedAt || source.createdAt || now,
    sourceGuildIds: uniqueStrings(source.sourceGuildIds || []),
  };
}

function mergeTwoSuggestions(a, b) {
  const left = ensureSuggestionShape(a);
  const right = ensureSuggestionShape(b);
  const keepLongerText =
    String(left.suggestion || "").length >= String(right.suggestion || "").length
      ? left.suggestion
      : right.suggestion;

  return {
    ...left,
    id: left.id || right.id,
    user: left.user && left.user !== "Unknown User" ? left.user : right.user,
    userId: left.userId || right.userId,
    suggestion: keepLongerText,
    status: pickStatus(left.status, right.status),
    votes: mergeVoters(left, right),
    createdAt: earlierDate(left.createdAt, right.createdAt),
    updatedAt: laterDate(left.updatedAt, right.updatedAt),
    sourceGuildIds: uniqueStrings([
      ...(left.sourceGuildIds || []),
      ...(right.sourceGuildIds || []),
    ]),
  };
}

function consolidateSuggestions(lists) {
  const byId = new Map();
  const withoutId = [];

  for (const list of lists || []) {
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      if (!raw || typeof raw !== "object") continue;
      const shaped = ensureSuggestionShape(raw);
      if (!shaped.suggestion) continue;
      if (shaped.id && byId.has(shaped.id)) {
        byId.set(shaped.id, mergeTwoSuggestions(byId.get(shaped.id), shaped));
      } else if (shaped.id) {
        byId.set(shaped.id, shaped);
      } else {
        withoutId.push(shaped);
      }
    }
  }

  const byText = new Map();
  for (const suggestion of [...byId.values(), ...withoutId]) {
    const key = suggestionKey(suggestion);
    if (!key) continue;
    if (byText.has(key)) {
      byText.set(key, mergeTwoSuggestions(byText.get(key), suggestion));
    } else {
      byText.set(key, suggestion);
    }
  }

  return [...byText.values()];
}

function findMatchingSuggestion(suggestions, text) {
  const key = normalizeSuggestionText(text);
  if (!key) return null;
  return (suggestions || []).find((suggestion) => suggestionKey(suggestion) === key) || null;
}

function isGlobalSuggestDocument(doc) {
  return (
    String(doc.guildId) === GLOBAL_SUGGEST_SCOPE &&
    String(doc.channelId) === SUGGEST_CHANNEL
  );
}

async function loadGlobalSuggestions(client) {
  const stored =
    (await client.getGameDataV2(
      GLOBAL_SUGGEST_SCOPE,
      SUGGEST_COLLECTION,
      SUGGEST_CHANNEL
    )) || {};

  const lists = [Array.isArray(stored.suggestions) ? stored.suggestions : []];
  const staleDocs = [];

  const documents = client.db?.listDocumentsByCollection?.(SUGGEST_COLLECTION) || [];
  for (const doc of documents) {
    if (isGlobalSuggestDocument(doc)) continue;
    const suggestions = Array.isArray(doc.data?.suggestions) ? doc.data.suggestions : [];
    if (suggestions.length > 0) {
      lists.push(
        suggestions.map((suggestion) => ({
          ...suggestion,
          sourceGuildIds: uniqueStrings([
            ...(suggestion.sourceGuildIds || []),
            doc.guildId,
          ]),
        }))
      );
    }
    staleDocs.push(doc);
  }

  const suggestions = consolidateSuggestions(lists);
  const result = {
    suggestions,
    consolidated: true,
  };

  const shouldPersist =
    staleDocs.length > 0 || stored.consolidated !== true || !Array.isArray(stored.suggestions);

  if (shouldPersist) {
    await saveGlobalSuggestions(client, result);
    for (const doc of staleDocs) {
      client.db.deleteGameData(doc.guildId, SUGGEST_COLLECTION, doc.channelId);
    }
  }

  return result;
}

async function saveGlobalSuggestions(client, data) {
  await client.setGameDataV2(
    GLOBAL_SUGGEST_SCOPE,
    SUGGEST_COLLECTION,
    SUGGEST_CHANNEL,
    {
      suggestions: data.suggestions || [],
      consolidated: true,
    }
  );
}

module.exports = {
  GLOBAL_SUGGEST_SCOPE,
  SUGGEST_COLLECTION,
  SUGGEST_CHANNEL,
  SUGGESTION_STATUS,
  defaultSuggestion,
  normalizeSuggestionText,
  suggestionKey,
  ensureSuggestionShape,
  mergeTwoSuggestions,
  consolidateSuggestions,
  findMatchingSuggestion,
  loadGlobalSuggestions,
  saveGlobalSuggestions,
};
