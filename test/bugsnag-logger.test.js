const { describe, expect, test } = require("bun:test");
const http = require("http");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const API_KEY = "0123456789abcdef0123456789abcdef";

function childEnv() {
  return { ...process.env };
}

function spawnLoggerChild(source) {
  const proc = Bun.spawn(["bun", "-e", source], {
    cwd: ROOT,
    env: childEnv(),
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdoutP = new Response(proc.stdout).text();
  const stderrP = new Response(proc.stderr).text();
  return {
    proc,
    async finish() {
      const [stdout, stderr, exitCode] = await Promise.all([
        stdoutP,
        stderrP,
        proc.exited,
      ]);
      return { stdout, stderr, output: `${stdout}\n${stderr}`, exitCode };
    },
  };
}

async function runLoggerChild(source) {
  return spawnLoggerChild(source).finish();
}

async function waitUntil(predicate, timeoutMs, message) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(message);
}

function startCaptureServer() {
  const requests = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      requests.push({
        url: req.url,
        method: req.method,
        headers: req.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      });
      res.writeHead(200);
      res.end("{}");
    });
  });

  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        requests,
        port,
        notifyUrl: `http://127.0.0.1:${port}/notify`,
        sessionsUrl: `http://127.0.0.1:${port}/sessions`,
        notifyEvents() {
          return requests
            .filter((request) => request.url === "/notify")
            .map((request) => ({
              ...request,
              payload: JSON.parse(request.body),
            }));
        },
        close() {
          return new Promise((done) => server.close(done));
        },
      });
    });
    server.on("error", reject);
  });
}

function loggerStartSource(capture, extraLines = "") {
  return `
const logger = require("./modules/BugsnagLogger.js")({
  apiKey: ${JSON.stringify(API_KEY)},
  endpoints: {
    notify: ${JSON.stringify(capture.notifyUrl)},
    sessions: ${JSON.stringify(capture.sessionsUrl)},
  },
  autoTrackSessions: false,
  logger: { debug() {}, info() {}, warn() {}, error() {} },
  ${extraLines}
});
`;
}

describe("@bugsnag/js 9.1.0", () => {
  test("package.json and the installed module are 9.1.0", () => {
    expect(require("../package.json").dependencies["@bugsnag/js"]).toBe("9.1.0");
    expect(require("@bugsnag/js/package.json").version).toBe("9.1.0");
  });
});

describe("BugsnagLogger notify and uncaught errors", () => {
  test(
    "logger.error with a key set posts a notify payload to the mocked transport",
    async () => {
      const capture = await startCaptureServer();
      try {
        const child = spawnLoggerChild(`
${loggerStartSource(capture, "autoDetectErrors: false,")}
logger.error(new Error("handled notify from test"));
setTimeout(() => process.exit(0), 8000);
`);
        await waitUntil(
          () => capture.notifyEvents().length > 0,
          5000,
          "Bugsnag notify never reached the mocked transport"
        );
        child.proc.kill();
        await child.finish();
        const [event] = capture.notifyEvents();
        expect(event).toBeDefined();
        expect(event.headers["bugsnag-api-key"]).toBe(API_KEY);
        expect(event.headers["bugsnag-payload-version"]).toBe("4");
        expect(event.payload.apiKey).toBe(API_KEY);
        expect(event.payload.notifier.version).toBe("9.1.0");
        const exception = event.payload.events[0].exceptions[0];
        expect(exception.errorClass).toBe("Error");
        expect(exception.errorMessage).toBe("handled notify from test");
        expect(event.payload.events[0].unhandled).toBe(false);
      } finally {
        await capture.close();
      }
    },
    { timeout: 10000 }
  );

  test(
    "an uncaught error is reported and the process exits",
    async () => {
      const capture = await startCaptureServer();
      try {
        const { exitCode } = await runLoggerChild(`
${loggerStartSource(capture)}
setImmediate(() => {
  throw new Error("uncaught boom from test");
});
`);
        expect(exitCode).toBe(1);
        const [event] = capture.notifyEvents();
        expect(event).toBeDefined();
        expect(event.headers["bugsnag-api-key"]).toBe(API_KEY);
        const reported = event.payload.events[0];
        expect(reported.unhandled).toBe(true);
        expect(reported.severityReason).toEqual({ type: "unhandledException" });
        expect(reported.exceptions[0].errorMessage).toBe("uncaught boom from test");
      } finally {
        await capture.close();
      }
    },
    { timeout: 10000 }
  );
});
