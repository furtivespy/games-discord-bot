const { NodeSDK } = require("@opentelemetry/sdk-node");
const { OTLPTraceExporter } = require("@opentelemetry/exporter-trace-otlp-http");
const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node");

const apiKey = process.env.HONEYCOMB_API_KEY;

if (!apiKey) {
  console.warn("[tracing] HONEYCOMB_API_KEY not set — OTel tracing disabled");
} else {
  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({
      url: "https://api.honeycomb.io/v1/traces",
      headers: {
        "x-honeycomb-team": apiKey,
      },
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // http instrumentation picks up outbound fetch/http calls
        "@opentelemetry/instrumentation-http": { enabled: true },
        // DNS can be noisy — disable
        "@opentelemetry/instrumentation-dns": { enabled: false },
        // fs can be extremely noisy — disable
        "@opentelemetry/instrumentation-fs": { enabled: false },
      }),
    ],
  });

  sdk.start();
  console.log("[tracing] OTel tracing started → Honeycomb");

  process.on("SIGTERM", () => {
    sdk.shutdown().finally(() => process.exit(0));
  });
  process.on("SIGINT", () => {
    sdk.shutdown().finally(() => process.exit(0));
  });
}
