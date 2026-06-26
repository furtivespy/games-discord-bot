const { NodeSDK } = require("@opentelemetry/sdk-node");
const { OTLPTraceExporter } = require("@opentelemetry/exporter-trace-otlp-http");
const { ConsoleSpanExporter, SimpleSpanProcessor } = require("@opentelemetry/sdk-trace-base");
const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node");
const { trace, context, SpanStatusCode } = require("@opentelemetry/api");

const apiKey = process.env.HONEYCOMB_API_KEY;
const serviceName = process.env.OTEL_SERVICE_NAME ?? "discord-bot-inis";
const debugSpans = process.env.OTEL_DEBUG_SPANS === "true";

if (!apiKey) {
  console.warn("[tracing] HONEYCOMB_API_KEY not set — OTel tracing disabled");
} else {
  const spanProcessors = [];

  if (debugSpans) {
    spanProcessors.push(new SimpleSpanProcessor(new ConsoleSpanExporter()));
    console.log("[tracing] OTEL_DEBUG_SPANS=true — spans will print to console");
  }

  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({
      url: "https://api.honeycomb.io/v1/traces",
      headers: {
        "x-honeycomb-team": apiKey,
      },
    }),
    spanProcessors,
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-http": { enabled: true },
        "@opentelemetry/instrumentation-undici": { enabled: true },
        "@opentelemetry/instrumentation-dns": { enabled: false },
        "@opentelemetry/instrumentation-fs": { enabled: false },
      }),
    ],
  });

  sdk.start();

  // Patch @discordjs/rest so Discord API calls appear as child spans.
  // Undici auto-instrumentation doesn't fire under Bun, so we instrument
  // REST.prototype.request directly — all deferReply/editReply/followUp/etc.
  // flow through this single method.
  try {
    const { REST } = require("@discordjs/rest");
    const discordRestTracer = trace.getTracer("discord-bot:rest");
    const originalRequest = REST.prototype.request;
    REST.prototype.request = async function patchedRequest(options) {
      const method = options.method ?? "UNKNOWN";
      const route = options.fullRoute ?? options.route ?? "unknown";
      return discordRestTracer.startActiveSpan(
        `discord.rest ${method} ${route}`,
        async (span) => {
          span.setAttributes({
            "discord.rest.method": method,
            "discord.rest.route": route,
          });
          try {
            return await originalRequest.apply(this, arguments);
          } catch (err) {
            span.recordError(err);
            span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
            throw err;
          } finally {
            span.end();
          }
        }
      );
    };
    console.log("[tracing] Discord REST patched");
  } catch (err) {
    console.warn("[tracing] Could not patch @discordjs/rest:", err.message);
  }

  console.log(`[tracing] OTel started — service=${serviceName} → Honeycomb`);

  process.on("SIGTERM", () => {
    sdk.shutdown().finally(() => process.exit(0));
  });
  process.on("SIGINT", () => {
    sdk.shutdown().finally(() => process.exit(0));
  });
}
