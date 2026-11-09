const { describe, expect, test } = require("bun:test");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function childEnv(overrides = {}) {
  const env = { ...process.env, ...overrides };
  if (!Object.prototype.hasOwnProperty.call(overrides, "HONEYCOMB_API_KEY")) {
    delete env.HONEYCOMB_API_KEY;
  }
  if (!Object.prototype.hasOwnProperty.call(overrides, "OTEL_DEBUG_SPANS")) {
    delete env.OTEL_DEBUG_SPANS;
  }
  return env;
}

async function runTracingChild(env, source) {
  const proc = Bun.spawn(["bun", "-e", source], {
    cwd: ROOT,
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, output: `${stdout}\n${stderr}`, exitCode };
}

const STUB_HONEYCOMB_FETCH = `
globalThis.fetch = async () => new Response(JSON.stringify({ error: "Unknown API key" }), {
  status: 401,
  headers: { "content-type": "application/json" },
});
`;

describe("OpenTelemetry 0.300 packages", () => {
  test("sdk-trace-base is not installed", () => {
    expect(() => require("@opentelemetry/sdk-trace-base")).toThrow();
  });

  test("sdk-trace exports the processors tracing.js uses", () => {
    const {
      ConsoleSpanExporter,
      SimpleSpanProcessor,
      BatchSpanProcessor,
    } = require("@opentelemetry/sdk-trace");
    expect(typeof ConsoleSpanExporter).toBe("function");
    expect(typeof SimpleSpanProcessor).toBe("function");
    expect(typeof BatchSpanProcessor).toBe("function");
  });

  test("BatchSpanProcessor takes the 0.300 { exporter } options object", () => {
    const {
      BatchSpanProcessor,
      InMemorySpanExporter,
    } = require("@opentelemetry/sdk-trace");
    const processor = new BatchSpanProcessor({
      exporter: new InMemorySpanExporter(),
    });
    expect(processor).toBeDefined();
    return processor.shutdown();
  });
});

describe("tracing.js startup", () => {
  test("disables tracing when HONEYCOMB_API_KEY is unset", async () => {
    const { output, exitCode } = await runTracingChild(
      childEnv(),
      `require("./tracing"); console.log("loaded-ok");`
    );
    expect(exitCode).toBe(0);
    expect(output).toContain("HONEYCOMB_API_KEY not set — OTel tracing disabled");
    expect(output).not.toContain("OTel started");
  });

  test("starts the SDK when a key is set", async () => {
    const { output, exitCode } = await runTracingChild(
      childEnv({ HONEYCOMB_API_KEY: "test-key-not-real" }),
      `${STUB_HONEYCOMB_FETCH}
require("./tracing");
setTimeout(() => {
  console.log("sdk-started-ok");
  process.exit(0);
}, 200);
`
    );
    expect(exitCode).toBe(0);
    expect(output).toContain("OTel started");
    expect(output).toContain("sdk-started-ok");
    expect(output).not.toContain("HONEYCOMB_API_KEY not set");
  });

  test("prints spans through the console exporter when OTEL_DEBUG_SPANS=true", async () => {
    const { output, exitCode } = await runTracingChild(
      childEnv({
        HONEYCOMB_API_KEY: "test-key-not-real",
        OTEL_DEBUG_SPANS: "true",
      }),
      `${STUB_HONEYCOMB_FETCH}
require("./tracing");
const { trace } = require("@opentelemetry/api");
const span = trace.getTracer("fur-159-test").startSpan("fur-159.console-span");
span.setAttribute("verification", true);
span.end();
setTimeout(() => process.exit(0), 200);
`
    );
    expect(exitCode).toBe(0);
    expect(output).toContain("OTEL_DEBUG_SPANS=true — spans will print to console");
    expect(output).toContain("OTel started");
    expect(output).toContain("fur-159.console-span");
    expect(output).toContain("verification: true");
  });
});
