#!/usr/bin/env bun
"use strict";

// control-gamebot: one entry point for an agent (or you) to verify a change.
//
//   bun run control doctor
//   bun run control map [command] [--check | --write]
//   bun run control execute <fixture.js> [--contains text]
//   bun run control dev [--stop] [--port 3000]
//   bun run control browse [--path "/?fixture=no-games"] [--out file.png]
//   bun run control health [--origin url] [--sha commit] [--wait]
//
// Add --json to any command for machine-readable output. Exit code 0 means the
// command succeeded; 1 means a check failed; 2 means it was called wrong.

const { parseArgs } = require("node:util");

const USAGE = `Usage: bun run control <command> [options] [--json]

Commands:
  doctor                      Check this machine can produce trustworthy results
  map [command]               Print the Feature Map (or one command's entry)
  map --check                 Fail when INDEX.md or notes.md drifted from the code
  map --write                 Regenerate docs/feature-map/INDEX.md
  execute <fixture.js>        Run a fixture through the real slash-command code
      --contains <text>       Fail unless a reply includes the text
  dev [--stop] [--port n]     Start (or reuse) the embedded Activity in mock mode
  browse                      Screenshot the mock Activity with headless Chrome/Edge
      --path <p>              Default "/?fixture=several-games&game=newest-thread"
      --out <file>            Default tmp/control-gamebot/<path>.png
  health                      Which commit is the bot serving?
      --origin <url>          Default https://gamebot.willsullivan.dev
      --sha <commit>          Exit 1 unless that commit is running (or contained in it)
      --wait                  Poll until it is, like the post-merge deploy check
`;

class UsageError extends Error {}

function parse(argv) {
  return parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      json: { type: "boolean" },
      check: { type: "boolean" },
      write: { type: "boolean" },
      contains: { type: "string" },
      stop: { type: "boolean" },
      port: { type: "string" },
      path: { type: "string" },
      out: { type: "string" },
      origin: { type: "string" },
      sha: { type: "string" },
      wait: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });
}

// Each handler returns { ok, data, text }. `text` is the human output.
const handlers = {
  async doctor() {
    const { runDoctor, formatDoctor } = require("./control/doctor");
    const report = runDoctor();
    return { ok: report.ok, data: report, text: formatDoctor(report) };
  },

  async map({ values, positionals }) {
    const featureMap = require("./control/featureMap");
    if (values.write) {
      const file = featureMap.writeIndex();
      return { ok: true, data: { wrote: file }, text: `Wrote ${file}` };
    }
    if (values.check) {
      const problems = featureMap.check();
      return {
        ok: problems.length === 0,
        data: { problems },
        text: problems.length ? problems.map((p) => `- ${p}`).join("\n") : "Feature Map is in sync.",
      };
    }
    const name = positionals[1];
    if (name) {
      const text = featureMap.describeFeature(name);
      if (!text) {
        const known = featureMap.loadCommands().map((c) => c.name).join(", ");
        return { ok: false, data: { error: `No slash command "${name}"` }, text: `No slash command "${name}". Known: ${known}` };
      }
      return { ok: true, data: { command: name, text }, text };
    }
    const commands = featureMap.loadCommands();
    return {
      ok: true,
      data: { commands },
      text: commands.map((c) => `/${c.name}  ${c.description}`).join("\n"),
    };
  },

  async execute({ values, positionals }) {
    const file = positionals[1];
    if (!file) throw new UsageError("execute needs a fixture file, e.g. scripts/control-fixtures/roll.js");
    const { runFixtureFile, formatSummary, allText } = require("./control/execute");
    const { results, returned } = await runFixtureFile(file);
    const problems = [];
    for (const result of results) {
      for (const entry of result.logged) {
        problems.push(`${result.command} logged ${entry.level}: ${entry.message.split("\n")[0]}`);
      }
    }
    if (values.contains && !allText(results).includes(values.contains)) {
      problems.push(`No reply contained ${JSON.stringify(values.contains)}`);
    }
    const text = [
      ...results.map(formatSummary),
      returned === undefined ? null : `fixture returned: ${JSON.stringify(returned)}`,
      problems.length ? `\nPROBLEMS\n${problems.map((p) => `- ${p}`).join("\n")}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    return { ok: problems.length === 0, data: { results, returned, problems }, text };
  },

  async dev({ values }) {
    const { startDev, stopDev } = require("./control/dev");
    if (values.stop) {
      const result = stopDev();
      return { ok: true, data: result, text: result.stopped ? `Stopped pid ${result.pid}` : "No dev server was started by control." };
    }
    const result = await startDev({ port: values.port ? Number(values.port) : undefined });
    return {
      ok: result.ok,
      data: result,
      text: result.ok
        ? `${result.started ? "Started" : "Reusing"} mock Activity at ${result.origin} (try ${result.origin}/?fixture=several-games)`
        : result.error,
    };
  },

  async browse({ values }) {
    const { browse } = require("./control/dev");
    const result = await browse({
      pathAndQuery: values.path,
      out: values.out,
      port: values.port ? Number(values.port) : undefined,
    });
    return { ok: result.ok, data: result, text: result.ok ? `Screenshot of ${result.url}\n${result.screenshot}` : result.error };
  },

  async health({ values }) {
    const { checkHealth } = require("./control/health");
    const result = await checkHealth({
      origin: values.origin,
      expected: values.sha,
      wait: values.wait,
      log: values.json ? () => {} : console.log,
    });
    const text = values.sha
      ? `${result.url}: deployed=${result.deployed ?? "none"} expected=${values.sha} -> ${result.outcome}`
      : `${result.url}: ${result.deployed ? `serving ${result.deployed}` : "unreachable or no sha"}`;
    return { ok: result.ok, data: result, text };
  },
};

async function main(argv = process.argv.slice(2)) {
  let parsed;
  try {
    parsed = parse(argv);
  } catch (err) {
    console.error(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  const command = parsed.positionals[0];
  if (parsed.values.help || !command) {
    console.log(USAGE);
    return command || parsed.values.help ? 0 : 2;
  }
  const handler = handlers[command];
  if (!handler) {
    console.error(`Unknown command "${command}".\n\n${USAGE}`);
    return 2;
  }
  try {
    const result = await handler(parsed);
    if (parsed.values.json) {
      console.log(JSON.stringify({ command, ok: result.ok, ...result.data }, null, 2));
    } else {
      console.log(result.text);
    }
    return result.ok ? 0 : 1;
  } catch (err) {
    if (err instanceof UsageError) {
      console.error(`${err.message}\n\n${USAGE}`);
      return 2;
    }
    if (parsed.values.json) {
      console.log(JSON.stringify({ command, ok: false, error: err.message, stack: err.stack }, null, 2));
    } else {
      console.error(err.stack || err.message);
    }
    return 1;
  }
}

if (require.main === module) {
  main().then((code) => process.exit(code));
}

module.exports = { main };
