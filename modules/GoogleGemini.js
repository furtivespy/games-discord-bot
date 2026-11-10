const { GoogleGenAI, HarmCategory, HarmBlockThreshold, Modality } = require("@google/genai");
const { AttachmentBuilder } = require("discord.js");

const formattingInstructions = `The response needs to be broken into chunks of 2000 characters or less.\
use markdown when appropriate, and use the text "||SEPARATE||" to indicate where one chunk ends and another begins.`;
const Identity = `You are Games Bot, a helpful assistant that answers questions about the games we play.`;
const Rules = `Always look up the rules before answering a question. \
Always look at the forums of boardgamegeek.com for any clarification on the rules. \
Try to fully answer the question, not just telling the user where to look. \
If the question is not related to the rules, let the user know that rules are you specialty and answer \ 
helpfully, but keep non-rules answers short and concise.`;

const DISCORD_CONTENT_MAX = 2000;
const SOURCE_LINK_RE = /\[[^\]]*\]\(<[^>]*>\)/g;
const DEFAULT_GEMINI_IMAGE_MODEL = "gemini-3.1-flash-lite-image";
const DEFAULT_GEMINI_RULES_MODEL = "gemini-3.8-flash";
const DEFAULT_IMAGE_TIMEOUT_MS = 45_000;
const BLOCKED_FINISH_REASONS = new Set([
  "SAFETY",
  "IMAGE_SAFETY",
  "BLOCKLIST",
  "PROHIBITED_CONTENT",
  "RECITATION",
  "SPII",
]);

function resolveImageModel(client) {
  const configured = client?.config?.geminiImageModel;
  if (typeof configured === "string" && configured.trim()) {
    return configured.trim();
  }
  return DEFAULT_GEMINI_IMAGE_MODEL;
}

function resolveImageTimeoutMs(client) {
  const raw = Number(client?.config?.geminiImageTimeoutMs);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_IMAGE_TIMEOUT_MS;
}

function withTimeout(promise, ms, message = "Gemini image generation timed out") {
  let timer;
  const work = Promise.resolve(promise);
  // Keep a handler on the original work so a late generateContent rejection
  // after the timeout wins Promise.race is never unhandled.
  work.catch(() => {});
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([work, timeout]).finally(() => {
    clearTimeout(timer);
  });
}

function firstCandidate(result) {
  if (result?.response?.candidates?.length) return result.response.candidates[0];
  if (result?.candidates?.length) return result.candidates[0];
  return null;
}

function truncateToDiscordLimit(text, limit = DISCORD_CONTENT_MAX) {
  if (text.length <= limit) return text;
  if (limit <= 3) return text.slice(0, limit);
  return `${text.slice(0, limit - 3)}...`;
}

function splitByBreaks(text, limit = DISCORD_CONTENT_MAX) {
  if (text.length <= limit) return [text];
  const parts = [];
  let remaining = text;
  while (remaining.length > limit) {
    let cut = remaining.lastIndexOf("\n", limit);
    if (cut < 1) cut = remaining.lastIndexOf(" ", limit);
    let piece;
    if (cut < 1) {
      piece = remaining.slice(0, limit);
      remaining = remaining.slice(limit).trimStart();
    } else {
      piece = remaining.slice(0, cut).trimEnd();
      if (!piece) {
        piece = remaining.slice(0, limit);
        remaining = remaining.slice(limit).trimStart();
      } else {
        remaining = remaining.slice(cut).trimStart();
      }
    }
    parts.push(piece);
  }
  if (remaining) parts.push(remaining);
  return parts;
}

function sourceLinkTokens(text) {
  const tokens = [];
  const re = new RegExp(SOURCE_LINK_RE.source, "g");
  let lastIndex = 0;
  let match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const gap = text.slice(lastIndex, match.index).trim();
      if (gap) tokens.push(...splitByBreaks(gap, DISCORD_CONTENT_MAX));
    }
    tokens.push(match[0]);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    const tail = text.slice(lastIndex).trim();
    if (tail) tokens.push(...splitByBreaks(tail, DISCORD_CONTENT_MAX));
  }
  return tokens;
}

