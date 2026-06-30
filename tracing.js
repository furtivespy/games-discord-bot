const { NodeSDK } = require("@opentelemetry/sdk-node");
const { OTLPTraceExporter } = require("@opentelemetry/exporter-trace-otlp-http");
const {
  ConsoleSpanExporter,
  SimpleSpanProcessor,
  BatchSpanProcessor,
} = require("@opentelemetry/sdk-trace-base");
const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node");
const { trace, context, SpanStatusCode } = require("@opentelemetry/api");

const apiKey = process.env.HONEYCOMB_API_KEY;
const serviceName = process.env.OTEL_SERVICE_NAME ?? "discord-bot-inis";
const debugSpans = process.env.OTEL_DEBUG_SPANS === "true";

if (!apiKey) {
  console.warn("[tracing] HONEYCOMB_API_KEY not set — OTel tracing disabled");
} else {
  // Always register the OTLP exporter explicitly so the SDK never receives an
  // empty spanProcessors array (which would silently skip TracerProvider setup).
  const otlpExporter = new OTLPTraceExporter({
    url: "https://api.honeycomb.io/v1/traces",
    headers: { "x-honeycomb-team": apiKey },
  });

  const spanProcessors = [new BatchSpanProcessor(otlpExporter)];

  if (debugSpans) {
    spanProcessors.push(new SimpleSpanProcessor(new ConsoleSpanExporter()));
    console.log("[tracing] OTEL_DEBUG_SPANS=true — spans will print to console");
  }

  const sdk = new NodeSDK({
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

  // Verify the API key and network path to Honeycomb at startup so
  // misconfiguration is surfaced immediately rather than silently dropping spans.
  fetch("https://api.honeycomb.io/1/auth", {
    headers: { "X-Honeycomb-Team": apiKey },
    signal: AbortSignal.timeout(8000),
  })
    .then(async (res) => {
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const team = data.team?.name ?? "unknown";
        const env = data.environment?.name ?? data.key_type ?? "unknown";
        console.log(
          `[tracing] Honeycomb reachable ✓  team="${team}"  environment="${env}"`
        );
      } else {
        const body = await res.text().catch(() => "");
        console.warn(
          `[tracing] Honeycomb auth check failed: HTTP ${res.status} — traces will be dropped. Response: ${body.slice(0, 200)}`
        );
      }
    })
    .catch((err) => {
      console.warn(
        `[tracing] Honeycomb unreachable: ${err.message} — check HONEYCOMB_API_KEY and network. Traces will be dropped.`
      );
    });

  // Patch @discordjs/rest so Discord API calls appear as child spans.
  // We patch queueRequest (the real implementation) rather than request()
  // to ensure we capture deferReply's interaction callback, which can bypass
  // the request() wrapper in some Discord.js versions.
  // REST.generateRouteData gives us clean parameterized routes like
  // /interactions/:id/:token/callback instead of raw token-laden URLs.
  try {
    const { REST } = require("@discordjs/rest");
    const discordRestTracer = trace.getTracer("discord-bot:rest");
    const originalQueueRequest = REST.prototype.queueRequest;
    REST.prototype.queueRequest = async function patchedQueueRequest(options) {
      const method = options.method ?? "UNKNOWN";
      const routeData = REST.generateRouteData(options.fullRoute, method);
      const route = routeData.bucketRoute ?? options.fullRoute ?? "unknown";

      // The periodic client.application.fetch() call hits GET /applications/@me every 60 s.
      // It has no parent span and adds heartbeat noise to every trace view — drop it.
      if (method === "GET" && route === "/applications/@me") {
        return originalQueueRequest.apply(this, arguments);
      }

      return discordRestTracer.startActiveSpan(
        `discord.rest ${method} ${route}`,
        async (span) => {
          span.setAttributes({
            "discord.rest.method": method,
            "discord.rest.route": route,
          });
          try {
            return await originalQueueRequest.apply(this, arguments);
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