function packTokens(tokens, { limit = DISCORD_CONTENT_MAX, prefix = "" } = {}) {
  const chunks = [];
  let current = "";

  const begin = (token) => {
    if (!prefix) return token;
    const prefixed = `${prefix}${token}`;
    return prefixed.length <= limit ? prefixed : token;
  };

  for (const rawToken of tokens) {
    const token =
      rawToken.length <= limit
        ? rawToken
        : truncateToDiscordLimit(rawToken, limit);
    if (!current) {
      current = begin(token);
      continue;
    }
    const candidate = `${current} ${token}`;
    if (candidate.length <= limit) {
      current = candidate;
    } else {
      chunks.push(current);
      current = begin(token);
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function splitDiscordContent(text, limit = DISCORD_CONTENT_MAX) {
  if (text == null) return [""];
  if (text.length <= limit) return [text];

  const trimmed = String(text).trim();
  if (/^Sources:/i.test(trimmed)) {
    const body = trimmed.replace(/^Sources:\s*/i, "");
    const tokens = sourceLinkTokens(body);
    if (tokens.length) {
      const packed = packTokens(tokens, { limit, prefix: "Sources: " });
      if (packed.length) return packed;
    }
  }

  return splitByBreaks(String(text), limit).map((part) =>
    part.length <= limit ? part : truncateToDiscordLimit(part, limit)
  );
}

function combineDiscordChunks(chunks, limit = DISCORD_CONTENT_MAX) {
  const combined = [];
  let current = "";
  for (const chunk of chunks) {
    for (const piece of splitDiscordContent(chunk, limit)) {
      const potential = current ? `${current}\n\n${piece}` : piece;
      if (potential.length <= limit) {
        current = potential;
      } else {
        if (current) combined.push(current);
        current = piece;
      }
    }
  }
  if (current) combined.push(current);
  return combined.map((chunk) =>
    chunk.length <= limit ? chunk : truncateToDiscordLimit(chunk, limit)
  );
}

function extractInlineImage(result, logger) {
  const promptFeedback =
    result?.promptFeedback || result?.response?.promptFeedback;
  if (promptFeedback?.blockReason) {
    logger?.warn?.(
      `GeminiAI: image prompt blocked (${promptFeedback.blockReason}).`
    );
    return null;
  }

  const candidate = firstCandidate(result);
  if (!candidate) {
    logger?.warn?.("GeminiAI: no image candidate in API response.");
    return null;
  }

  const finish = String(candidate.finishReason || "").toUpperCase();
  if (BLOCKED_FINISH_REASONS.has(finish)) {
    logger?.warn?.(`GeminiAI: image generation blocked (${finish}).`);
    return null;
  }

  const parts = candidate.content?.parts || [];
  for (const part of parts) {
    const inline = part?.inlineData || part?.inline_data;
    if (inline?.data) {
      const buffer = Buffer.from(inline.data, "base64");
      if (buffer.length) {
        return {
          buffer,
          mimeType: inline.mimeType || inline.mime_type || "image/png",
        };
      }
    }
  }

  if (typeof result?.data === "string" && result.data.trim()) {
    const buffer = Buffer.from(result.data, "base64");
    if (buffer.length) {
      return { buffer, mimeType: "image/png" };
    }
  }

  logger?.warn?.("GeminiAI: no image data in API response.");
  return null;
}

const createGeminiAI = (client) => {
    return new GeminiAI(client)
}

class GeminiAI {
  constructor(client) {
      this.client = client
      // 3.0.0 defaults Developer API to v1, but generateContentConfigToMldev
      // still serializes camelCase systemInstruction (plus tools / safetySettings).
      // js-genai#1746: v1 400s Unknown name "systemInstruction". Pin v1beta;
      // we cannot live-test /rules without a key.
      this.AI2 = new GoogleGenAI({
        apiKey: this.client.config.geminiKey,
        apiVersion: "v1beta",
      })
  }

  async answerRulesQuestion(question, gameData = null) {
    const response = await this.AI2.models.generateContent({
        model: DEFAULT_GEMINI_RULES_MODEL,
        contents: await this.addGameToPrompt(question, gameData),
        config: {
          tools: [
            {
              urlContext: {}
            },
            {
              googleSearch: {}
            }            
          ],
          safetySettings: [
            {
              category: HarmCategory.HARM_CATEGORY_HARASSMENT,
              threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
            {
              category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
              threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
            {
              category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
              threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
            {
              category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
              threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
          ],
          systemInstruction: this.getSystemInstructions(gameData)
         }
    })
    console.log(this.getSystemInstructions(gameData))
    const responseText = await this.processResponse(response)
    return responseText
  }

  getSystemInstructions(gameData) {
    const gameInstructions = gameData ? `The user is currently playing ${gameData.gameName}, \
    so the question probably pertains to the rules of the game.` : ''
    const instructions = [Identity, Rules, gameInstructions, formattingInstructions]
    return instructions.join(' ')
  }

  async addGameToPrompt(prompt, gameData) {
    if (!gameData) {
      return prompt
    }
    const linkData = await gameData.LoadUsefulLinks()

    const gameInstructions = `In the game ${gameData.gameName} https://boardgamegeek.com/boardgame/${gameData.gameId}, `
    const links = linkData.links.map(link => `${link.name}: ${link.url}`).join(', ')
    return `${gameInstructions} ${prompt} ${links}`
  }

  async processResponse(result) {
    let responseText = "Error: Could not extract AI response text.";
    let candidate = firstCandidate(result);

    // --- Start: Modified text extraction to concatenate ALL text parts ---
    if (candidate) {
      if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
        const textParts = candidate.content.parts.filter(part =>
          part && typeof part.text === 'string' && part.text.trim() !== ""
        );

        if (textParts.length > 0) {
          // Concatenate the text from all found text parts, separated by a space
          responseText = textParts.map(part => part.text.trim()).join(' ').trim();
        } else {
          this.client.logger.warn("GeminiAI: No suitable text parts found in API response candidate's parts.", { parts: JSON.stringify(candidate.content.parts), candidateKeys: Object.keys(candidate) });
        }
      } else {
        this.client.logger.warn("GeminiAI: API response candidate missing content or parts.", { candidateKeys: Object.keys(candidate), contentKeys: candidate.content ? Object.keys(candidate.content) : 'null' });
      }
    } else {
      this.client.logger.error("GeminiAI: Invalid or incomplete API response structure (no valid candidate found).", { resultKeys: result ? Object.keys(result).join(', ') : 'null' });
    }

    if (responseText.endsWith('||SEPARATE||')) {
      responseText = responseText.slice(0, -12);
    }
  
    if (candidate && candidate.groundingMetadata?.groundingChunks) {
      if (!responseText.includes("||SEPARATE||Sources:") && !responseText.startsWith("Error:")) {
          responseText += "||SEPARATE||Sources: ";
      } else if (!responseText.startsWith("Error:") && !responseText.endsWith(" ")) {
          responseText += " ";
      }
      if (!responseText.startsWith("Error:")) {
          candidate.groundingMetadata.groundingChunks.forEach(chunk => {
            if (!chunk?.web) return;
            responseText += `[${chunk.web.title}](<${chunk.web.uri}>) `;
          });
      }
    }

    const responseChunks = responseText.split('||SEPARATE||').map(chunk => chunk.trim())

    return combineDiscordChunks(responseChunks)
  }

  imageModelName() {
    return resolveImageModel(this.client);
  }

  async generateImage({ prompt, images = [], model, timeoutMs } = {}) {
    const resolvedModel = model || this.imageModelName();
    const parts = [{ text: prompt }];
    for (const image of images) {
      if (!image?.data) continue;
      parts.push({
        inlineData: {
          mimeType: image.mimeType || "image/png",
          data: image.data,
        },
      });
    }

    const response = await withTimeout(
      this.AI2.models.generateContent({
        model: resolvedModel,
        contents: parts,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      }),
      timeoutMs || resolveImageTimeoutMs(this.client)
    );

    return extractInlineImage(response, this.client?.logger);
  }

}

module.exports = {
  createGeminiAI,
  extractInlineImage,
  resolveImageModel,
  resolveImageTimeoutMs,
  withTimeout,
  splitDiscordContent,
  combineDiscordChunks,
  DISCORD_CONTENT_MAX,
  DEFAULT_GEMINI_IMAGE_MODEL,
  DEFAULT_GEMINI_RULES_MODEL,
  DEFAULT_IMAGE_TIMEOUT_MS,
}