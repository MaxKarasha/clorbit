// Clorbit 0.6.0 server, bundled from server/ by scripts/build.mjs. Do not edit.
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};

// server/i18n.ts
function parseLang(q2) {
  const v = typeof q2 === "string" || q2 == null ? q2 : q2.get("lang");
  return v === "uk" ? "uk" : "en";
}
function fmtNum(n, lang) {
  const a = Math.abs(n);
  const dec = (x) => lang === "uk" ? x.toFixed(1).replace(".", ",") : x.toFixed(1);
  if (lang === "uk") {
    if (a >= 1e9) return `${dec(n / 1e9)} \u043C\u043B\u0440\u0434`;
    if (a >= 1e6) return `${dec(n / 1e6)} \u043C\u043B\u043D`;
    if (a >= 1e4) return `${Math.round(n / 1e3)} \u0442\u0438\u0441.`;
    if (a >= 1e3) return `${dec(n / 1e3)} \u0442\u0438\u0441.`;
    return String(Math.round(n));
  }
  if (a >= 1e9) return `${dec(n / 1e9)}B`;
  if (a >= 1e6) return `${dec(n / 1e6)}M`;
  if (a >= 1e4) return `${Math.round(n / 1e3)}K`;
  if (a >= 1e3) return `${dec(n / 1e3)}K`;
  return String(Math.round(n));
}
function fmtDuration(ms, lang) {
  const min = Math.round(ms / 6e4);
  const [s, m, h] = lang === "uk" ? [" \u0441", " \u0445\u0432", " \u0433\u043E\u0434"] : ["s", "m", "h"];
  if (min < 1) return `${Math.round(ms / 1e3)}${s}`;
  if (min < 60) return `${min}${m}`;
  const hh = Math.floor(min / 60);
  return min % 60 ? `${hh}${h} ${min % 60}${m}` : `${hh}${h}`;
}
function plural(n, lang, forms) {
  if (lang === "en") return n === 1 ? forms[0] : forms[1] ?? forms[0];
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
  return forms[2];
}
function reasonText(r, lang) {
  if (!r) return null;
  const s = REASONS[lang][r.k];
  return "a" in r ? s.replace("{a}", String(r.a)) : s;
}
function localizeEvent(e, lang) {
  return e.kind === "status" ? { ...e, reason: reasonText(e.reason, lang), ...reasonCode(e.reason) } : e;
}
function reasonCode(r) {
  if (!r) return { code: null, arg: null };
  return { code: r.k, arg: "a" in r ? String(r.a) : null };
}
function notifyText(lang, key, params = {}) {
  const s = NOTIFY[lang][key] ?? NOTIFY.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (m, k) => k in params ? String(params[k]) : m);
}
function normalizeStartupKey(label) {
  if (LEGACY_STARTUP[label]) return LEGACY_STARTUP[label];
  let m = /^Хук плагіна (.+)$/.exec(label);
  if (m) return hookPluginKey(m[1]);
  m = /^Хук ?(.*?) \(додатковий контекст\)$/.exec(label);
  if (m) return hookEventKey(m[1]);
  return label;
}
function migrateSummaryKeys(s) {
  if (Object.keys(s.startup).some((k) => normalizeStartupKey(k) !== k)) {
    const next = {};
    for (const [k, v] of Object.entries(s.startup)) {
      const nk = normalizeStartupKey(k);
      next[nk] = (next[nk] ?? 0) + v;
    }
    s.startup = next;
  }
  if ("\u0432\u043B\u0430\u0441\u043D\u0456 \u0441\u043A\u0456\u043B\u0438" in s.skillsByPlugin) {
    s.skillsByPlugin[OWN_SKILLS] = (s.skillsByPlugin[OWN_SKILLS] ?? 0) + s.skillsByPlugin["\u0432\u043B\u0430\u0441\u043D\u0456 \u0441\u043A\u0456\u043B\u0438"];
    delete s.skillsByPlugin["\u0432\u043B\u0430\u0441\u043D\u0456 \u0441\u043A\u0456\u043B\u0438"];
  }
}
function startupLabel(key, lang) {
  const L = STARTUP_LABELS[lang];
  if (key.startsWith("hook:plugin:")) return L.hookPlugin.replace("{a}", key.slice("hook:plugin:".length));
  if (key.startsWith("hook:event:")) return L.hookEvent.replace("{a}", key.slice("hook:event:".length)).replace("  ", " ");
  return L[key] ?? key;
}
function startupKind(key) {
  if (key.startsWith("hook:")) return "hook";
  switch (key) {
    case STARTUP.system:
      return "system";
    case STARTUP.skills:
      return "skills";
    case STARTUP.mcp:
      return "mcp";
    case STARTUP.claudeMd:
      return "instructions";
    case STARTUP.deferred:
    case STARTUP.toolDefs:
      return "tools";
    case STARTUP.agents:
      return "agents";
    default:
      return "other";
  }
}
function skillGroupLabel(key, lang) {
  return key === OWN_SKILLS ? STARTUP_LABELS[lang].ownSkills : key;
}
function detailText(lang) {
  return DETAIL[lang];
}
function errorText(lang) {
  return ERRORS[lang];
}
var REASONS, NOTIFY, STARTUP, hookPluginKey, hookEventKey, OWN_SKILLS, STARTUP_LABELS, LEGACY_STARTUP, DETAIL, ERRORS;
var init_i18n = __esm({
  "server/i18n.ts"() {
    "use strict";
    REASONS = {
      en: {
        sessionStarted: "Session started",
        gotPrompt: "Got a prompt",
        working: "Working",
        waitingInput: "Waiting for your reply",
        waitingYou: "Waiting for you",
        waitingPermissionAny: "Waiting for permission",
        answerReady: "Answer ready",
        sessionEnded: "Session ended",
        processEnded: "Process exited",
        justStarted: "Session just started",
        running: "Running: {a}",
        waitingPermission: "Waiting for permission: {a}",
        probablyPermission: "Probably waiting for permission: {a}",
        waitingFor: "Waiting for you: {a}",
        subagentsWorking: "Subagents working: {a}"
      },
      uk: {
        sessionStarted: "\u0421\u0435\u0441\u0456\u044E \u0440\u043E\u0437\u043F\u043E\u0447\u0430\u0442\u043E",
        gotPrompt: "\u041E\u0442\u0440\u0438\u043C\u0430\u043B\u0430 \u0437\u0430\u043F\u0438\u0442",
        working: "\u041F\u0440\u0430\u0446\u044E\u0454",
        waitingInput: "\u0427\u0435\u043A\u0430\u0454 \u043D\u0430 \u0442\u0432\u043E\u044E \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u044C",
        waitingYou: "\u0427\u0435\u043A\u0430\u0454 \u043D\u0430 \u0442\u0435\u0431\u0435",
        waitingPermissionAny: "\u0427\u0435\u043A\u0430\u0454 \u0434\u043E\u0437\u0432\u043E\u043B\u0443",
        answerReady: "\u0412\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u044C \u0433\u043E\u0442\u043E\u0432\u0430",
        sessionEnded: "\u0421\u0435\u0441\u0456\u044E \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u043E",
        processEnded: "\u041F\u0440\u043E\u0446\u0435\u0441 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u043E",
        justStarted: "\u0421\u0435\u0441\u0456\u044F \u0449\u043E\u0439\u043D\u043E \u0437\u0430\u043F\u0443\u0449\u0435\u043D\u0430",
        running: "\u0412\u0438\u043A\u043E\u043D\u0443\u0454: {a}",
        waitingPermission: "\u0427\u0435\u043A\u0430\u0454 \u0434\u043E\u0437\u0432\u043E\u043B\u0443: {a}",
        probablyPermission: "\u0419\u043C\u043E\u0432\u0456\u0440\u043D\u043E, \u0447\u0435\u043A\u0430\u0454 \u0434\u043E\u0437\u0432\u043E\u043B\u0443: {a}",
        waitingFor: "\u0427\u0435\u043A\u0430\u0454 \u043D\u0430 \u0442\u0435\u0431\u0435: {a}",
        subagentsWorking: "\u041F\u0440\u0430\u0446\u044E\u044E\u0442\u044C \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0438: {a}"
      }
    };
    NOTIFY = {
      en: {
        waitPermissionTool: "{p} is waiting for you: permission for {tool}",
        waitPermission: "{p} is waiting for you: permission",
        waitInput: "{p} is waiting for your reply",
        waitYou: "{p} is waiting for you",
        done: "{p}: answer ready",
        finished: "{p}: {agent} finished",
        finishedMany: "{p}: {n} subagents finished",
        spawned: "{p}: {agent} started",
        compaction: "{p}: context compacted",
        contextHigh: "{p}: context {pct}% full",
        limitHigh: "Subscription limit ({w}): {pct}% used",
        limitForecast: "The {w} limit will run out around {time} \u2014 {left} before the reset ({pct}% used now)",
        durHM: "{h} h {m} min",
        durM: "{m} min",
        w5h: "5 h",
        w7d: "7 days",
        subagent: "a subagent",
        test: "Test notification: this is how Clorbit will reach you."
      },
      uk: {
        waitPermissionTool: "{p} \u0447\u0435\u043A\u0430\u0454 \u043D\u0430 \u0442\u0435\u0431\u0435: \u0434\u043E\u0437\u0432\u0456\u043B \u043D\u0430 {tool}",
        waitPermission: "{p} \u0447\u0435\u043A\u0430\u0454 \u043D\u0430 \u0442\u0435\u0431\u0435: \u0434\u043E\u0437\u0432\u0456\u043B",
        waitInput: "{p} \u0447\u0435\u043A\u0430\u0454 \u043D\u0430 \u0442\u0432\u043E\u044E \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u044C",
        waitYou: "{p} \u0447\u0435\u043A\u0430\u0454 \u043D\u0430 \u0442\u0435\u0431\u0435",
        done: "{p}: \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u044C \u0433\u043E\u0442\u043E\u0432\u0430",
        finished: "{p}: {agent} \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0432 \u0440\u043E\u0431\u043E\u0442\u0443",
        finishedMany: "{p}: \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u043E \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0456\u0432 \u2014 {n}",
        spawned: "{p}: \u0437\u0430\u043F\u0443\u0449\u0435\u043D\u043E {agent}",
        compaction: "{p}: \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 \u0441\u0442\u0438\u0441\u043D\u0443\u0442\u043E",
        contextHigh: "{p}: \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 \u0437\u0430\u043F\u043E\u0432\u043D\u0435\u043D\u043E \u043D\u0430 {pct}%",
        limitHigh: "\u041B\u0456\u043C\u0456\u0442 \u043F\u0456\u0434\u043F\u0438\u0441\u043A\u0438 ({w}): \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u043D\u043E {pct}%",
        limitForecast: "\u041B\u0456\u043C\u0456\u0442 {w} \u0432\u0438\u0447\u0435\u0440\u043F\u0430\u0454\u0442\u044C\u0441\u044F \u0431\u043B\u0438\u0437\u044C\u043A\u043E {time} \u2014 \u0437\u0430 {left} \u0434\u043E \u0441\u043A\u0438\u0434\u0430\u043D\u043D\u044F (\u0437\u0430\u0440\u0430\u0437 {pct}%)",
        durHM: "{h} \u0433\u043E\u0434 {m} \u0445\u0432",
        durM: "{m} \u0445\u0432",
        w5h: "5 \u0433\u043E\u0434",
        w7d: "7 \u0434\u043D\u0456\u0432",
        subagent: "\u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442",
        test: "\u0422\u0435\u0441\u0442\u043E\u0432\u0435 \u0441\u043F\u043E\u0432\u0456\u0449\u0435\u043D\u043D\u044F: \u0442\u0430\u043A Clorbit \u043A\u043B\u0438\u043A\u0430\u0442\u0438\u043C\u0435 \u0442\u0435\u0431\u0435."
      }
    };
    STARTUP = {
      skills: "skills",
      mcp: "mcp",
      deferred: "deferred",
      agents: "agents",
      claudeMd: "claudeMd",
      system: "system",
      toolDefs: "toolDefs",
      env: "env",
      other: "other"
    };
    hookPluginKey = (plugin) => `hook:plugin:${plugin}`;
    hookEventKey = (name) => `hook:event:${name}`;
    OWN_SKILLS = "~own";
    STARTUP_LABELS = {
      en: {
        skills: "Skill listing",
        mcp: "MCP instructions",
        deferred: "Deferred tools",
        agents: "Agent listing",
        claudeMd: "CLAUDE.md",
        system: "System prompt",
        toolDefs: "Tool definitions",
        env: "Environment & system reminders",
        other: "Other attachments",
        hookPlugin: "Plugin hook {a}",
        hookEvent: "Hook {a} (additional context)",
        ownSkills: "own skills"
      },
      uk: {
        skills: "\u0421\u043F\u0438\u0441\u043E\u043A \u0441\u043A\u0456\u043B\u0456\u0432",
        mcp: "\u0406\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0456\u0457 MCP",
        deferred: "\u0412\u0456\u0434\u043A\u043B\u0430\u0434\u0435\u043D\u0456 \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0438",
        agents: "\u0421\u043F\u0438\u0441\u043E\u043A \u0430\u0433\u0435\u043D\u0442\u0456\u0432",
        claudeMd: "CLAUDE.md",
        system: "\u0421\u0438\u0441\u0442\u0435\u043C\u043D\u0438\u0439 \u043F\u0440\u043E\u043C\u043F\u0442",
        toolDefs: "\u0412\u0438\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0456\u0432",
        env: "\u0421\u0435\u0440\u0435\u0434\u043E\u0432\u0438\u0449\u0435 \u0442\u0430 \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u0456 \u043D\u0430\u0433\u0430\u0434\u0443\u0432\u0430\u043D\u043D\u044F",
        other: "\u0406\u043D\u0448\u0456 \u0432\u043A\u043B\u0430\u0434\u0435\u043D\u043D\u044F",
        hookPlugin: "\u0425\u0443\u043A \u043F\u043B\u0430\u0433\u0456\u043D\u0430 {a}",
        hookEvent: "\u0425\u0443\u043A {a} (\u0434\u043E\u0434\u0430\u0442\u043A\u043E\u0432\u0438\u0439 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442)",
        ownSkills: "\u0432\u043B\u0430\u0441\u043D\u0456 \u0441\u043A\u0456\u043B\u0438"
      }
    };
    LEGACY_STARTUP = {
      "\u0421\u043F\u0438\u0441\u043E\u043A \u0441\u043A\u0456\u043B\u0456\u0432": STARTUP.skills,
      "\u0406\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0456\u0457 MCP": STARTUP.mcp,
      "\u0412\u0456\u0434\u043A\u043B\u0430\u0434\u0435\u043D\u0456 \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0438": STARTUP.deferred,
      "\u0421\u043F\u0438\u0441\u043E\u043A \u0430\u0433\u0435\u043D\u0442\u0456\u0432": STARTUP.agents,
      "CLAUDE.md": STARTUP.claudeMd,
      "\u0421\u0438\u0441\u0442\u0435\u043C\u043D\u0438\u0439 \u043F\u0440\u043E\u043C\u043F\u0442": STARTUP.system,
      "\u0412\u0438\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0456\u0432": STARTUP.toolDefs,
      "\u0421\u0435\u0440\u0435\u0434\u043E\u0432\u0438\u0449\u0435 \u0442\u0430 \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u0456 \u043D\u0430\u0433\u0430\u0434\u0443\u0432\u0430\u043D\u043D\u044F": STARTUP.env,
      "\u0406\u043D\u0448\u0456 \u0432\u043A\u043B\u0430\u0434\u0435\u043D\u043D\u044F": STARTUP.other
    };
    DETAIL = {
      en: {
        autoCompact: "Context auto-compaction",
        compact: "Context compaction",
        turnDone: (sec) => `Turn finished in ${sec >= 60 ? Math.floor(sec / 60) + "m " : ""}${sec % 60}s`,
        finished: (type) => `Finished: ${type ?? "subagent"}`
      },
      uk: {
        autoCompact: "\u0410\u0432\u0442\u043E\u043A\u043E\u043C\u043F\u0430\u043A\u0446\u0456\u044F \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u0443",
        compact: "\u041A\u043E\u043C\u043F\u0430\u043A\u0446\u0456\u044F \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u0443",
        turnDone: (sec) => `\u0425\u0456\u0434 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u043E \u0437\u0430 ${sec >= 60 ? Math.floor(sec / 60) + " \u0445\u0432 " : ""}${sec % 60} \u0441`,
        finished: (type) => `\u0417\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u043E: ${type ?? "\u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442"}`
      }
    };
    ERRORS = {
      en: { badSession: "Invalid session id", notFound: "Session not found", getOnly: "GET only", unknownRoute: "Unknown route", tooLarge: "Request too large", forbidden: "Only a local page can change settings", jsonOnly: "Send JSON (content-type: application/json)", badJson: "Invalid JSON" },
      uk: { badSession: "\u041D\u0435\u043A\u043E\u0440\u0435\u043A\u0442\u043D\u0438\u0439 id \u0441\u0435\u0441\u0456\u0457", notFound: "\u0421\u0435\u0441\u0456\u044E \u043D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E", getOnly: "\u041B\u0438\u0448\u0435 GET", unknownRoute: "\u041D\u0435\u0432\u0456\u0434\u043E\u043C\u0438\u0439 \u043C\u0430\u0440\u0448\u0440\u0443\u0442", tooLarge: "\u0417\u0430\u0432\u0435\u043B\u0438\u043A\u0438\u0439 \u0437\u0430\u043F\u0438\u0442", forbidden: "\u0417\u043C\u0456\u043D\u044E\u0432\u0430\u0442\u0438 \u043D\u0430\u043B\u0430\u0448\u0442\u0443\u0432\u0430\u043D\u043D\u044F \u043C\u043E\u0436\u0435 \u043B\u0438\u0448\u0435 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u0430 \u0441\u0442\u043E\u0440\u0456\u043D\u043A\u0430", jsonOnly: "\u041D\u0430\u0434\u0456\u0448\u043B\u0438 JSON (content-type: application/json)", badJson: "\u041D\u0435\u043A\u043E\u0440\u0435\u043A\u0442\u043D\u0438\u0439 JSON" }
    };
  }
});

// server/config.ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
function env(name) {
  return process.env[`CLORBIT_${name}`] || process.env[`FLEET_${name}`] || void 0;
}
function coworkDir(v, platform = process.platform, home = os.homedir()) {
  if (v) return v === "off" || v === "0" ? "" : path.resolve(v);
  if (platform === "darwin") return path.join(home, "Library", "Application Support", "Claude", "local-agent-mode-sessions");
  if (platform === "linux") return path.join(home, ".config", "Claude", "local-agent-mode-sessions");
  return "";
}
function devVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf8")).version ?? "dev";
  } catch {
    return "dev";
  }
}
function migrateLegacyDb({ dbFile = DB_FILE, legacy = LEGACY_DB_FILE, explicitDataDir = DATA_DIR_EXPLICIT } = {}) {
  if (explicitDataDir) return null;
  try {
    if (fs.existsSync(dbFile) || !fs.existsSync(legacy)) return null;
    fs.mkdirSync(path.dirname(dbFile), { recursive: true });
    fs.copyFileSync(legacy, dbFile);
    for (const ext of ["-wal", "-shm"]) {
      if (fs.existsSync(legacy + ext)) fs.copyFileSync(legacy + ext, dbFile + ext);
    }
    return legacy;
  } catch (e) {
    console.error(`[clorbit] could not migrate ${legacy}:`, e.message);
    return null;
  }
}
function readSettings() {
  try {
    const st = fs.statSync(SETTINGS_FILE);
    if (settingsCache && settingsCache.mtime === st.mtimeMs) return settingsCache.v;
    const j = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
    const v = { enabledPlugins: j.enabledPlugins ?? {}, env: j.env ?? {} };
    settingsCache = { mtime: st.mtimeMs, v };
    return v;
  } catch {
    return { enabledPlugins: {}, env: {} };
  }
}
function hookPluginEnabled(settings2 = readSettings()) {
  return Object.entries(settings2.enabledPlugins).some(([k, on]) => on && (k.startsWith("clorbit@") || k.startsWith("fleet-hooks@")));
}
function knownPlugins() {
  const names3 = /* @__PURE__ */ new Set();
  for (const k of Object.keys(readSettings().enabledPlugins)) names3.add(k.split("@")[0]);
  try {
    const cache5 = path.join(CLAUDE_DIR, "plugins", "cache");
    for (const mkt of fs.readdirSync(cache5)) {
      try {
        for (const p of fs.readdirSync(path.join(cache5, mkt))) names3.add(p);
      } catch {
      }
    }
  } catch {
  }
  return [...names3].filter((n) => n.length >= 4).sort((a, b) => b.length - a.length);
}
var BUNDLED, HERE, PROJECT_ROOT, CLAUDE_DIR, PROJECTS_DIR, SESSIONS_DIR, SETTINGS_FILE, CLAUDE_JSON_FILES, COWORK_DIR, HOME_DATA_DIR, STATUSLINE_FILE, LEGACY_STATUSLINE_FILE, DATA_DIR, DATA_DIR_EXPLICIT, DB_FILE, CACHE_DIR, DIST_DIR, SERVE_WEB, PORT, HOST, VERSION, LEGACY_DB_FILE, settingsCache;
var init_config = __esm({
  "server/config.ts"() {
    "use strict";
    BUNDLED = true;
    HERE = path.dirname(fileURLToPath(import.meta.url));
    PROJECT_ROOT = path.resolve(HERE, "..");
    CLAUDE_DIR = env("CLAUDE_DIR") || path.join(os.homedir(), ".claude");
    PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");
    SESSIONS_DIR = path.join(CLAUDE_DIR, "sessions");
    SETTINGS_FILE = path.join(CLAUDE_DIR, "settings.json");
    CLAUDE_JSON_FILES = env("CLAUDE_JSON") ? [env("CLAUDE_JSON")] : env("CLAUDE_DIR") ? [path.join(CLAUDE_DIR, ".claude.json"), path.join(path.dirname(CLAUDE_DIR), ".claude.json")] : [path.join(os.homedir(), ".claude.json")];
    COWORK_DIR = coworkDir(env("COWORK_DIR"));
    HOME_DATA_DIR = path.join(os.homedir(), ".clorbit");
    STATUSLINE_FILE = env("STATUSLINE_FILE") || path.join(HOME_DATA_DIR, "statusline.json");
    LEGACY_STATUSLINE_FILE = path.join(os.homedir(), ".fleet", "statusline.json");
    DATA_DIR = env("DATA_DIR") || HOME_DATA_DIR;
    DATA_DIR_EXPLICIT = !!env("DATA_DIR");
    DB_FILE = path.join(DATA_DIR, "clorbit.db");
    CACHE_DIR = env("CACHE_DIR") || path.join(DATA_DIR, "cache");
    DIST_DIR = BUNDLED ? path.join(HERE, "web") : path.join(PROJECT_ROOT, "plugin", "app", "web");
    SERVE_WEB = env("SERVE_WEB") ? env("SERVE_WEB") === "1" : BUNDLED;
    PORT = Number(env("PORT")) || 4980;
    HOST = "127.0.0.1";
    VERSION = BUNDLED && true ? "0.6.0" : devVersion();
    LEGACY_DB_FILE = path.join(PROJECT_ROOT, "data", "fleet.db");
    settingsCache = null;
  }
});

// server/cowork.ts
import fs2 from "node:fs";
import path2 from "node:path";
function isCoworkPath(p, dir = COWORK_DIR) {
  return !!p && inside(dir, p);
}
function coworkProjectRoots(dir = COWORK_DIR) {
  const out = [];
  if (!dir) return out;
  const ls = (p) => {
    try {
      return fs2.readdirSync(p, { withFileTypes: true });
    } catch {
      return [];
    }
  };
  for (const account of ls(dir)) {
    if (!account.isDirectory() || account.name === "skills-plugin") continue;
    for (const org of ls(path2.join(dir, account.name))) {
      if (!org.isDirectory()) continue;
      for (const s of ls(path2.join(dir, account.name, org.name))) {
        if (!s.isDirectory() || !SESSION_DIR.test(s.name)) continue;
        const root = path2.join(dir, account.name, org.name, s.name, ".claude", "projects");
        if (fs2.existsSync(root)) out.push(root);
      }
    }
  }
  return out;
}
function coworkSessionDir(p, dir = COWORK_DIR) {
  if (!p || !inside(dir, p)) return null;
  const rel = p.slice(dir.length + 1).split(SEP);
  if (rel.length < 3 || !SESSION_DIR.test(rel[2])) return null;
  return path2.join(dir, rel[0], rel[1], rel[2]);
}
function readCoworkMeta(sessionDir, now = Date.now()) {
  const file = `${sessionDir}.json`;
  const hit = metaCache.get(file);
  if (hit && now - hit.at < META_TTL_MS) return hit.v;
  let mtime = -1;
  try {
    mtime = fs2.statSync(file).mtimeMs;
  } catch {
  }
  if (hit && hit.mtime === mtime) {
    hit.at = now;
    return hit.v;
  }
  let v = null;
  if (mtime >= 0) {
    try {
      const j = JSON.parse(fs2.readFileSync(file, "utf8"));
      const folders = Array.isArray(j?.userSelectedFolders) ? j.userSelectedFolders.filter((x) => typeof x === "string" && x) : [];
      v = {
        title: typeof j?.title === "string" && j.title.trim() ? j.title.trim().slice(0, 200) : null,
        folder: folders.length ? String(folders[0]) : null,
        archived: j?.isArchived === true
      };
    } catch {
    }
  }
  if (metaCache.size > 2e3) metaCache.clear();
  metaCache.set(file, { at: now, mtime, v });
  return v;
}
function coworkMetaOf(p, dir = COWORK_DIR) {
  const sd = coworkSessionDir(p, dir);
  return sd ? readCoworkMeta(sd) : null;
}
function coworkProject(cwd, dir = COWORK_DIR) {
  const sd = coworkSessionDir(cwd, dir);
  if (!sd) return null;
  const folder = readCoworkMeta(sd)?.folder;
  return folder && path2.basename(folder) || COWORK_PROJECT;
}
var COWORK_PROJECT, COWORK_LIVE_MS, SEP, SESSION_DIR, inside, META_TTL_MS, metaCache;
var init_cowork = __esm({
  "server/cowork.ts"() {
    "use strict";
    init_config();
    COWORK_PROJECT = "Cowork";
    COWORK_LIVE_MS = 15 * 6e4;
    SEP = path2.sep;
    SESSION_DIR = /^local_[\w-]+$/;
    inside = (dir, p) => !!dir && p.startsWith(dir + SEP);
    META_TTL_MS = 5e3;
    metaCache = /* @__PURE__ */ new Map();
  }
});

// server/util.ts
import path3 from "node:path";
function addT4(into, t) {
  into[0] += t[0];
  into[1] += t[1];
  into[2] += t[2];
  into[3] += t[3];
  return into;
}
function localDateHour(ts) {
  const h = Math.floor(ts / 36e5);
  let v = hourCache.get(h);
  if (!v) {
    const d = new Date(h * 36e5);
    v = { date: fmtDate(d), hour: d.getHours() };
    if (hourCache.size > 2e5) hourCache.clear();
    hourCache.set(h, v);
  }
  return v;
}
function fmtDate(d) {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? "0" : ""}${m}-${day < 10 ? "0" : ""}${day}`;
}
function weekdayOf(date) {
  const [y, m, d] = date.split("-").map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}
function addDays(date, delta) {
  const [y, m, d] = date.split("-").map(Number);
  return fmtDate(new Date(y, m - 1, d + delta));
}
function dateRange(from, to) {
  const out = [];
  for (let d = from; d <= to && out.length < 4e3; d = addDays(d, 1)) out.push(d);
  return out;
}
function parseTs(s) {
  if (typeof s !== "string") return typeof s === "number" ? s : null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}
function trimText(s, n) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "\u2026" : t;
}
function mcpSplit(name) {
  if (!name.startsWith("mcp__")) return null;
  const rest = name.slice(5);
  const i = rest.indexOf("__");
  if (i < 0) return { server: rest, tool: "" };
  return { server: rest.slice(0, i), tool: rest.slice(i + 2) };
}
function toolLabel(name, input) {
  const inp = input && typeof input === "object" ? input : {};
  const base = (p) => typeof p === "string" && p ? path3.basename(p) : "";
  const short = (s, n = 40) => typeof s === "string" ? trimText(s.split("\n")[0], n) : "";
  switch (name) {
    case "Read":
      return `Read ${base(inp.file_path)}`.trim();
    case "Write":
      return `Write ${base(inp.file_path)}`.trim();
    case "Edit":
    case "MultiEdit":
      return `Edit ${base(inp.file_path)}`.trim();
    case "NotebookEdit":
      return `Edit ${base(inp.notebook_path)}`.trim();
    case "Grep":
      return inp.pattern ? `Grep "${short(inp.pattern, 40)}"` : "Grep";
    case "Glob":
      return inp.pattern ? `Glob ${short(inp.pattern, 40)}` : "Glob";
    case "Bash":
      return inp.command ? `Bash: ${short(inp.command, 40)}` : "Bash";
    case "Agent":
    case "Task":
      return `Agent \u2192 ${inp.subagent_type || "general-purpose"}`;
    case "Skill":
      return inp.skill ? `Skill ${inp.skill}` : "Skill";
    case "WebFetch": {
      try {
        return `WebFetch ${new URL(inp.url).host}`;
      } catch {
        return "WebFetch";
      }
    }
    case "WebSearch":
      return inp.query ? `WebSearch "${short(inp.query, 40)}"` : "WebSearch";
    case "ToolSearch":
      return inp.query ? `ToolSearch ${short(inp.query, 40)}` : "ToolSearch";
    case "TodoWrite":
      return "TodoWrite";
  }
  const m = mcpSplit(name);
  if (m) return `${m.server} \xB7 ${m.tool}`;
  return name;
}
function resultChars(content) {
  if (typeof content === "string") return content.length;
  if (!Array.isArray(content)) return content == null ? 0 : JSON.stringify(content).length;
  let n = 0;
  for (const b of content) {
    if (!b || typeof b !== "object") continue;
    if (typeof b.text === "string") n += b.text.length;
    else if (b.type === "image") n += 5400;
    else n += JSON.stringify(b).length;
  }
  return n;
}
function projectOf(cwd, fallbackDir) {
  if (cwd) return coworkProject(cwd) ?? (path3.basename(cwd) || cwd);
  if (fallbackDir) {
    const parts = fallbackDir.split("-").filter(Boolean);
    return parts[parts.length - 1] ?? fallbackDir;
  }
  return "unknown";
}
function contextLimitFor(model, requestedModel, maxCtx) {
  if (!model && !requestedModel && !maxCtx) return null;
  if (model && model.endsWith("[1m]") || requestedModel && requestedModel.endsWith("[1m]") || maxCtx > 2e5) return 1e6;
  return 2e5;
}
var zeroT4, sumT4, toTokens, estTokens, hourCache, localDate, mcpKey;
var init_util = __esm({
  "server/util.ts"() {
    "use strict";
    init_cowork();
    zeroT4 = () => [0, 0, 0, 0];
    sumT4 = (t) => t[0] + t[1] + t[2] + t[3];
    toTokens = (t) => ({ input: t[0], output: t[1], cacheRead: t[2], cacheWrite: t[3] });
    estTokens = (chars) => Math.round(chars / 3.6);
    hourCache = /* @__PURE__ */ new Map();
    localDate = (ts) => localDateHour(ts).date;
    mcpKey = (display) => display.replace(/[^a-zA-Z0-9_-]/g, "_");
  }
});

// server/titles.ts
function setSessionNames(m) {
  names = m;
}
function clorbitName(sessionId) {
  return Object.prototype.hasOwnProperty.call(names, sessionId) ? names[sessionId] : null;
}
function autoTitle(main, coworkDir2 = COWORK_DIR) {
  if (!main) return null;
  return main.customTitle || coworkMetaOf(main.path, coworkDir2)?.title || main.title || null;
}
function sessionTitle(main, coworkDir2 = COWORK_DIR) {
  if (!main) return null;
  return clorbitName(main.sessionId) ?? autoTitle(main, coworkDir2);
}
function titleFields(sessionId, main, coworkDir2 = COWORK_DIR) {
  const name = clorbitName(sessionId);
  const auto = autoTitle(main, coworkDir2);
  return name ? { title: name, autoTitle: auto } : { title: auto };
}
var names;
var init_titles = __esm({
  "server/titles.ts"() {
    "use strict";
    init_config();
    init_cowork();
    names = {};
  }
});

// server/analytics.ts
function parseRange(q2) {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const today = localDate(Date.now());
  let to = q2.get("to") ?? "";
  let from = q2.get("from") ?? "";
  if (!re.test(to)) to = today;
  if (!re.test(from)) from = addDays(to, -13);
  if (from > to) [from, to] = [to, from];
  return { from, to };
}
function memoize(store2, key, fn) {
  const m = memo.get(key);
  if (m && m.version === store2.version) return m.v;
  const v = fn();
  memo.set(key, { version: store2.version, v });
  if (memo.size > 200) memo.delete(memo.keys().next().value);
  return v;
}
function overview(store2, range) {
  return memoize(store2, `ov:${range.from}:${range.to}`, () => {
    const ctx = new Ctx(store2);
    const daily = /* @__PURE__ */ new Map();
    for (const d of dateRange(range.from, range.to)) {
      daily.set(d, { date: d, tokens: toTokens(zeroT4()), byModel: {}, byProject: {}, sessions: 0, subagents: 0, toolCalls: 0, _s: /* @__PURE__ */ new Set() });
    }
    const tot = zeroT4();
    let toolCalls = 0, compactions = 0;
    const sessions2 = /* @__PURE__ */ new Set();
    const subagents = /* @__PURE__ */ new Set();
    const projects = new Rows();
    const models = new Rows();
    const hourly = new Array(24).fill(0);
    const heat = /* @__PURE__ */ new Map();
    for (const { s, date, b } of ctx.days(range)) {
      const dp = daily.get(date);
      if (!dp) continue;
      const total = sumT4(b.t);
      const proj = ctx.project(s);
      dp.tokens.input += b.t[0];
      dp.tokens.output += b.t[1];
      dp.tokens.cacheRead += b.t[2];
      dp.tokens.cacheWrite += b.t[3];
      if (total > 0) dp.byProject[proj] = (dp.byProject[proj] ?? 0) + total;
      for (const [m, a] of Object.entries(b.models)) {
        dp.byModel[m] = (dp.byModel[m] ?? 0) + sumT4(a.t);
        models.addAgg(m, a, s.sessionId);
      }
      dp.toolCalls += b.toolCalls;
      if (b.turns > 0) dp._s.add(s.sessionId);
      addT4(tot, b.t);
      toolCalls += b.toolCalls;
      compactions += b.compactions;
      if (b.turns > 0) sessions2.add(s.sessionId);
      const pr = projects.get(proj);
      addT4(pr.t, b.t);
      pr.turns += b.turns;
      pr.calls += b.toolCalls;
      if (b.turns) pr.sessions.add(s.sessionId);
      if (s.lastTs > pr.last) pr.last = s.lastTs;
      const wd = weekdayOf(date);
      for (const [h, t] of Object.entries(b.hours)) {
        const v = sumT4(t);
        hourly[Number(h)] += v;
        const k = `${wd}:${h}`;
        heat.set(k, (heat.get(k) ?? 0) + v);
      }
    }
    for (const s of store2.files.values()) {
      if (!s.agentId || !s.firstTs) continue;
      const dp = daily.get(localDate(s.firstTs));
      if (dp) {
        dp.subagents++;
        subagents.add(s.path);
      }
    }
    for (const dp of daily.values()) {
      dp.sessions = dp._s.size;
      delete dp._s;
    }
    const projRows = projects.rows();
    for (const r of projRows) {
      r.extra = { ...r.extra ?? {}, share: tot[0] + tot[1] + tot[2] + tot[3] ? r.total / sumT4(tot) : 0 };
    }
    const heatmap = [];
    for (let wd = 0; wd < 7; wd++) for (let h = 0; h < 24; h++) heatmap.push({ weekday: wd, hour: h, total: heat.get(`${wd}:${h}`) ?? 0 });
    return {
      range,
      totals: { ...toTokens(tot), total: sumT4(tot), sessions: sessions2.size, subagents: subagents.size, toolCalls, compactions, projects: projRows.filter((r) => r.total > 0).length },
      daily: [...daily.values()],
      projects: projRows,
      models: models.rows(),
      hourly,
      heatmap
    };
  });
}
function startupBySession(ctx, range) {
  const out = [];
  for (const s of ctx.store.files.values()) {
    if (!s.firstTs) continue;
    const date = localDate(s.firstTs);
    if (date >= range.from && date <= range.to) out.push({ s, date });
  }
  return out;
}
function mcpDisplayNames(store2) {
  const m = /* @__PURE__ */ new Map();
  for (const s of store2.files.values()) {
    for (const k of Object.keys(s.mcpBlocks)) m.set(mcpKey(k), k);
    for (const b of Object.values(s.days)) for (const k of Object.keys(b.mcpServers)) m.set(mcpKey(k), k);
  }
  return m;
}
function attribution(store2, range, lang = "en") {
  return memoize(store2, `attr:${lang}:${range.from}:${range.to}`, () => {
    const ctx = new Ctx(store2);
    const skills = new Rows(), plugins = new Rows(), mcpServers = new Rows(), mcpTools = new Rows(), tools = new Rows();
    const subTypes = new Rows();
    let unattributed = 0;
    const mcpByKey = mcpDisplayNames(store2);
    for (const { s, b } of ctx.days(range)) {
      const sid = s.sessionId;
      unattributed += b.unattributed;
      for (const [k, a] of Object.entries(b.skills)) {
        const r = skills.addAgg(k, a, sid);
        if (k.includes(":")) r.group = k.split(":")[0];
      }
      for (const [k, n] of Object.entries(b.skillLoads)) {
        const r = skills.get(k);
        r.calls += n;
        r.sessions.add(sid);
        r.extra.loads = (r.extra.loads ?? 0) + n;
        if (k.includes(":")) r.group = k.split(":")[0];
      }
      for (const [k, a] of Object.entries(b.plugins)) plugins.addAgg(k, a, sid);
      for (const [k, a] of Object.entries(b.mcpServers)) mcpServers.addAgg(k, a, sid);
      for (const [k, a] of Object.entries(b.mcpTools)) {
        const [server2, tool] = k.split("");
        const r = mcpTools.addAgg(`${server2} \xB7 ${tool}`, a, sid);
        r.group = server2;
      }
      for (const [name, t] of Object.entries(b.tools)) {
        const r = tools.get(name);
        r.calls += t.calls;
        r.sessions.add(sid);
        if (t.last > r.last) r.last = t.last;
        r.extra.resultTokens = (r.extra.resultTokens ?? 0) + t.res;
        r.extra.resultCount = (r.extra.resultCount ?? 0) + t.resN;
        r.extra.maxResult = Math.max(r.extra.maxResult ?? 0, t.max);
        r.t[0] += t.res;
        const m = mcpSplit(name);
        if (m) {
          r.group = m.server;
          const key = mcpByKey.get(m.server) ?? m.server;
          const sr = mcpServers.get(key);
          sr.calls += t.calls;
          sr.sessions.add(sid);
          sr.extra.resultTokens = (sr.extra.resultTokens ?? 0) + t.res;
          const tr = mcpTools.get(`${key} \xB7 ${m.tool}`);
          tr.calls += t.calls;
          tr.group = key;
          tr.sessions.add(sid);
          tr.extra.resultTokens = (tr.extra.resultTokens ?? 0) + t.res;
        }
      }
    }
    for (const [k, r] of [...mcpServers.m]) {
      const disp = mcpByKey.get(k);
      if (disp && disp !== k) {
        const into = mcpServers.get(disp);
        addT4(into.t, r.t);
        into.turns += r.turns;
        into.calls += r.calls;
        r.sessions.forEach((x) => into.sessions.add(x));
        into.extra.resultTokens = (into.extra.resultTokens ?? 0) + (r.extra.resultTokens ?? 0);
        mcpServers.m.delete(k);
      }
    }
    for (const r of tools.m.values()) {
      const n = r.extra.resultCount || 0;
      r.extra.avgResult = n ? Math.round((r.extra.resultTokens ?? 0) / n) : 0;
    }
    for (const [k, r] of skills.m) {
      if (!r.group) continue;
      const pr = plugins.get(r.group);
      pr.calls += r.extra.loads ?? 0;
      r.sessions.forEach((x) => pr.sessions.add(x));
      pr.extra.skills = (pr.extra.skills ?? 0) + 1;
      void k;
    }
    const sub = /* @__PURE__ */ new Map();
    const startup = new Rows();
    const startupSessions = /* @__PURE__ */ new Map();
    for (const { s } of startupBySession(ctx, range)) {
      if (s.agentId) {
        const type = s.meta?.agentType ?? "general-purpose";
        const r = subTypes.get(type);
        addT4(r.t, s.total);
        r.turns += s.turns;
        r.calls++;
        r.sessions.add(s.sessionId);
        if (s.lastTs > r.last) r.last = s.lastTs;
        const a = sub.get(type) ?? { n: 0, dur: 0, maxDepth: 0 };
        a.n++;
        a.dur += Math.max(0, s.lastTs - s.firstTs);
        a.maxDepth = Math.max(a.maxDepth, s.meta?.spawnDepth ?? 1);
        sub.set(type, a);
      }
      for (const [label, chars] of Object.entries(s.startup)) {
        const r = startup.get(label);
        const tok = estTokens(chars);
        if (s.agentId) {
          r.extra.subagentTokens = (r.extra.subagentTokens ?? 0) + tok;
          r.extra.subagentRuns = (r.extra.subagentRuns ?? 0) + 1;
        } else {
          r.t[0] += tok;
          r.calls++;
          r.sessions.add(s.sessionId);
          const set = startupSessions.get(label) ?? /* @__PURE__ */ new Set();
          set.add(s.sessionId);
          startupSessions.set(label, set);
        }
        if (s.firstTs > r.last) r.last = s.firstTs;
      }
    }
    for (const [type, a] of sub) {
      const r = subTypes.get(type);
      r.extra.avgTokens = Math.round(sumT4(r.t) / a.n);
      r.extra.avgDurationMs = Math.round(a.dur / a.n);
      r.extra.maxDepth = a.maxDepth;
    }
    for (const r of startup.m.values()) {
      r.extra.perSession = r.calls ? Math.round(r.t[0] / r.calls) : 0;
      if (r.extra.subagentRuns) r.extra.perSubagent = Math.round((r.extra.subagentTokens ?? 0) / r.extra.subagentRuns);
      r.t[0] += r.extra.subagentTokens ?? 0;
    }
    return {
      range,
      skills: skills.rows(),
      plugins: plugins.rows(),
      mcpServers: mcpServers.rows(),
      mcpTools: mcpTools.rows(),
      tools: tools.rows((k) => k, "calls"),
      subagentTypes: subTypes.rows(),
      startupContext: startup.rows((k) => startupLabel(k, lang)).map((r) => {
        r.extra = { ...r.extra, kind: startupKind(r.key) };
        if (r.key.startsWith("hook:plugin:")) r.group = r.key.slice("hook:plugin:".length);
        return r;
      }),
      unattributedTotal: unattributed
    };
  });
}
function summarizeSession(store2, sessionId, ctx) {
  const files = store2.sessionFiles(sessionId);
  if (!files.length) return null;
  const main = files.find((f) => f.agentId === null) ?? null;
  const t = zeroT4();
  let toolCalls = 0, start = Infinity, end = 0;
  for (const f of files) {
    addT4(t, f.total);
    toolCalls += f.toolCalls;
    if (f.firstTs && f.firstTs < start) start = f.firstTs;
    if (f.lastTs > end) end = f.lastTs;
  }
  if (!Number.isFinite(start)) start = end;
  const any = main ?? files[0];
  return {
    sessionId,
    project: ctx ? ctx.project(any) : projectOf(any.cwd, any.projectDir),
    cwd: main?.cwd ?? any.cwd ?? "",
    ...titleFields(sessionId, main),
    startedAt: start,
    endedAt: end,
    model: main?.model ?? null,
    effort: main?.effort ?? null,
    tokens: toTokens(t),
    total: sumT4(t),
    subagents: files.length - (main ? 1 : 0),
    toolCalls,
    compactions: main?.compactions ?? 0,
    durationMs: Math.max(0, end - start)
  };
}
function sessions(store2, range, project) {
  return memoize(store2, `ss:${range.from}:${range.to}:${project ?? ""}`, () => {
    const ctx = new Ctx(store2);
    const ids = /* @__PURE__ */ new Set();
    for (const { s, b } of ctx.days(range)) if (b.turns > 0) ids.add(s.sessionId);
    const out = [];
    for (const id of ids) {
      const sum = summarizeSession(store2, id, ctx);
      if (!sum) continue;
      if (project && sum.project !== project) continue;
      out.push(sum);
    }
    out.sort((a, b) => b.endedAt - a.endedAt);
    return out;
  });
}
var Rows, Ctx, memo;
var init_analytics = __esm({
  "server/analytics.ts"() {
    "use strict";
    init_i18n();
    init_util();
    init_titles();
    Rows = class {
      m = /* @__PURE__ */ new Map();
      get(key) {
        let r = this.m.get(key);
        if (!r) this.m.set(key, r = { t: zeroT4(), turns: 0, calls: 0, sessions: /* @__PURE__ */ new Set(), last: 0, extra: {} });
        return r;
      }
      addAgg(key, a, sid) {
        const r = this.get(key);
        addT4(r.t, a.t);
        r.turns += a.turns;
        r.sessions.add(sid);
        if (a.last > r.last) r.last = a.last;
        return r;
      }
      rows(label = (k) => k, sortBy = "total") {
        const out = [];
        for (const [k, r] of this.m) {
          const row = {
            key: k,
            label: label(k),
            tokens: toTokens(r.t),
            total: sumT4(r.t),
            turns: r.turns,
            calls: r.calls,
            sessions: r.sessions.size
          };
          if (r.group) row.group = r.group;
          if (r.last) row.lastUsed = r.last;
          if (Object.keys(r.extra).length) row.extra = { ...r.extra };
          out.push(row);
        }
        out.sort((a, b) => sortBy === "total" ? b.total - a.total || b.calls - a.calls : b.calls - a.calls || b.total - a.total);
        return out;
      }
    };
    Ctx = class {
      constructor(store2) {
        this.store = store2;
        for (const s of store2.files.values()) {
          if (s.agentId === null) this.projectOfSession.set(s.sessionId, projectOf(s.cwd, s.projectDir));
        }
        for (const s of store2.files.values()) {
          if (!this.projectOfSession.has(s.sessionId)) this.projectOfSession.set(s.sessionId, projectOf(s.cwd, s.projectDir));
        }
      }
      store;
      projectOfSession = /* @__PURE__ */ new Map();
      project(s) {
        return this.projectOfSession.get(s.sessionId) ?? projectOf(s.cwd, s.projectDir);
      }
      *days(range) {
        for (const s of this.store.files.values()) {
          if (!s.lastTs || localDate(s.lastTs) < range.from || localDate(s.firstTs || s.lastTs) > range.to) continue;
          for (const [date, b] of Object.entries(s.days)) if (date >= range.from && date <= range.to) yield { s, date, b };
        }
      }
    };
    memo = /* @__PURE__ */ new Map();
  }
});

// shared/api.ts
var TERMINAL_APPS, TERMINAL_NAMES, INSIGHT_PAGES, NOTIFY_EVENTS, SOUND_THEMES, rule, DEFAULT_SETTINGS;
var init_api = __esm({
  "shared/api.ts"() {
    "use strict";
    TERMINAL_APPS = ["warp", "iterm", "terminal", "ghostty", "wezterm", "kitty", "alacritty", "vscode", "cursor", "windsurf"];
    TERMINAL_NAMES = {
      warp: "Warp",
      iterm: "iTerm2",
      terminal: "Terminal",
      ghostty: "Ghostty",
      wezterm: "WezTerm",
      kitty: "kitty",
      alacritty: "Alacritty",
      vscode: "VS Code",
      cursor: "Cursor",
      windsurf: "Windsurf"
    };
    INSIGHT_PAGES = ["skills", "mcp", "startup", "tools", "subagents", "sessions", "overview", "limits", "session"];
    NOTIFY_EVENTS = ["session_waiting", "session_done", "subagent_finished", "subagent_spawned", "compaction", "context_high", "limit_high", "limit_forecast"];
    SOUND_THEMES = ["orbit", "minimal", "retro"];
    rule = (sound, browser, toast, browserHiddenOnly = false) => ({ sound, browser, browserHiddenOnly, toast, system: false });
    DEFAULT_SETTINGS = {
      notifications: {
        session_waiting: rule(true, true, true),
        session_done: rule(true, true, true, true),
        subagent_finished: rule(true, false, false),
        subagent_spawned: rule(false, false, false),
        compaction: rule(false, false, false),
        context_high: rule(false, false, false),
        limit_high: rule(false, false, false),
        limit_forecast: rule(true, false, true)
      },
      sound: { enabled: true, volume: 0.6, theme: "orbit" },
      dnd: { enabled: false, quietHours: { enabled: false, from: "22:00", to: "08:00" }, mutedUntil: null },
      interface: { lang: "en", autoTour: false, reduceMotion: false, showAutomated: false, showCowork: true },
      layout: { gravity: true, pins: {} },
      recommendations: { unusedDays: 30, dismissed: [] },
      terminal: { app: "auto" },
      sessionNames: {}
    };
  }
});

// shared/settings.ts
function cleanSessionName(v) {
  if (typeof v !== "string") return "";
  return [...v.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim()].slice(0, MAX_SESSION_NAME).join("").trim();
}
function normalizeSessionNames(v) {
  if (!isObj(v)) return null;
  const ok = [];
  for (const [k, n] of Object.entries(v)) {
    const name = cleanSessionName(n);
    if (SESSION_ID.test(k) && name) ok.push([k, name]);
  }
  return Object.fromEntries(ok.slice(-MAX_SESSION_NAMES));
}
function normalizeDismissed(v) {
  if (!Array.isArray(v)) return null;
  const seen = /* @__PURE__ */ new Set();
  for (const x of v) if (typeof x === "string" && DISMISS_ID.test(x)) {
    seen.delete(x);
    seen.add(x);
  }
  return [...seen].slice(-MAX_DISMISSED);
}
function normalizePins(v) {
  if (!isObj(v)) return null;
  const ok = [];
  for (const [k, p] of Object.entries(v)) {
    if (!PIN_KEY.test(k) || !isObj(p)) continue;
    const x = unit(p.x), y = unit(p.y);
    if (x !== null && y !== null) ok.push([k, { x, y }]);
  }
  return Object.fromEntries(ok.slice(-MAX_PINS));
}
function isTerminalChoice(v) {
  return v === "auto" || v === "off" || TERMINAL_APPS.includes(v);
}
function cloneSettings(s) {
  return JSON.parse(JSON.stringify(s));
}
function normalizeSettings(patch, base = DEFAULT_SETTINGS, now = Date.now()) {
  const out = cloneSettings(base);
  if (!isObj(out.recommendations)) out.recommendations = cloneSettings(DEFAULT_SETTINGS).recommendations;
  if (!isObj(out.terminal)) out.terminal = cloneSettings(DEFAULT_SETTINGS).terminal;
  if (typeof out.interface.showCowork !== "boolean") out.interface.showCowork = DEFAULT_SETTINGS.interface.showCowork;
  if (!isObj(out.sessionNames)) out.sessionNames = {};
  if (!isObj(patch)) return out;
  const n = patch.notifications;
  if (isObj(n)) {
    for (const ev of NOTIFY_EVENTS) {
      const r2 = n[ev];
      if (!isObj(r2)) continue;
      const cur = out.notifications[ev];
      out.notifications[ev] = {
        sound: bool(r2.sound, cur.sound),
        browser: bool(r2.browser, cur.browser),
        browserHiddenOnly: bool(r2.browserHiddenOnly, cur.browserHiddenOnly),
        toast: bool(r2.toast, cur.toast),
        system: bool(r2.system, cur.system)
      };
    }
  }
  const s = patch.sound;
  if (isObj(s)) {
    out.sound.enabled = bool(s.enabled, out.sound.enabled);
    if (typeof s.volume === "number" && Number.isFinite(s.volume)) out.sound.volume = Math.round(Math.min(1, Math.max(0, s.volume)) * 100) / 100;
    if (SOUND_THEMES.includes(s.theme)) out.sound.theme = s.theme;
  }
  const d = patch.dnd;
  if (isObj(d)) {
    out.dnd.enabled = bool(d.enabled, out.dnd.enabled);
    const q2 = d.quietHours;
    if (isObj(q2)) {
      out.dnd.quietHours = { enabled: bool(q2.enabled, out.dnd.quietHours.enabled), from: time(q2.from, out.dnd.quietHours.from), to: time(q2.to, out.dnd.quietHours.to) };
    }
    if (d.mutedUntil === null) out.dnd.mutedUntil = null;
    else if (typeof d.mutedUntil === "number" && Number.isFinite(d.mutedUntil)) {
      out.dnd.mutedUntil = d.mutedUntil <= now ? null : Math.round(Math.min(d.mutedUntil, now + MAX_MUTE_MS));
    }
  }
  const i = patch.interface;
  if (isObj(i)) {
    if (i.lang === "en" || i.lang === "uk") out.interface.lang = i.lang;
    out.interface.autoTour = bool(i.autoTour, out.interface.autoTour);
    out.interface.reduceMotion = bool(i.reduceMotion, out.interface.reduceMotion);
    out.interface.showAutomated = bool(i.showAutomated, out.interface.showAutomated);
    out.interface.showCowork = bool(i.showCowork, out.interface.showCowork ?? true);
  }
  const l = patch.layout;
  if (isObj(l)) {
    out.layout.gravity = bool(l.gravity, out.layout.gravity);
    const pins = normalizePins(l.pins);
    if (pins) out.layout.pins = pins;
  }
  const r = patch.recommendations;
  if (isObj(r)) {
    if (typeof r.unusedDays === "number" && Number.isFinite(r.unusedDays)) {
      out.recommendations.unusedDays = Math.round(Math.min(RECOMMEND_DAYS.max, Math.max(RECOMMEND_DAYS.min, r.unusedDays)));
    }
    const ids = normalizeDismissed(r.dismissed);
    if (ids) out.recommendations.dismissed = ids;
  }
  const names3 = normalizeSessionNames(patch.sessionNames);
  if (names3) out.sessionNames = names3;
  const tm = patch.terminal;
  if (isObj(tm) && isTerminalChoice(tm.app)) out.terminal.app = tm.app;
  return out;
}
function parseHHMM(s) {
  const m = HHMM.exec(s);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
function inQuietHours(from, to, date) {
  const a = parseHHMM(from);
  const b = parseHHMM(to);
  if (a === null || b === null || a === b) return false;
  const m = date.getHours() * 60 + date.getMinutes();
  return a < b ? m >= a && m < b : m >= a || m < b;
}
function isSilenced(s, now = Date.now()) {
  if (s.dnd.enabled) return true;
  if (s.dnd.mutedUntil && s.dnd.mutedUntil > now) return true;
  const q2 = s.dnd.quietHours;
  return q2.enabled && inQuietHours(q2.from, q2.to, new Date(now));
}
var isObj, bool, HHMM, time, MAX_MUTE_MS, MAX_PINS, PIN_KEY, RECOMMEND_DAYS, MAX_DISMISSED, DISMISS_ID, MAX_SESSION_NAMES, MAX_SESSION_NAME, SESSION_ID, unit;
var init_settings = __esm({
  "shared/settings.ts"() {
    "use strict";
    init_api();
    isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
    bool = (v, d) => typeof v === "boolean" ? v : d;
    HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
    time = (v, d) => typeof v === "string" && HHMM.test(v.trim()) ? v.trim() : d;
    MAX_MUTE_MS = 7 * 24 * 36e5;
    MAX_PINS = 64;
    PIN_KEY = /^(star|cluster):[^\u0000-\u001f]{1,240}$/;
    RECOMMEND_DAYS = { min: 7, max: 365 };
    MAX_DISMISSED = 500;
    DISMISS_ID = /^[\w:.@~+\-/]{1,200}$/;
    MAX_SESSION_NAMES = 2e3;
    MAX_SESSION_NAME = 120;
    SESSION_ID = /^[\w-]{1,100}$/;
    unit = (v) => typeof v === "number" && Number.isFinite(v) ? Math.round(Math.min(1, Math.max(0, v)) * 1e4) / 1e4 : null;
  }
});

// server/types.ts
var SUMMARY_VERSION, MIN_SUMMARY_VERSION;
var init_types = __esm({
  "server/types.ts"() {
    "use strict";
    SUMMARY_VERSION = 9;
    MIN_SUMMARY_VERSION = 5;
  }
});

// server/db.ts
import fs3 from "node:fs";
import { createRequire } from "node:module";
import path4 from "node:path";
function loadSqlite() {
  if (sqliteMod) return sqliteMod;
  const orig = process.emitWarning;
  process.emitWarning = function(warning, ...rest) {
    const msg = typeof warning === "string" ? warning : warning?.message;
    const opt = rest[0];
    const type = typeof opt === "string" ? opt : opt?.type ?? (typeof warning === "object" ? warning?.name : void 0);
    if (type === "ExperimentalWarning" && /sqlite/i.test(String(msg))) return;
    return orig.call(process, warning, ...rest);
  };
  try {
    sqliteMod = createRequire(import.meta.url)("node:sqlite");
  } finally {
    process.emitWarning = orig;
  }
  return sqliteMod;
}
var sqliteMod, MIGRATIONS, SCHEMA_VERSION, ClorbitDb;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_types();
    sqliteMod = null;
    MIGRATIONS = [
      // v1: summaries, hook events, limits history.
      (db2) => db2.exec(`
    CREATE TABLE file_summaries (
      path          TEXT PRIMARY KEY,
      session_id    TEXT NOT NULL,
      agent_id      TEXT,
      version       INTEGER NOT NULL,
      size          INTEGER NOT NULL,
      mtime_ms      REAL NOT NULL,
      byte_offset   INTEGER NOT NULL,
      first_ts      INTEGER NOT NULL,
      last_ts       INTEGER NOT NULL,
      summary_json  TEXT NOT NULL,
      missing_since INTEGER,
      updated_at    INTEGER NOT NULL
    );
    CREATE INDEX file_summaries_session ON file_summaries(session_id);

    CREATE TABLE hook_events (
      id                INTEGER PRIMARY KEY,
      ts                INTEGER NOT NULL,
      session_id        TEXT,
      event             TEXT NOT NULL,
      tool              TEXT,
      agent_id          TEXT,
      notification_type TEXT,
      payload_json      TEXT NOT NULL
    );
    CREATE INDEX hook_events_ts ON hook_events(ts);
    CREATE INDEX hook_events_session_ts ON hook_events(session_id, ts);

    CREATE TABLE limits (
      ts             INTEGER PRIMARY KEY,
      five_pct       REAL,
      five_resets_at INTEGER,
      week_pct       REAL,
      week_resets_at INTEGER
    );
  `),
      // v2: user settings (notifications, sounds, do not disturb, interface), one JSON value per key.
      (db2) => db2.exec(`
    CREATE TABLE settings (
      key        TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `)
    ];
    SCHEMA_VERSION = MIGRATIONS.length;
    ClorbitDb = class _ClorbitDb {
      constructor(file) {
        this.file = file;
        const { DatabaseSync } = loadSqlite();
        if (file !== ":memory:") fs3.mkdirSync(path4.dirname(file), { recursive: true });
        this.db = new DatabaseSync(file);
        this.db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;");
        this.migrate();
      }
      file;
      db;
      stmts = /* @__PURE__ */ new Map();
      static open(file) {
        return new _ClorbitDb(file);
      }
      /** Cached prepared statement. */
      stmt(sql) {
        let s = this.stmts.get(sql);
        if (!s) this.stmts.set(sql, s = this.db.prepare(sql));
        return s;
      }
      /** Runs fn inside BEGIN/COMMIT (rolls back on throw). */
      tx(fn) {
        this.db.exec("BEGIN IMMEDIATE");
        try {
          const v = fn();
          this.db.exec("COMMIT");
          return v;
        } catch (e) {
          try {
            this.db.exec("ROLLBACK");
          } catch {
          }
          throw e;
        }
      }
      getMeta(key) {
        const r = this.stmt("SELECT value FROM meta WHERE key = ?").get(key);
        return r ? r.value : null;
      }
      setMeta(key, value) {
        this.stmt("INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
      }
      get schemaVersion() {
        return Number(this.getMeta("schema_version") ?? 0);
      }
      migrate() {
        this.db.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
        const cur = this.schemaVersion;
        if (cur > SCHEMA_VERSION) throw new Error(`Database schema v${cur} is newer than this build (v${SCHEMA_VERSION})`);
        for (let v = cur; v < SCHEMA_VERSION; v++) {
          this.tx(() => {
            MIGRATIONS[v](this.db);
            this.setMeta("schema_version", String(v + 1));
          });
        }
      }
      // ---------- settings ----------
      getSetting(key) {
        const r = this.stmt("SELECT value_json FROM settings WHERE key = ?").get(key);
        return r ? r.value_json : null;
      }
      setSetting(key, valueJson, now = Date.now()) {
        this.stmt("INSERT INTO settings(key, value_json, updated_at) VALUES(?, ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at").run(key, valueJson, now);
      }
      // ---------- file summaries ----------
      /**
       * Loads summaries of versions MIN_SUMMARY_VERSION..SUMMARY_VERSION; rows of other versions stay in the DB untouched.
       * Older compatible rows of transcripts still on disk are re-parsed by the next scan (Store.coldScan); archived
       * ones keep their old summary, since there is nothing left to re-parse.
       */
      loadSummaries() {
        const rows = this.stmt("SELECT summary_json, missing_since FROM file_summaries WHERE version BETWEEN ? AND ?").all(MIN_SUMMARY_VERSION, SUMMARY_VERSION);
        const out = [];
        for (const r of rows) {
          try {
            out.push({ summary: JSON.parse(r.summary_json), missingSince: r.missing_since ?? null });
          } catch {
          }
        }
        return out;
      }
      /** Upserts summaries in a single transaction. */
      upsertSummaries(items) {
        if (!items.length) return;
        const st = this.stmt(`INSERT INTO file_summaries(path, session_id, agent_id, version, size, mtime_ms, byte_offset, first_ts, last_ts, summary_json, missing_since, updated_at)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET session_id = excluded.session_id, agent_id = excluded.agent_id, version = excluded.version,
        size = excluded.size, mtime_ms = excluded.mtime_ms, byte_offset = excluded.byte_offset, first_ts = excluded.first_ts,
        last_ts = excluded.last_ts, summary_json = excluded.summary_json, missing_since = excluded.missing_since, updated_at = excluded.updated_at`);
        const now = Date.now();
        this.tx(() => {
          for (const { summary: s, missingSince } of items) {
            st.run(s.path, s.sessionId, s.agentId, s.v, s.size, s.mtimeMs, s.offset, Math.round(s.firstTs || 0), Math.round(s.lastTs || 0), JSON.stringify(s), missingSince, now);
          }
        });
      }
      /** Updates only missing_since for the given paths (null = present again). */
      setMissing(items) {
        if (!items.length) return;
        const st = this.stmt("UPDATE file_summaries SET missing_since = ? WHERE path = ?");
        this.tx(() => {
          for (const it of items) st.run(it.missingSince, it.path);
        });
      }
      /**
       * One-time import of the legacy JSON cache (data/cache/summaries-v<N>.json).
       * Runs only when the DB has no summaries and no import was recorded. Only the
       * current SUMMARY_VERSION file is importable; others are reported and skipped.
       */
      importJsonCache(cacheDir) {
        if (this.getMeta("json_import")) return null;
        const n = this.stmt("SELECT COUNT(*) AS n FROM file_summaries").get().n;
        let names3 = [];
        try {
          names3 = fs3.readdirSync(cacheDir).filter((f) => /^summaries-v\d+\.json$/.test(f));
        } catch {
        }
        const want = `summaries-v${SUMMARY_VERSION}.json`;
        const skipped = names3.filter((f) => f !== want);
        if (n > 0 || !names3.includes(want)) {
          this.setMeta("json_import", JSON.stringify({ at: Date.now(), file: null, count: 0, skipped, reason: n > 0 ? "db-not-empty" : "no-current-cache" }));
          return null;
        }
        const file = path4.join(cacheDir, want);
        let files = [];
        try {
          const j = JSON.parse(fs3.readFileSync(file, "utf8"));
          if (j.version === SUMMARY_VERSION && Array.isArray(j.files)) files = j.files.filter((s) => s && typeof s.path === "string" && s.v === SUMMARY_VERSION);
        } catch (e) {
          console.warn("[clorbit] legacy JSON cache is unreadable, skipping import:", e.message);
        }
        this.upsertSummaries(files.map((summary) => ({ summary, missingSince: null })));
        this.setMeta("json_import", JSON.stringify({ at: Date.now(), file, count: files.length, skipped }));
        return { file, count: files.length, skipped };
      }
      stats() {
        const one = (sql) => this.stmt(sql).get().n;
        const size = (f) => {
          try {
            return fs3.statSync(f).size;
          } catch {
            return 0;
          }
        };
        let jsonImport = null;
        try {
          jsonImport = JSON.parse(this.getMeta("json_import") ?? "null");
        } catch {
        }
        return {
          path: this.file,
          sizeBytes: size(this.file),
          walBytes: size(this.file + "-wal"),
          schemaVersion: this.schemaVersion,
          rows: {
            fileSummaries: one("SELECT COUNT(*) AS n FROM file_summaries"),
            archived: one("SELECT COUNT(*) AS n FROM file_summaries WHERE missing_since IS NOT NULL"),
            staleVersion: this.stmt("SELECT COUNT(*) AS n FROM file_summaries WHERE version <> ?").get(SUMMARY_VERSION).n,
            hookEvents: one("SELECT COUNT(*) AS n FROM hook_events"),
            limits: one("SELECT COUNT(*) AS n FROM limits")
          },
          jsonImport
        };
      }
      close() {
        try {
          this.db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
        } catch {
        }
        this.db.close();
      }
    };
  }
});

// server/hook-log.ts
function trimShallow(v, maxStr, maxKeys) {
  if (typeof v === "string") return str(v, maxStr);
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return `[array:${v.length}]`;
  const out = {};
  let n = 0;
  for (const [k, x] of Object.entries(v)) {
    if (++n > maxKeys) {
      out._more = true;
      break;
    }
    out[k] = typeof x === "string" ? str(x, maxStr) : x !== null && typeof x === "object" ? Array.isArray(x) ? `[array:${x.length}]` : "[object]" : x;
  }
  return out;
}
function trimHookPayload(body) {
  const build = (maxStr, withInput) => {
    const out = {};
    for (const [k, v] of Object.entries(body)) {
      if (k === "tool_response") {
        let size = 0;
        try {
          size = JSON.stringify(v)?.length ?? 0;
        } catch {
        }
        out.tool_response_chars = size;
      } else if (k === "tool_input") {
        if (withInput) out.tool_input = trimShallow(v, Math.min(maxStr, 200), 12);
      } else {
        out[k] = trimShallow(v, maxStr, 12);
      }
    }
    return JSON.stringify(out);
  };
  for (const [maxStr, withInput] of [[500, true], [120, true], [120, false], [40, false]]) {
    const s = build(maxStr, withInput);
    if (Buffer.byteLength(s) <= MAX_PAYLOAD_BYTES) return s;
  }
  return JSON.stringify({ hook_event_name: str(body.hook_event_name ?? "", 64), session_id: str(body.session_id ?? "", 64), truncated: true });
}
function toHookRow(body, ts = Date.now()) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const event = String(body.hook_event_name ?? body.hookEventName ?? "");
  if (!event) return null;
  return {
    ts,
    sessionId: body.session_id ? str(body.session_id, 64) : null,
    event: str(event, 64),
    tool: body.tool_name ? str(body.tool_name, 200) : null,
    agentId: body.agent_id ? str(body.agent_id, 64) : null,
    notificationType: body.notification_type ? str(body.notification_type, 64) : null,
    payload: trimHookPayload(body)
  };
}
function waitStart(e) {
  if (e.event === "PermissionRequest") return { kind: "permission", tool: e.tool };
  if (e.event !== "Notification") return null;
  const type = e.notificationType ?? "";
  const msg = e.message ?? "";
  if (type === "idle_prompt" || /waiting for your input/i.test(msg)) return { kind: "input", tool: null };
  const m = /permission to use ([\w:.-]+)/i.exec(msg);
  if (type === "permission_prompt" || m) return { kind: "permission", tool: m ? m[1] : null };
  return null;
}
function deriveWaits(events, cap = WAIT_CAP_MS) {
  const sorted = [...events].sort((a, b) => a.ts - b.ts);
  const open = /* @__PURE__ */ new Map();
  const out = [];
  for (const e of sorted) {
    const w = waitStart(e);
    const cur = open.get(e.sessionId);
    if (w) {
      if (!cur) open.set(e.sessionId, { start: e.ts, ...w });
      else {
        if (w.kind === "permission" && cur.kind === "input") cur.kind = "permission";
        if (!cur.tool && w.tool) cur.tool = w.tool;
      }
      continue;
    }
    if (cur && WAIT_END.has(e.event)) {
      open.delete(e.sessionId);
      const tool = cur.tool ?? (cur.kind === "permission" && e.event.startsWith("PostToolUse") ? e.tool : null);
      out.push({ sessionId: e.sessionId, start: cur.start, end: Math.min(e.ts, cur.start + cap), kind: cur.kind, tool });
    }
  }
  return out;
}
function approvals(events, cap = WAIT_CAP_MS) {
  const sorted = [...events].sort((a, b) => a.ts - b.ts);
  const pending = /* @__PURE__ */ new Map();
  const pre = /* @__PURE__ */ new Map();
  const prompted = /* @__PURE__ */ new Set();
  const approved = [];
  const runs = [];
  for (const e of sorted) {
    const list = pending.get(e.sessionId) ?? [];
    if (e.event === "PermissionRequest" && e.tool) {
      list.push(e);
      pending.set(e.sessionId, list);
      if (e.toolUseId) prompted.add(e.toolUseId);
    } else if (e.event === "PreToolUse" && e.toolUseId) {
      pre.set(e.toolUseId, e);
    } else if (e.event === "PostToolUse" || e.event === "PostToolUseFailure") {
      const i = list.findIndex((r) => sameCall(r, e));
      if (i >= 0) {
        const r = list.splice(i, 1)[0];
        if (e.ts - r.ts <= cap) approved.push({ sessionId: e.sessionId, ts: r.ts, tool: r.tool, rawMs: Math.max(0, e.ts - r.ts), command: r.command, url: r.url, path: r.path, cwd: r.cwd ?? e.cwd });
      } else if (e.toolUseId && !prompted.has(e.toolUseId)) {
        const p = pre.get(e.toolUseId);
        if (p && e.ts >= p.ts) runs.push({ e: { ...p, command: p.command ?? e.command }, ms: e.ts - p.ts });
      }
      if (e.toolUseId) pre.delete(e.toolUseId);
    } else if (PERM_END.has(e.event)) {
      pending.delete(e.sessionId);
    }
  }
  return { approved, runs };
}
var HOOK_RETENTION_MS, MAX_PAYLOAD_BYTES, WAIT_CAP_MS, str, WAIT_END, PERM_END, sameCall, HookLog;
var init_hook_log = __esm({
  "server/hook-log.ts"() {
    "use strict";
    HOOK_RETENTION_MS = 90 * 24 * 36e5;
    MAX_PAYLOAD_BYTES = 4096;
    WAIT_CAP_MS = 6 * 36e5;
    str = (v, n) => {
      const s = String(v);
      return s.length > n ? s.slice(0, n) + "\u2026" : s;
    };
    WAIT_END = /* @__PURE__ */ new Set(["PreToolUse", "PostToolUse", "PostToolUseFailure", "UserPromptSubmit", "Stop", "SessionEnd"]);
    PERM_END = /* @__PURE__ */ new Set(["UserPromptSubmit", "Stop", "SessionEnd"]);
    sameCall = (a, b) => a.tool === b.tool && (!a.toolUseId || !b.toolUseId || a.toolUseId === b.toolUseId) && (!a.command || !b.command || a.command === b.command);
    HookLog = class {
      constructor(db2) {
        this.db = db2;
      }
      db;
      version = 0;
      queue = [];
      timer = null;
      pruneTimer = null;
      /** Starts retention: once now, then daily. */
      start() {
        this.prune();
        this.pruneTimer = setInterval(() => this.prune(), 24 * 36e5);
        this.pruneTimer.unref?.();
      }
      stop() {
        if (this.pruneTimer) clearInterval(this.pruneTimer);
        this.flush();
      }
      /** Queues a hook body; rows are written in one transaction shortly after. */
      record(body, ts = Date.now()) {
        if (!this.db) return;
        const row = toHookRow(body, ts);
        if (!row) return;
        this.queue.push(row);
        if (this.queue.length >= 200) this.flush();
        else if (!this.timer) {
          this.timer = setTimeout(() => this.flush(), 1e3);
          this.timer.unref?.();
        }
      }
      flush() {
        if (this.timer) {
          clearTimeout(this.timer);
          this.timer = null;
        }
        if (!this.db || !this.queue.length) return;
        const rows = this.queue.splice(0);
        const st = this.db.stmt("INSERT INTO hook_events(ts, session_id, event, tool, agent_id, notification_type, payload_json) VALUES(?, ?, ?, ?, ?, ?, ?)");
        try {
          this.db.tx(() => {
            for (const r of rows) st.run(r.ts, r.sessionId, r.event, r.tool, r.agentId, r.notificationType, r.payload);
          });
          this.version++;
        } catch (e) {
          console.error("[clorbit] could not write hook events:", e.message);
        }
      }
      prune(now = Date.now()) {
        if (!this.db) return 0;
        try {
          const r = this.db.stmt("DELETE FROM hook_events WHERE ts < ?").run(now - HOOK_RETENTION_MS);
          if (r.changes) this.version++;
          return Number(r.changes);
        } catch (e) {
          console.error("[clorbit] could not prune old hook events:", e.message);
          return 0;
        }
      }
      /** Whether any hook event exists in [from, to). */
      hasEvents(from, to) {
        if (!this.db) return false;
        this.flush();
        return !!this.db.stmt("SELECT 1 AS x FROM hook_events WHERE ts >= ? AND ts < ? LIMIT 1").get(from, to);
      }
      /** Events for approved permission prompts in [from, to) (see `approvals`). */
      permissionEvents(from, to) {
        if (!this.db) return [];
        this.flush();
        const rows = this.db.stmt(`SELECT ts, session_id, event, tool,
        json_extract(payload_json, '$.tool_use_id') AS tuid,
        json_extract(payload_json, '$.tool_input.command') AS command,
        json_extract(payload_json, '$.tool_input.url') AS url,
        COALESCE(json_extract(payload_json, '$.tool_input.file_path'), json_extract(payload_json, '$.tool_input.path')) AS path,
        json_extract(payload_json, '$.cwd') AS cwd
      FROM hook_events
      WHERE ts >= ? AND ts < ? AND session_id IS NOT NULL
        AND event IN ('PermissionRequest', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'UserPromptSubmit', 'Stop', 'SessionEnd')
      ORDER BY ts, id`).all(from, to);
        const str3 = (v) => typeof v === "string" && v ? v : null;
        return rows.map((r) => ({
          ts: Number(r.ts),
          sessionId: String(r.session_id),
          event: String(r.event),
          tool: str3(r.tool),
          toolUseId: str3(r.tuid),
          command: str3(r.command),
          url: str3(r.url),
          path: str3(r.path),
          cwd: str3(r.cwd)
        }));
      }
      /** Wait-relevant events in [from, to), with the Notification message pulled from the payload. */
      waitEvents(from, to) {
        if (!this.db) return [];
        this.flush();
        const rows = this.db.stmt(`SELECT ts, session_id, event, tool, notification_type,
        CASE WHEN event = 'Notification' THEN json_extract(payload_json, '$.message') END AS message
      FROM hook_events
      WHERE ts >= ? AND ts < ? AND session_id IS NOT NULL
        AND event IN ('Notification', 'PermissionRequest', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'UserPromptSubmit', 'Stop', 'SessionEnd')
      ORDER BY ts, id`).all(from, to);
        return rows.map((r) => ({ ts: r.ts, sessionId: r.session_id, event: r.event, tool: r.tool, notificationType: r.notification_type, message: r.message }));
      }
    };
  }
});

// server/hooks.ts
var Hooks;
var init_hooks = __esm({
  "server/hooks.ts"() {
    "use strict";
    init_util();
    Hooks = class {
      installed = false;
      recent = [];
      bySession = /* @__PURE__ */ new Map();
      /** Takes a hook's JSON payload and returns the events that clearly follow from it. */
      ingest(body) {
        if (!body || typeof body !== "object") return [];
        this.installed = true;
        const ts = Date.now();
        const ev = String(body.hook_event_name ?? body.hookEventName ?? "");
        const sessionId = body.session_id ? String(body.session_id) : null;
        const tool = body.tool_name ? String(body.tool_name) : null;
        this.recent.push({ ts, event: ev, sessionId, tool });
        if (this.recent.length > 500) this.recent.splice(0, this.recent.length - 500);
        if (!sessionId) return [];
        const agentId = body.agent_id ? String(body.agent_id) : "main";
        const out = [];
        const setStatus = (status, reason) => {
          const prev = this.bySession.get(sessionId);
          this.bySession.set(sessionId, { status, reason, ts });
          if (!prev || prev.status !== status || JSON.stringify(prev.reason) !== JSON.stringify(reason)) out.push({ kind: "status", ts, sessionId, status, reason });
        };
        switch (ev) {
          case "SessionStart":
            setStatus("idle", { k: "sessionStarted" });
            break;
          case "UserPromptSubmit":
            out.push({ kind: "prompt", ts, sessionId });
            setStatus("working", { k: "gotPrompt" });
            break;
          case "PreToolUse":
            if (tool) out.push({ kind: "tool", ts, sessionId, agentId, tool, label: toolLabel(tool, body.tool_input) });
            if (agentId === "main") setStatus("working", tool ? { k: "running", a: toolLabel(tool, body.tool_input) } : { k: "working" });
            break;
          case "PostToolUse":
            if (agentId === "main") setStatus("working", { k: "working" });
            break;
          case "Notification": {
            const msg = String(body.message ?? "");
            const type = String(body.notification_type ?? "");
            const m = /permission to use ([\w:.-]+)/i.exec(msg);
            if (type === "idle_prompt" || /waiting for your input/i.test(msg)) setStatus("waiting", { k: "waitingInput" });
            else setStatus("waiting", m ? { k: "waitingPermission", a: m[1] } : { k: "waitingYou" });
            break;
          }
          case "PermissionRequest":
            setStatus("waiting", tool ? { k: "waitingPermission", a: tool } : { k: "waitingPermissionAny" });
            break;
          case "Stop":
            setStatus("idle", { k: "answerReady" });
            break;
          case "SubagentStart":
            out.push({ kind: "spawn", ts, sessionId, parentId: "main", agentId, agentType: String(body.agent_type ?? "general-purpose"), description: null });
            break;
          case "SubagentStop":
            out.push({ kind: "finish", ts, sessionId, agentId, parentId: "main", tokens: 0 });
            break;
          case "PreCompact":
            out.push({ kind: "compact", ts, sessionId });
            break;
          case "SessionEnd":
            setStatus("stopped", { k: "sessionEnded" });
            break;
        }
        return out;
      }
    };
  }
});

// shared/insights.ts
function homePage(ins) {
  return ins.pages?.[0] ?? null;
}
function bySavings(a, b) {
  return (b.estSavingTokens ?? 0) - (a.estSavingTokens ?? 0) || (b.saving?.waitMs ?? 0) - (a.saving?.waitMs ?? 0) || SEV_RANK[a.severity] - SEV_RANK[b.severity] || a.id.localeCompare(b.id);
}
function pickOverview(list, n = OVERVIEW_MAX * 4) {
  return list.filter((i) => {
    const home = homePage(i);
    if (!home || home === "limits" || home === "session" || home === "overview") return false;
    return (i.estSavingTokens ?? 0) > 0 || (i.saving?.waitMs ?? 0) > 0 || i.severity !== "info";
  }).sort(bySavings).slice(0, n);
}
var SEV_RANK, OVERVIEW_MAX;
var init_insights = __esm({
  "shared/insights.ts"() {
    "use strict";
    SEV_RANK = { high: 0, warn: 1, info: 2 };
    OVERVIEW_MAX = 3;
  }
});

// server/insights-text.ts
function en() {
  const N = (n) => fmtNum(n, "en");
  const D = (ms) => fmtDuration(ms, "en");
  const times = (n) => `${n} ${plural(n, "en", ["time", "times"])}`;
  const long = (ms) => ms >= 48 * 36e5 ? `${Math.floor(ms / 864e5)} d ${Math.round(ms % 864e5 / 36e5)} h` : D(ms);
  return {
    pct,
    unknownTool: "unknown tool",
    noPlugin: "no plugin",
    quote: (s) => `\u201C${s}\u201D`,
    waits: {
      title: (total, longest) => `You kept agents waiting for ${D(total)} in this period; the longest wait was ${D(longest)}`,
      detail: (n, perm, input, where, date, capH) => `According to hooks, sessions waited for you ${times(n)}: ${[
        perm ? `for tool permission ${times(perm.n)} (${D(perm.ms)})` : "",
        input ? `for your reply ${times(input.n)} (${D(input.ms)})` : ""
      ].filter(Boolean).join(", ")}. The longest wait: ${where}, ${date}. A single wait over ${capH} h counts as ${capH} h.`,
      toolLine: (tool, n, ms) => `${tool}: ${n} permission ${plural(n, "en", ["request", "requests"])}, ${D(ms)} in total`,
      inputLine: (n, ms) => `Waiting for your reply: ${times(n)}, ${D(ms)} in total`,
      fixPerm: (allow) => `Pre-approve safe, frequent tools: "permissions": { "allow": [${allow}] } in the project's .claude/settings.json (for Bash \u2014 specific commands only). Long waits for replies are a reason to enable notifications or give agents longer autonomous tasks.`,
      fixInput: "Long waits for replies are a reason to enable notifications or give agents longer autonomous tasks with a clear definition of done."
    },
    skillListing: {
      title: (per, perSub) => `Skill listing: ~${N(per)} tokens per session${perSub ? ` and ~${N(perSub)} per subagent` : ""}`,
      detail: (perSub, total) => `Descriptions of all available skills are injected at the start of every session${perSub ? " and every subagent" : ""}. In total \u2248 ${N(total)} tokens in this period.`,
      evidence: (p, tok) => `${p}: \u2248 ${N(tok)} tokens in total`,
      fix: "Disable plugins whose skills you do not use (enabledPlugins in ~/.claude/settings.json), remove unneeded skills from ~/.claude/skills, and shorten your own skills' descriptions to one sentence."
    },
    startupTotal: {
      title: (perMain, perSub) => `Startup context: ~${N(perMain)} tokens per session${perSub ? `, ~${N(perSub)} per subagent` : ""}`,
      detail: (total) => `Before the first prompt, the context already holds the system prompt, tool definitions, skill and agent listings, CLAUDE.md and more. In total \u2248 ${N(total)} tokens in this period (estimated from text length); after that they are read from cache on every turn.`,
      evidence: (label, per, perSub) => `${label}: \u2248 ${N(per)} per session${perSub ? `, \u2248 ${N(perSub)} per subagent` : ""}`,
      fix: "The easiest wins: shorten the skill listing (disable unused plugins, remove unneeded skills) and CLAUDE.md; do small tasks without a separate subagent \u2014 each subagent pays this startup cost again."
    },
    bigResults: {
      example: (label, tok, project) => `${label} \u2014 ${N(tok)} tokens (${project})`
    },
    autoCompactions: {
      title: (total, sessions2) => `${total} auto-${plural(total, "en", ["compaction", "compactions"])} in ${sessions2} ${plural(sessions2, "en", ["session", "sessions"])}`,
      detail: "Auto-compaction means the context hit its limit: some details are lost, and the compaction itself costs an extra large turn.",
      fix: (pctEnv) => `Split big tasks into stages: after each stage, write a short summary into the plan file and /clear; hand research and bulk reads to subagents (Explore) so raw results stay out of the main context.${pctEnv ? ` Current threshold: CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=${pctEnv}.` : ""}`
    },
    skillShare: {
      title: (key, share, loads) => `Skill ${key}: ${pct(share)} of all tokens${loads ? `, ${loads} loads` : ""}`,
      detail: (key, total, sessions2, perLoad) => `Turns attributed to ${key} used \u2248 ${N(total)} tokens in ${sessions2} sessions${perLoad !== null ? ` (\u2248 ${N(perLoad)} per load)` : ""}. That is not necessarily bad \u2014 but make sure the skill does not pull in more than it needs.`,
      turns: (turns, sessions2) => `Turns: ${N(turns)}, sessions: ${sessions2}`,
      tokens: (out, write) => `Output tokens: ${N(out)}, cache writes: ${N(write)}`,
      fix: "Check SKILL.md: move reference sections into separate files the skill reads only when needed; sharpen the description so the skill does not trigger where it is not needed."
    },
    skillLoads: {
      title: "Most frequently loaded skills",
      detail: "How many times Skill was invoked and what share of tokens the turns under that skill took.",
      evidence: (key, loads, share) => `${key}: ${loads}\xD7 \u2014 ${pct(share)} of tokens`
    },
    lowCache: {
      title: (n, avg) => `${n} ${plural(n, "en", ["day", "days"])} with a low cache hit rate (average ${pct(avg)})`,
      detail: "On these days a large part of the context was written to the cache again instead of being read from it. Cache writes cost more than reads and burn through limits faster.",
      evidence: (date, rate, write, input) => `${date}: cache ${pct(rate)}, cache writes ${N(write)}, uncached ${N(input)}`,
      fix: "The prompt cache lives for a limited time: after a long pause, start a new session with a short summary instead of continuing a large one. Do not switch model/effort or change CLAUDE.md or the MCP set in the middle of a long session \u2014 that resets the cache."
    },
    hooks: {
      title: (plugin, n, min, err) => `Hooks ${plugin ? `of plugin ${plugin}` : "without a plugin"}: ${N(n)} runs, ${min} min of execution${err !== null ? `, ${pct(err)} with an error or stderr` : ""}`,
      detail: (names3, min, err) => `Hooks (${names3}) run as a separate process on every such event; their total execution time is \u2248 ${min} min.${err !== null ? ` ${pct(err)} of runs ended with an error or wrote to stderr.` : ""}`,
      runs: (n) => `Runs: ${N(n)}`,
      time: (sec) => `Total time: ${sec}s`,
      errors: (n) => `With error/stderr: ${N(n)}`,
      fix: (plugin, key) => `If plugin ${plugin} is not needed in this environment, disable it: "enabledPlugins": { "${key}": false } in ~/.claude/settings.json.`,
      fixNoPlugin: "Review the hook commands in ~/.claude/settings.json: are they needed on every event?"
    },
    // Recommendations (recommend-*.ts). Prompt items reuse `why` lines, so they read well on their own.
    rec: {
      lastUsed: (days) => days === 0 ? "last used today" : `last used ${days} ${plural(days, "en", ["day", "days"])} ago`,
      never: (since) => since ? `never used (listed since ${since})` : "never used",
      perSession: (tok) => `\u2248 ${N(tok)} tokens of context per session`,
      parts: (p) => [
        p.skills ? `skill descriptions ${N(p.skills)}` : "",
        p.hook ? `SessionStart hook ${N(p.hook)}` : "",
        p.mcp ? `MCP instructions ${N(p.mcp)}` : ""
      ].filter(Boolean).join(" + "),
      unusedPlugins: {
        titleOne: (name, last) => `Plugin ${name} is enabled but ${last}`,
        titleMany: (n, days) => `${n} enabled plugins have not been used for ${days}+ days`,
        detail: (days) => `No skill calls, MCP tool calls or attributed turns in the whole stored history for at least ${days} days (archived sessions included). They still load into every new session and every subagent that gets the skill listing.`,
        evidence: (name, last, per, parts) => `${name}: ${last}; \u2248 ${N(per)} tokens per session${parts ? ` (${parts})` : ""}`,
        why: (last, per) => `${last}; \u2248 ${N(per)} tokens of context per session`,
        summary: (n, days) => `${n} enabled ${plural(n, "en", ["plugin has", "plugins have"])} not been used for ${days}+ days but still add to the startup context of every session.`
      },
      hookContext: {
        title: (plugin, per) => `Plugin ${plugin} adds ~${N(per)} tokens to every session, also where it is not used`,
        detail: (plugin, used, total, projects) => `Its SessionStart hook injects a block of text at the start of every session, yet the skills or tools of ${plugin} were used in ${used} of ${total} such sessions in this period${projects.length ? ` (projects: ${projects.join(", ")})` : ""}. Disable it globally and enable it only where you use it.`,
        sessions: (used, total) => `Used in ${used} of ${total} sessions that carried the hook block`,
        perSession: (per) => `Hook block: \u2248 ${N(per)} tokens per session`,
        why: (per, used, total) => `its SessionStart hook adds \u2248 ${N(per)} tokens to every session, but it was used in ${used} of ${total} sessions`,
        whyEnable: (project) => `you use it in ${project}`,
        skillsUnused: (n, total, days) => `${n} of its ${total} skills not used for ${days}+ days`,
        summary: (plugin, per) => `plugin ${plugin} injects \u2248 ${N(per)} tokens into every session through its SessionStart hook, but is used only in a few projects.`,
        fix: (plugin, key) => `If ${plugin} is not needed in every project, disable it globally (claude plugin disable ${key} --scope user) and enable it where you use it (claude plugin enable ${key} --scope local inside that project).`
      },
      unusedSkills: {
        title: (plugin, n, total, days) => `Plugin ${plugin}: ${n} of ${total} skills not used for ${days}+ days`,
        detail: (plugin, unusedTok, totalTok) => `Their descriptions take \u2248 ${N(unusedTok)} of the \u2248 ${N(totalTok)} listing tokens of ${plugin} in every session. A plugin's skills cannot be turned off one by one, so the choice is the whole plugin: disable it if you can do without the skills you still use.`,
        stillUsed: (list) => `Still in use: ${list}`,
        noneUsed: "None of its listed skills was used recently; only its hooks or MCP tools were",
        mcpUsed: (last) => `Its MCP tools: ${last}`,
        why: (n, total, used) => `${n} of its ${total} skills not used recently${used ? `; still in use: ${used}` : ""}`,
        summary: (plugin, n, total, days) => `${n} of the ${total} skills of plugin ${plugin} have not been used for ${days}+ days.`
      },
      unusedOwn: {
        title: (n, days) => `${n} of your own ${plural(n, "en", ["skills has", "skills have"])} not been used for ${days}+ days`,
        detail: (dir) => `Skills in ${dir} are listed in every session and every subagent that gets the skill listing. Moving a folder to a "-disabled" folder next to it takes it out of the listing and keeps it safe to bring back.`,
        evidence: (name, last, per) => `${name}: ${last}; \u2248 ${N(per)} tokens per session`,
        why: (last, per) => `${last}; \u2248 ${N(per)} tokens of context per session`,
        summary: (n, days) => `${n} of my own ${plural(n, "en", ["skills has", "skills have"])} not been used for ${days}+ days.`
      },
      duplicates: {
        title: (n) => `${n} ${plural(n, "en", ["skill name appears", "skill names appear"])} more than once in the skill listing`,
        detail: "The same name in several plugins, or your own skill next to a plugin skill of the same name: both descriptions are paid for in every session, and the model may pick the wrong one.",
        own: "your own",
        copy: (label, last) => `${label} \u2014 ${last}`,
        evidence: (name, copies) => `${name}: ${copies}`,
        whyMove: (keep, keepLast) => `the same skill also comes from ${keep} (${keepLast})`,
        reviewAction: (key, keep) => `Compare the skill ${key} with ${keep}`,
        whyReview: (plugin) => `a plugin skill cannot be turned off alone; tell me whether disabling ${plugin} as a whole makes sense, and which copy to keep`,
        summary: (n) => `${n} skill ${plural(n, "en", ["name is", "names are"])} listed more than once.`
      },
      // ---------- MCP (recommend-mcp.ts) ----------
      mcpParts: (p) => [
        p.instr ? `instructions ${N(p.instr)}` : "",
        p.defs ? `tool definitions ${N(p.defs)}` : "",
        p.names ? `tool names ${N(p.names)}` : ""
      ].filter(Boolean).join(" + "),
      mcpSource: {
        user: (file) => `user config (${file})`,
        local: (dirs) => `local config of ${dirs.join(", ")}`,
        project: (dirs) => `.mcp.json of ${dirs.join(", ")}`,
        plugin: (plugin) => `plugin ${plugin}`,
        claudeai: "claude.ai connector",
        unknown: "configured elsewhere"
      },
      unusedMcp: {
        titleOne: (name, last) => `MCP server ${name} is connected but ${last}`,
        titleMany: (n, days) => `${n} connected MCP ${plural(n, "en", ["server has", "servers have"])} not been used for ${days}+ days`,
        detail: (days) => `No calls of their tools in the whole stored history for at least ${days} days (archived sessions included), yet every new session and subagent loads them: their instructions and their tools. With tool search on, only tool names are listed at the start (schemas load when a tool is used), so the saving is mostly the instructions and the names.`,
        evidence: (name, source, last, per, parts) => `${name} (${source}): ${last}; \u2248 ${N(per)} tokens per session${parts ? ` (${parts})` : ""}`,
        noSize: "size not measured (older transcripts)",
        why: (last, per) => `${last}${per ? `; \u2248 ${N(per)} tokens of context per session` : ""}`,
        summary: (n, days) => `${n} connected MCP ${plural(n, "en", ["server has", "servers have"])} not been used for ${days}+ days but still load into every session.`,
        alsoFailed: (n) => `also failed to connect in ${n} ${plural(n, "en", ["session", "sessions"])}`,
        pluginAction: (name, plugin) => `MCP server ${name} comes with the plugin ${plugin}`,
        pluginUnusedWhy: (server2, last) => `its MCP server ${server2} is unused, and so is the plugin as a whole: ${last}`,
        pluginWhy: (last, key) => `${last}. The plugin itself is still in use, and its server cannot be turned off alone: in a project that does not need it, turn it off in /mcp (that project only); or, if you can do without the whole plugin, disable it (claude plugin disable ${key} --scope user). Tell me which you prefer`,
        connectorAction: (name) => `Disconnect the claude.ai connector ${name}`,
        connectorWhy: (last) => `${last}. Claude Code cannot do this for me: disconnect it on claude.ai \u2192 Settings \u2192 Connectors (it then disappears everywhere), or turn it off for one project in /mcp`,
        connectorsAllWhy: (n, days) => `none of the ${n} claude.ai ${plural(n, "en", ["connector", "connectors"])} Claude Code loads was used for ${days}+ days`,
        unknownAction: (name) => `Find where the MCP server ${name} is configured`,
        unknownWhy: (last) => `${last}. It is not in ~/.claude.json or a project's .mcp.json (managed settings, --mcp-config, an IDE or a plugin?): run claude mcp get with its name and tell me how it could be turned off`
      },
      mcpFailing: {
        titleOne: (name) => `MCP server ${name} keeps failing`,
        titleMany: (n) => `${n} MCP servers keep failing to connect or erroring`,
        detail: "In this period these servers failed to connect, needed you to sign in, or most of their calls returned errors. A failing server is still tried at every start, and its tools are missing when a task needs them. Connection failures are recorded by recent Claude Code versions only.",
        failed: (a, b, err) => `failed to connect in ${a} of ${b} sessions${err ? ` (last error: ${err})` : ""}`,
        auth: (a) => `needed sign-in in ${a} ${plural(a, "en", ["session", "sessions"])}`,
        errors: (e, c) => `${e} of ${c} tool calls returned an error`,
        evidence: (name, facts) => `${name}: ${facts}`,
        authAction: (name) => `Sign in to the MCP server ${name} again`,
        authWhy: (facts, connector, name) => `${facts}. ${connector ? "Reconnect it on claude.ai \u2192 Settings \u2192 Connectors, or " : ""}run /mcp in Claude Code and choose Authenticate (or claude mcp login ${name} in a terminal); I have to do the sign-in myself \u2014 tell me what to click`,
        fixAction: (name) => `Find out why the MCP server ${name} fails`,
        fixWhy: (facts, name) => `${facts}. claude mcp get ${name} shows its status and the error; suggest a fix for the command, URL or credentials. If I no longer need it, tell me how to turn it off instead`,
        summary: (n) => `${n} MCP ${plural(n, "en", ["server keeps", "servers keep"])} failing to connect or returning errors.`
      },
      mcpHeavy: {
        title: (server2, n, max) => `MCP server ${server2}: ${n} ${plural(n, "en", ["result", "results"])} over 20K tokens (up to ${N(max)})`,
        detail: (sum) => `Each oversized result lands in the context at once and is re-read on every following turn. \u2248 ${N(sum)} tokens in this period; the estimate assumes \u2248 5K would have been enough per call.`,
        tipBrowser: "Browser: take screenshots at a lower scale or zoom into a region, read the page with a filter (interactive elements) or get_page_text / find instead of the full tree, close tabs you do not need.",
        tipGithub: "GitHub: narrower queries (per_page, filters, a path), a line range instead of whole files, the list of changed files before full diffs.",
        tipFigma: "Figma: get_metadata first, then design context for specific node ids instead of whole pages; avoid full-page screenshots.",
        tipGeneric: (server2) => `Ask ${server2} for less: filters, limits, only the fields you need, pagination.`,
        action: (server2, tools) => `Review how I call ${server2} (${tools})`,
        why: (n, max, tip) => `${n} results over 20K tokens, up to ${N(max)}. ${tip} Suggest concrete call patterns; if a short line in a project CLAUDE.md would help, propose it, but do not add it unless I agree`,
        summary: (server2, n) => `${n} results of the ${server2} MCP server were over 20K tokens.`
      },
      mcpProjects: {
        title: (name, used, loaded) => `MCP server ${name} loads in every project, used in ${used} of ${loaded}`,
        detail: (name, projects) => `It is configured for the user (~/.claude.json), so every session in every project loads its instructions and tools, but ${name} was used only in ${projects.join(", ")}. Configure it just for those projects (local scope, not committed) and remove it from the user scope.`,
        perSession: (per) => `\u2248 ${N(per)} tokens per session`,
        usedIn: (list) => `Used in: ${list}`,
        idle: (n, sessions2) => `Loaded but unused in ${n} other ${plural(n, "en", ["project", "projects"])} (${sessions2} ${plural(sessions2, "en", ["session", "sessions"])} in the last 30 days)`,
        why: (per, used) => `\u2248 ${N(per)} tokens in every session of every project; used only in ${used}`,
        summary: (name) => `the MCP server ${name} is configured for the user, so it loads everywhere, but is used only in a few projects.`
      },
      // ---------- Startup context (recommend-startup.ts) ----------
      fileKind: {
        user: "your global CLAUDE.md",
        project: "project CLAUDE.md",
        local: "CLAUDE.local.md",
        rules: "rules file",
        memory: "auto-memory index"
      },
      bigInstructions: {
        titleOne: (file, tok) => `${file} adds ~${N(tok)} tokens to every session`,
        titleMany: (n, min) => `${n} instruction files over ${N(min)} tokens each`,
        detail: (pct3) => `These files load at the start of every session in their scope, and of the subagents that get CLAUDE.md. Compressing them and moving rarely needed parts into files read on demand usually cuts about ${pct3}% \u2014 that is the estimate below.`,
        evidence: (file, kind, tok, sessions2) => `${file} (${kind}): \u2248 ${N(tok)} tokens, loaded in ${sessions2} ${plural(sessions2, "en", ["session", "sessions"])} in the last 30 days`,
        why: (kind, tok) => `${kind}, \u2248 ${N(tok)} tokens loaded at every start`,
        summary: (n) => `${n} instruction ${plural(n, "en", ["file is", "files are"])} large and ${n === 1 ? "loads" : "load"} into every session.`
      },
      bigMemory: {
        title: (tok) => `Auto-memory adds ~${N(tok)} tokens to every session`,
        detail: (pct3) => `Claude Code loads the MEMORY.md index of a project's auto-memory at every start. Merging duplicates, keeping one short line per entry and archiving outdated memories usually cuts about ${pct3}% \u2014 that is the estimate below.`,
        evidence: (file, tok, sessions2) => `${file}: \u2248 ${N(tok)} tokens, loaded in ${sessions2} ${plural(sessions2, "en", ["session", "sessions"])} in the last 30 days`,
        why: (tok) => `\u2248 ${N(tok)} tokens loaded at every start`,
        summary: (n) => `the auto-memory index of ${n} ${plural(n, "en", ["project has", "projects have"])} grown large.`
      },
      hookEvent: {
        unnamed: "unnamed",
        titleOne: (name, per) => `The ${name} hook adds ~${N(per)} tokens to every session`,
        titleMany: (n, per) => `${n} hooks add ~${N(per)} tokens to every session`,
        detail: "These hooks come from your settings files, not from a plugin that Clorbit recognized, and the text they print is added to the context at the start of every session (and subagent). Plugin hooks are covered on the Skills & plugins tab.",
        evidence: (name, per, sessions2) => `${name}: \u2248 ${N(per)} tokens per session, in ${sessions2} ${plural(sessions2, "en", ["session", "sessions"])} in the last 30 days`,
        action: (name) => `Review the ${name} hook that adds context at startup`,
        why: (per, settingsFile) => `it adds \u2248 ${N(per)} tokens to every session. Find it in ${settingsFile} or in a project's .claude/settings.json / settings.local.json, and suggest how to shorten its output or print it only when needed. If it belongs to a plugin, tell me which`,
        summary: (n) => `${n} ${plural(n, "en", ["hook adds", "hooks add"])} text to the context at the start of every session.`
      },
      skillListing: {
        actionable: (per) => `Acting on the Skills & plugins recommendations would save \u2248 ${N(per)} tokens of startup context per session`
      },
      startupTotal: {
        subagents: (n, per, total) => `Subagents start with their own startup context: ${N(n)} in this period \xD7 \u2248 ${N(per)} \u2248 ${N(total)} tokens`,
        titleSubs: (n, total) => `Subagents paid the startup context ${N(n)} times: \u2248 ${N(total)} tokens in this period`
      },
      // ---------- Tools (recommend-tools.ts) ----------
      tools: {
        allow: {
          user: "user settings",
          local: (projects) => `local settings of ${projects}`,
          title: (n, rules) => `${N(n)} permission ${plural(n, "en", ["prompt", "prompts"])} you approved could be skipped with ${rules} precise allow ${plural(rules, "en", ["rule", "rules"])}`,
          detail: `According to hooks, you approved these tools and commands again and again. A precise rule in "permissions.allow" lets them run without asking; only safe-looking ones are suggested (read-only commands, tests, linters and builds, lookups) \u2014 never anything that deletes, pushes, installs or downloads, and never a broad rule like Bash(*). The waiting time runs from the prompt to the tool's result, minus how long the same call usually takes without a prompt.`,
          evidence: (rule2, n, ms, sessions2) => `${rule2}: approved ${times(n)} in ${sessions2} ${plural(sessions2, "en", ["session", "sessions"])}, \u2248 ${D(ms)} of waiting`,
          skipped: (n, list) => `Not suggested (${n} ${plural(n, "en", ["prompt", "prompts"])}): ${list}`,
          note: (n, ms) => `${n}\xD7 \xB7 \u2248 ${D(ms)}`,
          summary: (n, rules) => `I approved ${N(n)} permission ${plural(n, "en", ["prompt", "prompts"])} for the same safe-looking tools and commands; ${rules} precise allow ${plural(rules, "en", ["rule", "rules"])} would skip them.`,
          why: (n, ms, sessions2) => `approved ${times(n)} in ${sessions2} ${plural(sessions2, "en", ["session", "sessions"])}, \u2248 ${D(ms)} of waiting in this period`
        },
        reread: {
          section: "Reference notes",
          noteText: (rel) => `${rel}: <2\u20135 lines on what it holds and which parts matter \u2014 read the file once and write them yourself>`,
          whyNote: (sessions2, extra) => `re-read in ${sessions2} sessions (${extra} extra reads); a short note in the project's CLAUDE.md saves reading it whole each time`,
          action: (file) => `Look at why ${file} is read again and again`,
          whyReview: (n, where) => `read ${n} times in ${where}. If it was re-read after edits or a compaction, there is nothing to change; if it is a reference file, suggest reading only the lines needed (offset/limit, Grep first) or a short note in the project's CLAUDE.md, but do not add it unless I agree`,
          title: (files, sessions2) => `${files} ${plural(files, "en", ["file was", "files were"])} read 3+ times within a session (${sessions2} ${plural(sessions2, "en", ["session", "sessions"])})`,
          detail: (extra, avg) => `\u2248 ${N(extra)} extra Read calls, \u2248 ${N(avg)} tokens each (the average Read result of those sessions). Each copy stays in the context and is re-read on every following turn. Re-reading after an edit or a compaction is often needed; a reference file read in session after session is worth a short note.`,
          evidence: (name, n, where, sessions2) => `${name} \xD7${n} \u2014 ${where}${sessions2 > 1 ? ` (+${sessions2 - 1} more ${plural(sessions2 - 1, "en", ["session", "sessions"])})` : ""}`,
          note: (extra, sessions2) => `${extra} extra reads \xB7 ${sessions2} ${plural(sessions2, "en", ["session", "sessions"])}`,
          summary: (files, sessions2) => `${files} ${plural(files, "en", ["file was", "files were"])} read three or more times within one session, in ${sessions2} ${plural(sessions2, "en", ["session", "sessions"])}.`,
          noteRule: "Notes go into the project's own CLAUDE.md (not mine); if a file changes often, a note about it goes stale \u2014 skip it and tell me."
        },
        big: {
          section: "Output hygiene",
          tipTail: "Long command output: pipe it through | tail -n 40 (or | head -n 40) or grep for the lines you need.",
          tipQuiet: "Use quiet flags for installs, builds and linters (--quiet, -q, --silent, --reporter=dot).",
          tipTests: "Run tests with a terse reporter first (vitest --reporter=dot, pytest -q, jest --silent) and re-run only the failing ones in detail.",
          tipDiff: "Before a full git diff, look at git diff --stat and diff one file at a time.",
          tipGrep: "Search with file names first (rg -l, or Grep with files_with_matches), then read only the matches you need.",
          tipRead: "Read large files in parts (offset/limit) or find the spot with Grep first.",
          tipFetch: "Ask WebFetch for the specific answer you need, not the whole page.",
          tipAgent: "Ask subagents for a short report (findings, paths, short snippets), not raw file dumps.",
          tipGlob: "Narrow Glob patterns to the folder you need instead of **/*.",
          tipGeneric: (tool) => `Ask ${tool} for less: filters, limits, a compact format.`,
          titleOne: (tool, n, max) => `${tool}: ${n} ${plural(n, "en", ["result", "results"])} over 20K tokens (up to ${N(max)})`,
          titleMany: (n, tools, max) => `${n} tool results over 20K tokens from ${tools} built-in tools (up to ${N(max)})`,
          detail: (sum) => `Each oversized result lands in the context at once and is re-read on every following turn: \u2248 ${N(sum)} tokens in this period. A few lines in your CLAUDE.md about output size usually fix most of it; the estimate assumes \u2248 5K would have been enough per call.`,
          note: (n, max) => `${n}\xD7 > 20K \xB7 up to ${N(max)}`,
          summary: (n, tools) => `${n} results of built-in tools (${tools}) were over 20K tokens each.`,
          why: (tool, n, max) => `${tool}: ${n} ${plural(n, "en", ["result", "results"])} over 20K tokens, up to ${N(max)}`
        },
        fail: {
          kind: {
            hook: "a hook blocked it",
            notRead: "file not read first",
            modified: "file changed since it was read",
            notFound: "text to replace not found",
            multiple: "text to replace is not unique",
            noFile: "file or path missing",
            tooLarge: "too large",
            timeout: "timed out",
            denied: "blocked by permissions or the sandbox",
            input: "invalid parameters",
            network: "network or HTTP error",
            exit: "non-zero exit",
            other: "other"
          },
          facts: (err, calls, reasons) => `${err} of ${calls} calls failed (${pct(err / calls)})${reasons ? `; mostly: ${reasons}` : ""}`,
          titleOne: (tool, rate) => `${tool} fails in ${pct(rate)} of calls`,
          titleMany: (n) => `${n} built-in tools fail often`,
          detail: "Each failed call costs a turn and a retry. Declined or interrupted calls are not counted; for Bash, a command that exits with an error (a failing test, grep without matches) is normal work and is not counted either \u2014 only calls Claude Code itself refused or that timed out. MCP servers are on the MCP tab.",
          summary: (n) => `${n} built-in ${plural(n, "en", ["tool fails", "tools fail"])} often.`,
          action: (tool) => `Find out why ${tool} calls fail so often`,
          why: (facts, kind) => `${facts}. ${kind === "notFound" || kind === "modified" || kind === "notRead" ? "Files probably change under Claude (a formatter, a watcher, another agent) or edits are made from memory: suggest a habit or a hook that fixes it" : kind === "denied" || kind === "hook" ? "Something blocks these calls (permission deny rules, the sandbox or a hook): find which rule or hook and suggest whether to change it or to stop trying" : "Look at recent failures in my transcripts and suggest what to change"}; if a line in CLAUDE.md would help, propose it, but do not add it unless I agree`
        }
      },
      // ---------- Subagents (recommend-agents.ts) ----------
      agents: {
        model: {
          facts: (top, runs, perRun, mix) => `${top}, ${runs} ${plural(runs, "en", ["run", "runs"])}, \u2248 ${N(perRun)} tokens per run; tools: ${mix || "\u2014"}`,
          why: (facts, share, saving) => `${facts}; it only reads and searches, so Sonnet should do \u2014 \u2248 ${pct(share)} less of its cost, \u2248 ${N(saving)} tokens' worth in this period (estimate from API prices)`,
          section: "Subagents",
          noteText: (type) => `Start ${type} subagents for searches and lookups with model "sonnet" (or "haiku" for simple file searches); keep the default model for tasks that need deep reasoning.`,
          builtInWhy: (type, launched) => `${type} is a built-in agent: its file is not mine to edit, but the Agent call takes a model per call, and this line asks for it${launched ? ` (it was launched with: ${launched})` : ""}. ${type === "Explore" ? "Other options: a user agent ~/.claude/agents/Explore.md overrides the built-in and keeps its own model field." : 'Another option: CLAUDE_CODE_SUBAGENT_MODEL=sonnet in the "env" of my settings applies to subagents that set no model of their own and get none from the call (it does not change Explore or Plan).'}`,
          pluginAction: (type) => `Choose how to run the plugin agent ${type} on Sonnet`,
          pluginWhy: (type) => `Its file belongs to the plugin (an update would overwrite an edit). Options: a line in my CLAUDE.md asking to start ${type} with model "sonnet" (the Agent call takes a model per call), or a copy of its definition in ~/.claude/agents/ with "model: sonnet" under its own name. Tell me which you suggest`,
          findAction: (type) => `Find the definition of the subagent ${type} and run it on Sonnet`,
          findWhy: (type, dirs) => `Clorbit did not find its file in ~/.claude/agents or ${dirs.length ? dirs.map((d) => `${d}/.claude/agents`).join(", ") : "the projects' .claude/agents"} (managed settings or --agents?). If you find it, set "model: sonnet" in its frontmatter after a backup; otherwise tell me where ${type} comes from`,
          titleOne: (type, model) => `Subagent ${type} only reads and searches, but runs on ${model}`,
          titleMany: (n) => `${n} read-only subagent types run on a top model`,
          detail: (pctOpus) => `These agent types never edit files: they read, search and fetch, and Sonnet usually does that well. Sonnet costs less per token (Opus 5.5 \u2192 Sonnet 5.5 \u2248 \u2212${pctOpus}% at API prices; older Opus models more). The saving is that share of their cost, shown as tokens' worth; subscription limits weigh models too, but their formula is not published, so it is an estimate.`,
          where: (file, builtIn, plugin) => file ? file : builtIn ? "built-in" : plugin ? "plugin agent" : "definition not found",
          summary: (n) => `${n} subagent ${plural(n, "en", ["type that only reads", "types that only read"])} and ${n === 1 ? "searches runs" : "search run"} on a top-tier model.`
        },
        startup: {
          title: (n, total) => `${N(n)} of ${N(total)} subagents were short and spent most of their tokens on startup context`,
          detail: (turns, share, batch) => `They finished within ${turns} turns, and their startup context (system prompt, tools, skills, CLAUDE.md), re-read on every turn, made up \u2248 ${pct(share)} of their tokens on average. Batching small lookups into one subagent, or doing them without one, pays that startup once. The estimate assumes ${batch}% of them could be batched; the Startup context tab shows how to shrink the context itself.`,
          evidence: (type, n, per, share) => `${type}: ${N(n)} short ${plural(n, "en", ["run", "runs"])}, \u2248 ${N(per)} startup tokens each, \u2248 ${pct(share)} of their tokens`,
          note: (n, per) => `${N(n)} short \xB7 \u2248 ${N(per)} startup tokens`,
          summary: (n) => `${N(n)} short subagents spent most of their tokens on their own startup context.`,
          name: "Batch small subagent tasks",
          noteText: "Do not start a subagent for a lookup that takes one or two tool calls; batch related small questions into one subagent with a clear list of what to return.",
          why: (n, per) => `${N(n)} short subagents in this period, each paying \u2248 ${N(per)} tokens of startup context`
        },
        nest: {
          facts: (total, burst, depth, project, date) => `${total} ${plural(total, "en", ["subagent", "subagents"])}, up to ${burst} within 10 minutes, nesting depth ${depth}${project ? `, ${project}` : ""}, ${date}`,
          title: (n) => `${n} ${plural(n, "en", ["session", "sessions"])} spawned subagents in a burst or nested them deeply`,
          detail: (burst, min, depth) => `${burst}+ subagents within ${min} minutes, or subagents ${depth} levels deep, usually mean a loop or an instruction that fans out more than intended (workflow agents are not counted). Each subagent pays its own startup context.`,
          summary: (n) => `${n} ${plural(n, "en", ["session", "sessions"])} started many subagents in a short time or nested them deeply.`,
          action: (name) => `Look at what made the session ${name} spawn so many subagents`,
          why: (facts, sid) => `${facts}; session id ${sid} (its transcript is under ~/.claude/projects/). Find what started them (a skill, a command, a CLAUDE.md line, a loop) and suggest a limit or a cheaper way; do not change anything unless I agree`
        },
        fail: {
          facts: (known2, error, stopped) => `${error} failed and ${stopped} stopped of ${known2} runs with a known outcome`,
          titleOne: (type, share) => `Subagent ${type} fails or gets stopped in ${pct(share)} of runs`,
          titleMany: (n) => `${n} subagent types often fail or get stopped`,
          detail: "A failed or stopped subagent still costs its tokens, and the work is usually redone. The outcome comes from the Agent call's result or, for background agents, from their completion notice; runs without one are not counted.",
          summary: (n) => `${n} subagent ${plural(n, "en", ["type often fails", "types often fail"])} or ${n === 1 ? "gets" : "get"} stopped.`,
          action: (type) => `Find out why ${type} subagents fail or get stopped`,
          why: (facts, errors) => `${facts}. ${errors ? "Look at a few failed runs (their transcripts are in the sessions' subagents folders) and tell me the common cause: a tool that keeps failing, a too-broad task, a timeout" : "Mostly stopped by me: maybe the task given to them is too broad or they take too long \u2014 suggest a narrower brief"}; do not change anything unless I agree`
        }
      },
      // ---------- Sessions (recommend-sessions.ts) ----------
      sessions: {
        compact: {
          facts: (n, avgPre) => `${n} auto-${plural(n, "en", ["compaction", "compactions"])}${avgPre ? ` at \u2248 ${N(avgPre)} tokens of context` : ""}`,
          title: (total, sessions2) => `${total} auto-${plural(total, "en", ["compaction", "compactions"])} in ${sessions2} ${plural(sessions2, "en", ["session", "sessions"])}`,
          titleOne: (total) => `This session auto-compacted ${times(total)}`,
          detail: "Auto-compaction kicks in when the context is nearly full: Claude summarizes the conversation and loses details, and the summary is one more large request over the whole context. Split long tasks into stages, run /compact with a focus (what to keep) before the context fills up, and /clear between unrelated tasks.",
          avg: (n) => `Average context at an auto-compaction: \u2248 ${N(n)} tokens`,
          pctEnv: (v) => `Your auto-compaction threshold: CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=${v}`,
          summary: (total, sessions2) => `${total} auto-${plural(total, "en", ["compaction", "compactions"])} in ${sessions2} ${plural(sessions2, "en", ["session", "sessions"])}: long tasks keep filling the context.`,
          summaryOne: (total) => `one of my sessions auto-compacted ${times(total)}: a long task kept filling the context.`,
          name: "Long tasks: compact on purpose",
          section: "Long tasks",
          noteText: "For a long multi-step task, keep a short plan/progress file and update it after each step; when a step is done and the context is large, suggest that I run /compact with a focus (or /clear and continue from the plan file) instead of waiting for auto-compaction.",
          why: (total, sessions2) => `${total} auto-${plural(total, "en", ["compaction", "compactions"])} in ${sessions2} ${plural(sessions2, "en", ["session", "sessions"])}`,
          noteRule: "That line is the only change: do not touch autoCompactEnabled or any other setting."
        },
        idle: {
          facts: (n, n60, write) => `${n} cache ${plural(n, "en", ["rebuild", "rebuilds"])} after a break${n60 ? ` (${n60} after more than an hour)` : ""}, \u2248 ${N(write)} tokens written again`,
          title: (n, sessions2, write) => `Resuming after breaks re-wrote \u2248 ${N(write)} tokens of context to the cache (${times(n)} in ${sessions2} ${plural(sessions2, "en", ["session", "sessions"])})`,
          titleOne: (n, write) => `After breaks, this session re-wrote \u2248 ${N(write)} tokens of context to the cache (${times(n)})`,
          detail: "The prompt cache keeps the context for a limited time (5 minutes by default, an hour on some plans). After a longer break the next turn writes the whole context to the cache again, and cache writes cost more than reads and count against your limits. Only turns that really did that are counted (a break after which the cache was still warm is not). The saving leaves out the startup context a fresh session writes anyway.",
          total: (n, n60, write) => `In total: ${n} ${plural(n, "en", ["rebuild", "rebuilds"])}${n60 ? `, ${n60} after more than an hour` : ""}; \u2248 ${N(write)} tokens written again`,
          fix: "Before stepping away from a large session, run /compact with what to keep (or ask for a short summary and /clear); after a long break, start a new session from that summary instead of continuing the old one. Small sessions are cheap to resume: this matters only for large contexts."
        },
        full: {
          facts: (share, hi, limit, compactions) => `${pct(share)} of turns above 85% of the ${limit > 2e5 ? "1M" : "200K"} window (${hi})${compactions ? `, ${compactions} auto-${plural(compactions, "en", ["compaction", "compactions"])}` : ""}`,
          title: (n) => `${n} sessions keep running with a nearly full context`,
          titleOne: (share) => `This session ran ${pct(share)} of its turns with the context over 85% full`,
          detail: "Every turn re-reads the whole context, so a nearly full window makes each turn expensive, and answers get worse as old details pile up; auto-compaction comes next.",
          fix: "Run /compact with a focus at around 60\u201370% instead of waiting for auto-compaction; /clear between unrelated tasks; hand bulk reads and searches to subagents (Explore) so raw results stay out of the main context; read large files in parts."
        },
        effort: {
          title: (simple, rounds, levels) => `${simple} of ${rounds} prompts at ${levels} effort were simple`,
          detail: 'A raised effort (xhigh, max) lets the model think longer on every prompt. These prompts were answered in at most two requests, without tools and with a short answer: lookups, small edits, questions. How much less a lower effort would have thought cannot be measured, so there is no saving estimate; "high", the usual default, is not counted.',
          evidence: (lvl, simple, rounds, tok, sessions2) => `${lvl}: ${simple} of ${rounds} prompts simple, \u2248 ${N(tok)} tokens, in ${sessions2} ${plural(sessions2, "en", ["session", "sessions"])}`,
          fix: "Keep the default effort for routine work and raise it for hard problems only: the effort level can be changed in the middle of a session."
        },
        auto: {
          facts: (runs, tok, share, model, last) => `${runs} ${plural(runs, "en", ["run", "runs"])}, \u2248 ${N(tok)} tokens (${pct(share)} of all), mostly ${model}, last ${last}`,
          title: (runs, share) => `Automated runs (scripts, SDK, schedules) used ${pct(share)} of your tokens (${runs} ${plural(runs, "en", ["session", "sessions"])})`,
          detail: "Sessions nobody sits in front of: claude -p from scripts or CI, the Agent SDK, scheduled routines, the GitHub Action. They often run on the default top model with no turn limit, and a busy pipeline repeats them many times a day.",
          fix: "Check what starts them (cron, CI, scripts, scheduled routines) and whether each needs the top model (--model sonnet), a --max-turns limit or a lower frequency."
        },
        cache: {
          detail: "On these days a large part of the context was written to the cache again instead of being read from it. Cache writes cost more than reads and burn through limits faster. The likely causes are what the transcripts show; CLAUDE.md edits or MCP changes in the middle of a session are not visible in them.",
          likely: (list) => `likely: ${list}`,
          unknown: "no cause visible in the data",
          causeIdle: (n, w) => `${n} ${plural(n, "en", ["rebuild", "rebuilds"])} after breaks (\u2248 ${N(w)})`,
          causeSwitch: (n, w) => `${n} model ${plural(n, "en", ["switch", "switches"])} (\u2248 ${N(w)})`,
          causeCompact: (n) => `${n} ${plural(n, "en", ["compaction", "compactions"])}`,
          causeStarts: (n, w) => `${n} new sessions and subagents (\u2248 ${N(w)} of startup context)`
        }
      },
      // ---------- Subscription limits (recommend-limits.ts) ----------
      limits: {
        page: { skills: "Skills & plugins", mcp: "MCP", startup: "Startup context", tools: "Tools", subagents: "Subagents", sessions: "Sessions", overview: "Overview", limits: "Limits", session: "Session" },
        connect: {
          title: "Subscription limits are not connected",
          detail: "Clorbit reads your 5-hour and weekly limits from Claude Code's status line. Once connected, this panel shows how fast you use them, whether a window runs out before it resets, and what eats it.",
          evidence: [
            "In Claude Code, type /clorbit statusline: a dry run that shows exactly what would change in ~/.claude/settings.json and changes nothing.",
            "If the preview looks right, run /clorbit statusline --apply yourself: it backs up settings.json and changes only the status-line command (--remove restores it)."
          ]
        },
        eat: {
          projects: (list) => `Projects in this window: ${list}`,
          agents: (list) => `Who: ${list}`,
          main: "main sessions",
          models: (list) => `Models: ${list}`
        },
        runout: {
          title: (w, early) => `At this pace the ${w === "7d" ? "weekly" : "5-hour"} limit runs out \u2248 ${long(early)} before it resets`,
          titleExhausted: (w, left) => `The ${w === "7d" ? "weekly" : "5-hour"} limit is used up${left ? `; it resets in ${long(left)}` : ""}`,
          detail: (w, levers) => `The forecast extends the recent burn rate to the reset. Below: what used this window so far (weighted the way limits roughly count: output and cache writes more than cache reads)${levers ? ", and the recommendations that would free the most of it: their savings as a share of the window, assuming the saved tokens have your usual mix (an estimate)" : ""}.`,
          now: (w, used, rate, hitsAt, resetsAt, projected) => `Now ${used}% used, \u2248 ${pp(rate, "en")}%/h${hitsAt ? `; runs out \u2248 ${when(hitsAt)}` : ""}${resetsAt ? `; resets ${when(resetsAt)}` : ""}; \u2248 ${projected}% by the reset at this pace`,
          lever: (title, p, w, page) => `${page ? `${page}: ` : ""}${title} \u2014 \u2248 \u2212${pp(p, "en")}% of the ${w === "7d" ? "weekly" : "5-hour"} limit`,
          leverNote: (p, w, page) => `\u2248 \u2212${pp(p, "en")}% of the ${w === "7d" ? "weekly" : "5-hour"} limit${page ? ` \xB7 ${page}` : ""}`,
          fixNone: "No single recommendation stands out. The usual levers: subagents that only search on a cheaper model, a smaller startup context, shorter tool outputs, fewer automated runs."
        },
        pace: {
          titleRoom: (p) => `On pace to finish the week at \u2248 ${p}% of the weekly limit: you have room`,
          titleTight: (p) => `On pace to finish the week at \u2248 ${p}% of the weekly limit`,
          titleOver: (p) => `On a straight line the weekly limit runs out before it resets (\u2248 ${p}% by then)`,
          detail: (used, elapsed, left, forecast) => `${used}% used with ${pct(elapsed)} of the 7-day window gone; it resets in ${long(left)}. ${forecast ? "The projection is the forecast (the recent burn rate)." : "The projection is a straight line through the use so far."}`,
          line: (used, elapsed, projected) => `Used ${used}% \xB7 ${pct(elapsed)} of the week gone \xB7 \u2248 ${projected}% at the reset`
        }
      }
    }
  };
}
function uk() {
  const N = (n) => fmtNum(n, "uk");
  const D = (ms) => fmtDuration(ms, "uk");
  const times = (n) => `${n} ${plural(n, "uk", ["\u0440\u0430\u0437", "\u0440\u0430\u0437\u0438", "\u0440\u0430\u0437\u0456\u0432"])}`;
  const long = (ms) => ms >= 48 * 36e5 ? `${Math.floor(ms / 864e5)} \u0434\u043D. ${Math.round(ms % 864e5 / 36e5)} \u0433\u043E\u0434` : D(ms);
  return {
    pct,
    unknownTool: "\u043D\u0435\u0432\u0456\u0434\u043E\u043C\u0438\u0439 \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442",
    noPlugin: "\u0431\u0435\u0437 \u043F\u043B\u0430\u0433\u0456\u043D\u0430",
    quote: (s) => `\xAB${s}\xBB`,
    waits: {
      title: (total, longest) => `\u0422\u0438 \u0442\u0440\u0438\u043C\u0430\u0432 \u0430\u0433\u0435\u043D\u0442\u0456\u0432 \u0443 \u043E\u0447\u0456\u043A\u0443\u0432\u0430\u043D\u043D\u0456 ${D(total)} \u0437\u0430 \u043F\u0435\u0440\u0456\u043E\u0434, \u043D\u0430\u0439\u0434\u043E\u0432\u0448\u0435 \u2014 ${D(longest)}`,
      detail: (n, perm, input, where, date, capH) => `\u0417\u0430 \u0434\u0430\u043D\u0438\u043C\u0438 \u0445\u0443\u043A\u0456\u0432 \u0441\u0435\u0441\u0456\u0457 \u0447\u0435\u043A\u0430\u043B\u0438 \u043D\u0430 \u0442\u0435\u0431\u0435 ${times(n)}: ${[
        perm ? `\u0434\u043E\u0437\u0432\u043E\u043B\u0443 \u043D\u0430 \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442 \u2014 ${times(perm.n)} (${D(perm.ms)})` : "",
        input ? `\u043D\u0430 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u044C \u2014 ${times(input.n)} (${D(input.ms)})` : ""
      ].filter(Boolean).join(", ")}. \u041D\u0430\u0439\u0434\u043E\u0432\u0448\u0435 \u043E\u0447\u0456\u043A\u0443\u0432\u0430\u043D\u043D\u044F \u2014 ${where}, ${date}. \u041E\u043A\u0440\u0435\u043C\u0435 \u043E\u0447\u0456\u043A\u0443\u0432\u0430\u043D\u043D\u044F \u043F\u043E\u043D\u0430\u0434 ${capH} \u0433\u043E\u0434 \u0440\u0430\u0445\u0443\u0454\u0442\u044C\u0441\u044F \u044F\u043A ${capH} \u0433\u043E\u0434.`,
      toolLine: (tool, n, ms) => `${tool}: ${n} ${plural(n, "uk", ["\u0437\u0430\u043F\u0438\u0442", "\u0437\u0430\u043F\u0438\u0442\u0438", "\u0437\u0430\u043F\u0438\u0442\u0456\u0432"])} \u0434\u043E\u0437\u0432\u043E\u043B\u0443, \u0440\u0430\u0437\u043E\u043C ${D(ms)}`,
      inputLine: (n, ms) => `\u041E\u0447\u0456\u043A\u0443\u0432\u0430\u043D\u043D\u044F \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0456: ${times(n)}, \u0440\u0430\u0437\u043E\u043C ${D(ms)}`,
      fixPerm: (allow) => `\u0414\u043E\u0437\u0432\u043E\u043B\u044C \u0431\u0435\u0437\u043F\u0435\u0447\u043D\u0456 \u0447\u0430\u0441\u0442\u0456 \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0438 \u0437\u0430\u0437\u0434\u0430\u043B\u0435\u0433\u0456\u0434\u044C: "permissions": { "allow": [${allow}] } \u0443 .claude/settings.json \u043F\u0440\u043E\u0454\u043A\u0442\u0443 (\u0434\u043B\u044F Bash \u2014 \u043B\u0438\u0448\u0435 \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u0456 \u043A\u043E\u043C\u0430\u043D\u0434\u0438). \u0414\u043E\u0432\u0433\u0456 \u043E\u0447\u0456\u043A\u0443\u0432\u0430\u043D\u043D\u044F \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0456 \u2014 \u043F\u0440\u0438\u0432\u0456\u0434 \u0443\u0432\u0456\u043C\u043A\u043D\u0443\u0442\u0438 \u0441\u043F\u043E\u0432\u0456\u0449\u0435\u043D\u043D\u044F \u0430\u0431\u043E \u0434\u0430\u0432\u0430\u0442\u0438 \u0430\u0433\u0435\u043D\u0442\u0430\u043C \u0434\u043E\u0432\u0448\u0456 \u0430\u0432\u0442\u043E\u043D\u043E\u043C\u043D\u0456 \u0437\u0430\u0434\u0430\u0447\u0456.`,
      fixInput: "\u0414\u043E\u0432\u0433\u0456 \u043E\u0447\u0456\u043A\u0443\u0432\u0430\u043D\u043D\u044F \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0456 \u2014 \u043F\u0440\u0438\u0432\u0456\u0434 \u0443\u0432\u0456\u043C\u043A\u043D\u0443\u0442\u0438 \u0441\u043F\u043E\u0432\u0456\u0449\u0435\u043D\u043D\u044F \u0430\u0431\u043E \u0434\u0430\u0432\u0430\u0442\u0438 \u0430\u0433\u0435\u043D\u0442\u0430\u043C \u0434\u043E\u0432\u0448\u0456 \u0430\u0432\u0442\u043E\u043D\u043E\u043C\u043D\u0456 \u0437\u0430\u0434\u0430\u0447\u0456 \u0437 \u0447\u0456\u0442\u043A\u0438\u043C \u043A\u0440\u0438\u0442\u0435\u0440\u0456\u0454\u043C \u0433\u043E\u0442\u043E\u0432\u043D\u043E\u0441\u0442\u0456."
    },
    skillListing: {
      title: (per, perSub) => `\u0421\u043F\u0438\u0441\u043E\u043A \u0441\u043A\u0456\u043B\u0456\u0432: ~${N(per)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u043D\u0430 \u0441\u0435\u0441\u0456\u044E${perSub ? ` \u0456 ~${N(perSub)} \u043D\u0430 \u043A\u043E\u0436\u043D\u043E\u0433\u043E \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0430` : ""}`,
      detail: (perSub, total) => `\u041E\u043F\u0438\u0441\u0438 \u0432\u0441\u0456\u0445 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0438\u0445 \u0441\u043A\u0456\u043B\u0456\u0432 \u0432\u0441\u0442\u0430\u0432\u043B\u044F\u044E\u0442\u044C\u0441\u044F \u043D\u0430 \u0441\u0442\u0430\u0440\u0442\u0456 \u043A\u043E\u0436\u043D\u043E\u0457 \u0441\u0435\u0441\u0456\u0457${perSub ? " \u0456 \u043A\u043E\u0436\u043D\u043E\u0433\u043E \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0430" : ""}. \u0420\u0430\u0437\u043E\u043C \u0437\u0430 \u043F\u0435\u0440\u0456\u043E\u0434 \u2248 ${N(total)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432.`,
      evidence: (p, tok) => `${p}: \u2248 ${N(tok)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u0441\u0443\u043C\u0430\u0440\u043D\u043E`,
      fix: "\u0412\u0438\u043C\u043A\u043D\u0438 \u043F\u043B\u0430\u0433\u0456\u043D\u0438, \u0441\u043A\u0456\u043B\u0430\u043C\u0438 \u044F\u043A\u0438\u0445 \u043D\u0435 \u043A\u043E\u0440\u0438\u0441\u0442\u0443\u0454\u0448\u0441\u044F (enabledPlugins \u0443 ~/.claude/settings.json), \u043F\u0440\u0438\u0431\u0435\u0440\u0438 \u0437\u0430\u0439\u0432\u0456 \u0441\u043A\u0456\u043B\u0438 \u0437 ~/.claude/skills, \u0430 \u043E\u043F\u0438\u0441\u0438 (description) \u0432\u043B\u0430\u0441\u043D\u0438\u0445 \u0441\u043A\u0456\u043B\u0456\u0432 \u0441\u043A\u043E\u0440\u043E\u0442\u0438 \u0434\u043E \u043E\u0434\u043D\u043E\u0433\u043E \u0440\u0435\u0447\u0435\u043D\u043D\u044F."
    },
    startupTotal: {
      title: (perMain, perSub) => `\u0421\u0442\u0430\u0440\u0442\u043E\u0432\u0438\u0439 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442: ~${N(perMain)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u043D\u0430 \u0441\u0435\u0441\u0456\u044E${perSub ? `, ~${N(perSub)} \u043D\u0430 \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0430` : ""}`,
      detail: (total) => `\u0429\u0435 \u0434\u043E \u043F\u0435\u0440\u0448\u043E\u0433\u043E \u0437\u0430\u043F\u0438\u0442\u0443 \u0432 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 \u043F\u043E\u0442\u0440\u0430\u043F\u043B\u044F\u044E\u0442\u044C \u0441\u0438\u0441\u0442\u0435\u043C\u043D\u0438\u0439 \u043F\u0440\u043E\u043C\u043F\u0442, \u0432\u0438\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0456\u0432, \u0441\u043F\u0438\u0441\u043A\u0438 \u0441\u043A\u0456\u043B\u0456\u0432 \u0456 \u0430\u0433\u0435\u043D\u0442\u0456\u0432, CLAUDE.md \u0442\u043E\u0449\u043E. \u0420\u0430\u0437\u043E\u043C \u0437\u0430 \u043F\u0435\u0440\u0456\u043E\u0434 \u2248 ${N(total)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 (\u043E\u0446\u0456\u043D\u043A\u0430 \u0437\u0430 \u0434\u043E\u0432\u0436\u0438\u043D\u043E\u044E \u0442\u0435\u043A\u0441\u0442\u0443); \u0434\u0430\u043B\u0456 \u0432\u043E\u043D\u0438 \u0449\u043E\u0445\u043E\u0434\u0443 \u0447\u0438\u0442\u0430\u044E\u0442\u044C\u0441\u044F \u0437 \u043A\u0435\u0448\u0443.`,
      evidence: (label, per, perSub) => `${label}: \u2248 ${N(per)} \u043D\u0430 \u0441\u0435\u0441\u0456\u044E${perSub ? `, \u2248 ${N(perSub)} \u043D\u0430 \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0430` : ""}`,
      fix: "\u041D\u0430\u0439\u043F\u0440\u043E\u0441\u0442\u0456\u0448\u0435 \u0441\u043A\u043E\u0440\u043E\u0442\u0438\u0442\u0438 \u0441\u043F\u0438\u0441\u043E\u043A \u0441\u043A\u0456\u043B\u0456\u0432 (\u0432\u0438\u043C\u043A\u043D\u0443\u0442\u0438 \u0437\u0430\u0439\u0432\u0456 \u043F\u043B\u0430\u0433\u0456\u043D\u0438, \u043F\u0440\u0438\u0431\u0440\u0430\u0442\u0438 \u043D\u0435\u043F\u043E\u0442\u0440\u0456\u0431\u043D\u0456 \u0441\u043A\u0456\u043B\u0438) \u0456 CLAUDE.md; \u0434\u0440\u0456\u0431\u043D\u0456 \u0437\u0430\u0434\u0430\u0447\u0456 \u043A\u0440\u0430\u0449\u0435 \u0440\u043E\u0431\u0438\u0442\u0438 \u0431\u0435\u0437 \u043E\u043A\u0440\u0435\u043C\u043E\u0433\u043E \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0430 \u2014 \u043A\u043E\u0436\u0435\u043D \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442 \u043F\u043B\u0430\u0442\u0438\u0442\u044C \u0446\u0435\u0439 \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u0438\u0439 \u0432\u043D\u0435\u0441\u043E\u043A \u0437\u0430\u043D\u043E\u0432\u043E."
    },
    bigResults: {
      example: (label, tok, project) => `${label} \u2014 ${N(tok)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 (${project})`
    },
    autoCompactions: {
      title: (total, sessions2) => `${total} \u0430\u0432\u0442\u043E\u043A\u043E\u043C\u043F\u0430\u043A\u0446\u0456\u0439 \u0443 ${sessions2} \u0441\u0435\u0441\u0456\u044F\u0445`,
      detail: "\u0410\u0432\u0442\u043E\u043A\u043E\u043C\u043F\u0430\u043A\u0446\u0456\u044F \u043E\u0437\u043D\u0430\u0447\u0430\u0454, \u0449\u043E \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 \u0434\u0456\u0439\u0448\u043E\u0432 \u0434\u043E \u043C\u0435\u0436\u0456: \u0447\u0430\u0441\u0442\u0438\u043D\u0430 \u043F\u043E\u0434\u0440\u043E\u0431\u0438\u0446\u044C \u0433\u0443\u0431\u0438\u0442\u044C\u0441\u044F, \u0430 \u0441\u0430\u043C\u0430 \u043A\u043E\u043C\u043F\u0430\u043A\u0446\u0456\u044F \u043A\u043E\u0448\u0442\u0443\u0454 \u043E\u043A\u0440\u0435\u043C\u043E\u0433\u043E \u0432\u0435\u043B\u0438\u043A\u043E\u0433\u043E \u0445\u043E\u0434\u0443.",
      fix: (pctEnv) => `\u0420\u043E\u0437\u0431\u0438\u0432\u0430\u0439 \u0432\u0435\u043B\u0438\u043A\u0456 \u0437\u0430\u0434\u0430\u0447\u0456 \u043D\u0430 \u0435\u0442\u0430\u043F\u0438: \u043F\u0456\u0441\u043B\u044F \u0435\u0442\u0430\u043F\u0443 \u2014 \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0439 \u043F\u0456\u0434\u0441\u0443\u043C\u043E\u043A \u0443 \u0444\u0430\u0439\u043B \u043F\u043B\u0430\u043D\u0443 \u0456 /clear; \u0434\u043E\u0441\u043B\u0456\u0434\u0436\u0435\u043D\u043D\u044F \u0442\u0430 \u043C\u0430\u0441\u043E\u0432\u0456 \u0447\u0438\u0442\u0430\u043D\u043D\u044F \u0432\u0456\u0434\u0434\u0430\u0432\u0430\u0439 \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0430\u043C (Explore), \u0449\u043E\u0431 \u0441\u0438\u0440\u0456 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0438 \u043D\u0435 \u043F\u043E\u0442\u0440\u0430\u043F\u043B\u044F\u043B\u0438 \u0432 \u0433\u043E\u043B\u043E\u0432\u043D\u0438\u0439 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442.${pctEnv ? ` \u041F\u043E\u0440\u0456\u0433 \u0437\u0430\u0440\u0430\u0437: CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=${pctEnv}.` : ""}`
    },
    skillShare: {
      title: (key, share, loads) => `\u0421\u043A\u0456\u043B ${key}: ${pct(share)} \u0443\u0441\u0456\u0445 \u0442\u043E\u043A\u0435\u043D\u0456\u0432${loads ? `, ${loads} \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0435\u043D\u044C` : ""}`,
      detail: (key, total, sessions2, perLoad) => `\u0425\u043E\u0434\u0438 \u043F\u0456\u0434 \u0430\u0442\u0440\u0438\u0431\u0443\u0446\u0456\u0454\u044E \u0441\u043A\u0456\u043B\u0430 ${key} \u0437\u0430\u0431\u0440\u0430\u043B\u0438 \u2248 ${N(total)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u0443 ${sessions2} \u0441\u0435\u0441\u0456\u044F\u0445${perLoad !== null ? ` (\u2248 ${N(perLoad)} \u043D\u0430 \u043E\u0434\u043D\u0435 \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0435\u043D\u043D\u044F)` : ""}. \u0426\u0435 \u043D\u0435 \u043E\u0431\u043E\u0432'\u044F\u0437\u043A\u043E\u0432\u043E \u043F\u043E\u0433\u0430\u043D\u043E \u2014 \u0430\u043B\u0435 \u0432\u0430\u0440\u0442\u043E \u043F\u0435\u0440\u0435\u043A\u043E\u043D\u0430\u0442\u0438\u0441\u044F, \u0449\u043E \u0441\u043A\u0456\u043B \u043D\u0435 \u0442\u044F\u0433\u043D\u0435 \u0437\u0430\u0439\u0432\u043E\u0433\u043E.`,
      turns: (turns, sessions2) => `\u0425\u043E\u0434\u0456\u0432: ${N(turns)}, \u0441\u0435\u0441\u0456\u0439: ${sessions2}`,
      tokens: (out, write) => `\u0412\u0438\u0445\u0456\u0434\u043D\u0438\u0445 \u0442\u043E\u043A\u0435\u043D\u0456\u0432: ${N(out)}, \u0437\u0430\u043F\u0438\u0441 \u0443 \u043A\u0435\u0448: ${N(write)}`,
      fix: "\u041F\u0435\u0440\u0435\u0432\u0456\u0440 SKILL.md: \u0434\u043E\u0432\u0456\u0434\u043A\u043E\u0432\u0456 \u0440\u043E\u0437\u0434\u0456\u043B\u0438 \u0432\u0438\u043D\u0435\u0441\u0438 \u0432 \u043E\u043A\u0440\u0435\u043C\u0456 \u0444\u0430\u0439\u043B\u0438, \u044F\u043A\u0456 \u0441\u043A\u0456\u043B \u0447\u0438\u0442\u0430\u0454 \u043B\u0438\u0448\u0435 \u0437\u0430 \u043F\u043E\u0442\u0440\u0435\u0431\u0438; \u0443\u0442\u043E\u0447\u043D\u0438 description, \u0449\u043E\u0431 \u0441\u043A\u0456\u043B \u043D\u0435 \u0441\u043F\u0440\u0430\u0446\u044C\u043E\u0432\u0443\u0432\u0430\u0432 \u0442\u0430\u043C, \u0434\u0435 \u043D\u0435 \u043F\u043E\u0442\u0440\u0456\u0431\u0435\u043D."
    },
    skillLoads: {
      title: "\u041D\u0430\u0439\u0447\u0430\u0441\u0442\u0456\u0448\u0435 \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0443\u0432\u0430\u043D\u0456 \u0441\u043A\u0456\u043B\u0438",
      detail: "\u0421\u043A\u0456\u043B\u044C\u043A\u0438 \u0440\u0430\u0437\u0456\u0432 \u0432\u0438\u043A\u043B\u0438\u043A\u0430\u043B\u0438 Skill \u0456 \u044F\u043A\u0443 \u0447\u0430\u0441\u0442\u043A\u0443 \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u0434\u0430\u043B\u0438 \u0445\u043E\u0434\u0438 \u043F\u0456\u0434 \u0446\u0438\u043C \u0441\u043A\u0456\u043B\u043E\u043C.",
      evidence: (key, loads, share) => `${key}: ${loads}\xD7 \u2014 ${pct(share)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432`
    },
    lowCache: {
      title: (n, avg) => `${n} \u0434\u043D. \u0437 \u043D\u0438\u0437\u044C\u043A\u043E\u044E \u0447\u0430\u0441\u0442\u043A\u043E\u044E \u043A\u0435\u0448\u0443 (\u0441\u0435\u0440\u0435\u0434\u043D\u044F ${pct(avg)})`,
      detail: "\u0423 \u0446\u0456 \u0434\u043D\u0456 \u0437\u043D\u0430\u0447\u043D\u0430 \u0447\u0430\u0441\u0442\u0438\u043D\u0430 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u0443 \u0437\u0430\u043F\u0438\u0441\u0443\u0432\u0430\u043B\u0430\u0441\u044C \u0443 \u043A\u0435\u0448 \u0437\u0430\u043D\u043E\u0432\u043E \u0437\u0430\u043C\u0456\u0441\u0442\u044C \u0447\u0438\u0442\u0430\u043D\u043D\u044F \u0437 \u043D\u044C\u043E\u0433\u043E. \u0417\u0430\u043F\u0438\u0441 \u0443 \u043A\u0435\u0448 \u0434\u043E\u0440\u043E\u0436\u0447\u0438\u0439 \u0437\u0430 \u0447\u0438\u0442\u0430\u043D\u043D\u044F \u0456 \u0448\u0432\u0438\u0434\u0448\u0435 \u0437'\u0457\u0434\u0430\u0454 \u043B\u0456\u043C\u0456\u0442.",
      evidence: (date, rate, write, input) => `${date}: \u043A\u0435\u0448 ${pct(rate)}, \u0437\u0430\u043F\u0438\u0441 \u0443 \u043A\u0435\u0448 ${N(write)}, \u0431\u0435\u0437 \u043A\u0435\u0448\u0443 ${N(input)}`,
      fix: "\u041A\u0435\u0448 \u043F\u0440\u043E\u043C\u043F\u0442\u0430 \u0436\u0438\u0432\u0435 \u043E\u0431\u043C\u0435\u0436\u0435\u043D\u0438\u0439 \u0447\u0430\u0441: \u043F\u0456\u0441\u043B\u044F \u0434\u043E\u0432\u0433\u043E\u0457 \u043F\u0430\u0443\u0437\u0438 \u043A\u0440\u0430\u0449\u0435 \u043F\u043E\u0447\u0430\u0442\u0438 \u043D\u043E\u0432\u0443 \u0441\u0435\u0441\u0456\u044E \u0437 \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u043C \u043F\u0456\u0434\u0441\u0443\u043C\u043A\u043E\u043C, \u043D\u0456\u0436 \u043F\u0440\u043E\u0434\u043E\u0432\u0436\u0443\u0432\u0430\u0442\u0438 \u0432\u0435\u043B\u0438\u043A\u0443. \u041D\u0435 \u043F\u0435\u0440\u0435\u043C\u0438\u043A\u0430\u0439 \u043C\u043E\u0434\u0435\u043B\u044C/\u0435\u0444\u043E\u0440\u0442 \u0456 \u043D\u0435 \u0437\u043C\u0456\u043D\u044E\u0439 CLAUDE.md \u0447\u0438 \u043D\u0430\u0431\u0456\u0440 MCP \u043F\u043E\u0441\u0435\u0440\u0435\u0434 \u0434\u043E\u0432\u0433\u043E\u0457 \u0441\u0435\u0441\u0456\u0457 \u2014 \u0446\u0435 \u0441\u043A\u0438\u0434\u0430\u0454 \u043A\u0435\u0448."
    },
    hooks: {
      title: (plugin, n, min, err) => `\u0425\u0443\u043A\u0438 ${plugin ? `\u043F\u043B\u0430\u0433\u0456\u043D\u0430 ${plugin}` : "\u0431\u0435\u0437 \u043F\u043B\u0430\u0433\u0456\u043D\u0430"}: ${N(n)} \u0437\u0430\u043F\u0443\u0441\u043A\u0456\u0432, ${min} \u0445\u0432 \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F${err !== null ? `, ${pct(err)} \u0437 \u043F\u043E\u043C\u0438\u043B\u043A\u043E\u044E \u0447\u0438 stderr` : ""}`,
      detail: (names3, min, err) => `\u0425\u0443\u043A\u0438 (${names3}) \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u044E\u0442\u044C\u0441\u044F \u043E\u043A\u0440\u0435\u043C\u0438\u043C \u043F\u0440\u043E\u0446\u0435\u0441\u043E\u043C \u043D\u0430 \u043A\u043E\u0436\u043D\u0443 \u0442\u0430\u043A\u0443 \u043F\u043E\u0434\u0456\u044E; \u0441\u0443\u043C\u0430\u0440\u043D\u0438\u0439 \u0447\u0430\u0441 \u0457\u0445 \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F \u2248 ${min} \u0445\u0432.${err !== null ? ` ${pct(err)} \u0437\u0430\u043F\u0443\u0441\u043A\u0456\u0432 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u043B\u0438\u0441\u044C \u0437 \u043F\u043E\u043C\u0438\u043B\u043A\u043E\u044E \u0430\u0431\u043E \u043F\u0438\u0441\u0430\u043B\u0438 \u0432 stderr.` : ""}`,
      runs: (n) => `\u0417\u0430\u043F\u0443\u0441\u043A\u0456\u0432: ${N(n)}`,
      time: (sec) => `\u0421\u0443\u043C\u0430\u0440\u043D\u0438\u0439 \u0447\u0430\u0441: ${sec} \u0441`,
      errors: (n) => `\u0417 \u043F\u043E\u043C\u0438\u043B\u043A\u043E\u044E/stderr: ${N(n)}`,
      fix: (plugin, key) => `\u042F\u043A\u0449\u043E \u043F\u043B\u0430\u0433\u0456\u043D ${plugin} \u043D\u0435 \u043F\u043E\u0442\u0440\u0456\u0431\u0435\u043D \u0443 \u0446\u044C\u043E\u043C\u0443 \u0441\u0435\u0440\u0435\u0434\u043E\u0432\u0438\u0449\u0456 \u2014 \u0432\u0438\u043C\u043A\u043D\u0438: "enabledPlugins": { "${key}": false } \u0443 ~/.claude/settings.json.`,
      fixNoPlugin: "\u041F\u0435\u0440\u0435\u0432\u0456\u0440 \u043A\u043E\u043C\u0430\u043D\u0434\u0438 \u0445\u0443\u043A\u0456\u0432 \u0443 ~/.claude/settings.json: \u0447\u0438 \u0432\u043E\u043D\u0438 \u043F\u043E\u0442\u0440\u0456\u0431\u043D\u0456 \u043D\u0430 \u043A\u043E\u0436\u043D\u0443 \u043F\u043E\u0434\u0456\u044E."
    },
    rec: {
      lastUsed: (days) => days === 0 ? "\u0432\u043E\u0441\u0442\u0430\u043D\u043D\u0454 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u043D\u043E \u0441\u044C\u043E\u0433\u043E\u0434\u043D\u0456" : `\u0432\u043E\u0441\u0442\u0430\u043D\u043D\u0454 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u043D\u043E ${days} ${plural(days, "uk", ["\u0434\u0435\u043D\u044C", "\u0434\u043D\u0456", "\u0434\u043D\u0456\u0432"])} \u0442\u043E\u043C\u0443`,
      never: (since) => since ? `\u0436\u043E\u0434\u043D\u043E\u0433\u043E \u0440\u0430\u0437\u0443 \u043D\u0435 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u043D\u043E (\u0443 \u0441\u043F\u0438\u0441\u043A\u0443 \u0437 ${since})` : "\u0436\u043E\u0434\u043D\u043E\u0433\u043E \u0440\u0430\u0437\u0443 \u043D\u0435 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u043D\u043E",
      perSession: (tok) => `\u2248 ${N(tok)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u0443 \u043D\u0430 \u0441\u0435\u0441\u0456\u044E`,
      parts: (p) => [
        p.skills ? `\u043E\u043F\u0438\u0441\u0438 \u0441\u043A\u0456\u043B\u0456\u0432 ${N(p.skills)}` : "",
        p.hook ? `\u0445\u0443\u043A SessionStart ${N(p.hook)}` : "",
        p.mcp ? `\u0456\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0456\u0457 MCP ${N(p.mcp)}` : ""
      ].filter(Boolean).join(" + "),
      unusedPlugins: {
        titleOne: (name, last) => `\u041F\u043B\u0430\u0433\u0456\u043D ${name} \u0443\u0432\u0456\u043C\u043A\u043D\u0435\u043D\u043E, \u0430\u043B\u0435 ${last}`,
        titleMany: (n, days) => `${n} ${plural(n, "uk", ["\u0443\u0432\u0456\u043C\u043A\u043D\u0435\u043D\u0438\u0439 \u043F\u043B\u0430\u0433\u0456\u043D \u043D\u0435 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0432\u0430\u0432\u0441\u044F", "\u0443\u0432\u0456\u043C\u043A\u043D\u0435\u043D\u0456 \u043F\u043B\u0430\u0433\u0456\u043D\u0438 \u043D\u0435 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0432\u0430\u043B\u0438\u0441\u044C", "\u0443\u0432\u0456\u043C\u043A\u043D\u0435\u043D\u0438\u0445 \u043F\u043B\u0430\u0433\u0456\u043D\u0456\u0432 \u043D\u0435 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0432\u0430\u043B\u0438\u0441\u044C"])} ${days}+ \u0434\u043D.`,
        detail: (days) => `\u0416\u043E\u0434\u043D\u043E\u0433\u043E \u0432\u0438\u043A\u043B\u0438\u043A\u0443 \u0441\u043A\u0456\u043B\u0456\u0432, MCP-\u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0456\u0432 \u0447\u0438 \u0430\u0442\u0440\u0438\u0431\u0443\u0442\u043E\u0432\u0430\u043D\u0438\u0445 \u0445\u043E\u0434\u0456\u0432 \u0437\u0430 \u0432\u0441\u044E \u0437\u0431\u0435\u0440\u0435\u0436\u0435\u043D\u0443 \u0456\u0441\u0442\u043E\u0440\u0456\u044E \u0449\u043E\u043D\u0430\u0439\u043C\u0435\u043D\u0448\u0435 ${days} \u0434\u043D. (\u0437 \u0430\u0440\u0445\u0456\u0432\u043D\u0438\u043C\u0438 \u0441\u0435\u0441\u0456\u044F\u043C\u0438). \u041F\u0440\u043E\u0442\u0435 \u0432\u043E\u043D\u0438 \u0439 \u0434\u0430\u043B\u0456 \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0443\u044E\u0442\u044C\u0441\u044F \u0432 \u043A\u043E\u0436\u043D\u0443 \u043D\u043E\u0432\u0443 \u0441\u0435\u0441\u0456\u044E \u0456 \u043A\u043E\u0436\u043D\u043E\u0433\u043E \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0430, \u0449\u043E \u043E\u0442\u0440\u0438\u043C\u0443\u0454 \u0441\u043F\u0438\u0441\u043E\u043A \u0441\u043A\u0456\u043B\u0456\u0432.`,
        evidence: (name, last, per, parts) => `${name}: ${last}; \u2248 ${N(per)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u043D\u0430 \u0441\u0435\u0441\u0456\u044E${parts ? ` (${parts})` : ""}`,
        why: (last, per) => `${last}; \u2248 ${N(per)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u0443 \u043D\u0430 \u0441\u0435\u0441\u0456\u044E`,
        summary: (n, days) => `${n} ${plural(n, "uk", ["\u0443\u0432\u0456\u043C\u043A\u043D\u0435\u043D\u0438\u0439 \u043F\u043B\u0430\u0433\u0456\u043D \u043D\u0435 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0432\u0430\u0432\u0441\u044F", "\u0443\u0432\u0456\u043C\u043A\u043D\u0435\u043D\u0456 \u043F\u043B\u0430\u0433\u0456\u043D\u0438 \u043D\u0435 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0432\u0430\u043B\u0438\u0441\u044C", "\u0443\u0432\u0456\u043C\u043A\u043D\u0435\u043D\u0438\u0445 \u043F\u043B\u0430\u0433\u0456\u043D\u0456\u0432 \u043D\u0435 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0432\u0430\u043B\u0438\u0441\u044C"])} ${days}+ \u0434\u043D., \u0430\u043B\u0435 \u0439 \u0434\u0430\u043B\u0456 \u0434\u043E\u0434\u0430\u044E\u0442\u044C \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u0438\u0439 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 \u0443 \u043A\u043E\u0436\u043D\u0443 \u0441\u0435\u0441\u0456\u044E.`
      },
      hookContext: {
        title: (plugin, per) => `\u041F\u043B\u0430\u0433\u0456\u043D ${plugin} \u0434\u043E\u0434\u0430\u0454 ~${N(per)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u0443 \u043A\u043E\u0436\u043D\u0443 \u0441\u0435\u0441\u0456\u044E, \u043D\u0430\u0432\u0456\u0442\u044C \u0442\u0430\u043C, \u0434\u0435 \u0432\u0456\u043D \u043D\u0435 \u043F\u043E\u0442\u0440\u0456\u0431\u0435\u043D`,
        detail: (plugin, used, total, projects) => `\u0419\u043E\u0433\u043E \u0445\u0443\u043A SessionStart \u0432\u0441\u0442\u0430\u0432\u043B\u044F\u0454 \u0431\u043B\u043E\u043A \u0442\u0435\u043A\u0441\u0442\u0443 \u043D\u0430 \u0441\u0442\u0430\u0440\u0442\u0456 \u043A\u043E\u0436\u043D\u043E\u0457 \u0441\u0435\u0441\u0456\u0457, \u0430 \u0441\u043A\u0456\u043B\u0438 \u0447\u0438 \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0438 ${plugin} \u0437\u043D\u0430\u0434\u043E\u0431\u0438\u043B\u0438\u0441\u044C \u0443 ${used} \u0437 ${total} \u0442\u0430\u043A\u0438\u0445 \u0441\u0435\u0441\u0456\u0439 \u0437\u0430 \u043F\u0435\u0440\u0456\u043E\u0434${projects.length ? ` (\u043F\u0440\u043E\u0454\u043A\u0442\u0438: ${projects.join(", ")})` : ""}. \u0412\u0438\u043C\u043A\u043D\u0438 \u0439\u043E\u0433\u043E \u0433\u043B\u043E\u0431\u0430\u043B\u044C\u043D\u043E \u0439 \u0443\u0432\u0456\u043C\u043A\u043D\u0438 \u043B\u0438\u0448\u0435 \u0442\u0430\u043C, \u0434\u0435 \u0432\u0456\u043D \u043F\u043E\u0442\u0440\u0456\u0431\u0435\u043D.`,
        sessions: (used, total) => `\u0412\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u043D\u043E \u0432 ${used} \u0437 ${total} \u0441\u0435\u0441\u0456\u0439 \u0456\u0437 \u0431\u043B\u043E\u043A\u043E\u043C \u0445\u0443\u043A\u0430`,
        perSession: (per) => `\u0411\u043B\u043E\u043A \u0445\u0443\u043A\u0430: \u2248 ${N(per)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u043D\u0430 \u0441\u0435\u0441\u0456\u044E`,
        why: (per, used, total) => `\u0439\u043E\u0433\u043E \u0445\u0443\u043A SessionStart \u0434\u043E\u0434\u0430\u0454 \u2248 ${N(per)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u0443 \u043A\u043E\u0436\u043D\u0443 \u0441\u0435\u0441\u0456\u044E, \u0430 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u043D\u043E \u0439\u043E\u0433\u043E \u0432 ${used} \u0437 ${total} \u0441\u0435\u0441\u0456\u0439`,
        whyEnable: (project) => `\u0432\u0456\u043D \u043F\u043E\u0442\u0440\u0456\u0431\u0435\u043D \u0443 ${project}`,
        skillsUnused: (n, total, days) => `${n} \u0437 ${total} \u0439\u043E\u0433\u043E \u0441\u043A\u0456\u043B\u0456\u0432 \u043D\u0435 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0432\u0430\u043B\u0438\u0441\u044C ${days}+ \u0434\u043D.`,
        summary: (plugin, per) => `\u043F\u043B\u0430\u0433\u0456\u043D ${plugin} \u0447\u0435\u0440\u0435\u0437 \u0445\u0443\u043A SessionStart \u0432\u0441\u0442\u0430\u0432\u043B\u044F\u0454 \u2248 ${N(per)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u0443 \u043A\u043E\u0436\u043D\u0443 \u0441\u0435\u0441\u0456\u044E, \u0430\u043B\u0435 \u043F\u043E\u0442\u0440\u0456\u0431\u0435\u043D \u043B\u0438\u0448\u0435 \u0432 \u043A\u0456\u043B\u044C\u043A\u043E\u0445 \u043F\u0440\u043E\u0454\u043A\u0442\u0430\u0445.`,
        fix: (plugin, key) => `\u042F\u043A\u0449\u043E ${plugin} \u043F\u043E\u0442\u0440\u0456\u0431\u0435\u043D \u043D\u0435 \u0432 \u043A\u043E\u0436\u043D\u043E\u043C\u0443 \u043F\u0440\u043E\u0454\u043A\u0442\u0456 \u2014 \u0432\u0438\u043C\u043A\u043D\u0438 \u0439\u043E\u0433\u043E \u0433\u043B\u043E\u0431\u0430\u043B\u044C\u043D\u043E (claude plugin disable ${key} --scope user) \u0456 \u0443\u0432\u0456\u043C\u043A\u043D\u0438 \u0442\u0430\u043C, \u0434\u0435 \u0432\u0456\u043D \u043F\u043E\u0442\u0440\u0456\u0431\u0435\u043D (claude plugin enable ${key} --scope local \u0443 \u0442\u0435\u0446\u0456 \u043F\u0440\u043E\u0454\u043A\u0442\u0443).`
      },
      unusedSkills: {
        title: (plugin, n, total, days) => `\u041F\u043B\u0430\u0433\u0456\u043D ${plugin}: ${n} \u0437 ${total} \u0441\u043A\u0456\u043B\u0456\u0432 \u043D\u0435 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0432\u0430\u043B\u0438\u0441\u044C ${days}+ \u0434\u043D.`,
        detail: (plugin, unusedTok, totalTok) => `\u0407\u0445\u043D\u0456 \u043E\u043F\u0438\u0441\u0438 \u0437\u0430\u0439\u043C\u0430\u044E\u0442\u044C \u2248 ${N(unusedTok)} \u0437 \u2248 ${N(totalTok)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u0441\u043F\u0438\u0441\u043A\u0443 \u0441\u043A\u0456\u043B\u0456\u0432 ${plugin} \u0443 \u043A\u043E\u0436\u043D\u0456\u0439 \u0441\u0435\u0441\u0456\u0457. \u0421\u043A\u0456\u043B\u0438 \u043F\u043B\u0430\u0433\u0456\u043D\u0430 \u043D\u0435 \u0432\u0438\u043C\u0438\u043A\u0430\u044E\u0442\u044C\u0441\u044F \u043F\u043E\u043E\u0434\u0438\u043D\u0446\u0456, \u0442\u043E\u0436 \u0432\u0438\u0431\u0456\u0440 \u2014 \u0443\u0432\u0435\u0441\u044C \u043F\u043B\u0430\u0433\u0456\u043D: \u0432\u0438\u043C\u043A\u043D\u0438 \u0439\u043E\u0433\u043E, \u044F\u043A\u0449\u043E \u043E\u0431\u0456\u0439\u0434\u0435\u0448\u0441\u044F \u0431\u0435\u0437 \u0441\u043A\u0456\u043B\u0456\u0432, \u044F\u043A\u0438\u043C\u0438 \u0449\u0435 \u043A\u043E\u0440\u0438\u0441\u0442\u0443\u0454\u0448\u0441\u044F.`,
        stillUsed: (list) => `\u0429\u0435 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u044E\u0442\u044C\u0441\u044F: ${list}`,
        noneUsed: "\u0416\u043E\u0434\u0435\u043D \u0437\u0456 \u0441\u043A\u0456\u043B\u0456\u0432 \u0443 \u0441\u043F\u0438\u0441\u043A\u0443 \u043E\u0441\u0442\u0430\u043D\u043D\u0456\u043C \u0447\u0430\u0441\u043E\u043C \u043D\u0435 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0432\u0430\u0432\u0441\u044F \u2014 \u043B\u0438\u0448\u0435 \u0445\u0443\u043A\u0438 \u0447\u0438 MCP-\u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0438",
        mcpUsed: (last) => `\u0419\u043E\u0433\u043E MCP-\u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0438: ${last}`,
        why: (n, total, used) => `${n} \u0437 ${total} \u0439\u043E\u0433\u043E \u0441\u043A\u0456\u043B\u0456\u0432 \u0434\u0430\u0432\u043D\u043E \u043D\u0435 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0432\u0430\u043B\u0438\u0441\u044C${used ? `; \u0449\u0435 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u044E\u0442\u044C\u0441\u044F: ${used}` : ""}`,
        summary: (plugin, n, total, days) => `${n} \u0437 ${total} \u0441\u043A\u0456\u043B\u0456\u0432 \u043F\u043B\u0430\u0433\u0456\u043D\u0430 ${plugin} \u043D\u0435 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0432\u0430\u043B\u0438\u0441\u044C ${days}+ \u0434\u043D.`
      },
      unusedOwn: {
        title: (n, days) => `${n} ${plural(n, "uk", ["\u0432\u043B\u0430\u0441\u043D\u0438\u0439 \u0441\u043A\u0456\u043B \u043D\u0435 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0432\u0430\u0432\u0441\u044F", "\u0432\u043B\u0430\u0441\u043D\u0456 \u0441\u043A\u0456\u043B\u0438 \u043D\u0435 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0432\u0430\u043B\u0438\u0441\u044C", "\u0432\u043B\u0430\u0441\u043D\u0438\u0445 \u0441\u043A\u0456\u043B\u0456\u0432 \u043D\u0435 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0432\u0430\u043B\u0438\u0441\u044C"])} ${days}+ \u0434\u043D.`,
        detail: (dir) => `\u0421\u043A\u0456\u043B\u0438 \u0437 ${dir} \u043F\u043E\u0442\u0440\u0430\u043F\u043B\u044F\u044E\u0442\u044C \u0443 \u0441\u043F\u0438\u0441\u043E\u043A \u0441\u043A\u0456\u043B\u0456\u0432 \u043A\u043E\u0436\u043D\u043E\u0457 \u0441\u0435\u0441\u0456\u0457 \u0442\u0430 \u043A\u043E\u0436\u043D\u043E\u0433\u043E \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0430, \u0449\u043E \u0439\u043E\u0433\u043E \u043E\u0442\u0440\u0438\u043C\u0443\u0454. \u042F\u043A\u0449\u043E \u043F\u0435\u0440\u0435\u043D\u0435\u0441\u0442\u0438 \u0442\u0435\u043A\u0443 \u0432 \u0441\u0443\u0441\u0456\u0434\u043D\u044E \u0442\u0435\u043A\u0443 \xAB-disabled\xBB, \u0441\u043A\u0456\u043B \u0437\u043D\u0438\u043A\u043D\u0435 \u0437\u0456 \u0441\u043F\u0438\u0441\u043A\u0443, \u0430 \u043F\u043E\u0432\u0435\u0440\u043D\u0443\u0442\u0438 \u0439\u043E\u0433\u043E \u0431\u0443\u0434\u0435 \u043F\u0440\u043E\u0441\u0442\u043E.`,
        evidence: (name, last, per) => `${name}: ${last}; \u2248 ${N(per)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u043D\u0430 \u0441\u0435\u0441\u0456\u044E`,
        why: (last, per) => `${last}; \u2248 ${N(per)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u0443 \u043D\u0430 \u0441\u0435\u0441\u0456\u044E`,
        summary: (n, days) => `${n} ${plural(n, "uk", ["\u043C\u0456\u0439 \u0432\u043B\u0430\u0441\u043D\u0438\u0439 \u0441\u043A\u0456\u043B \u043D\u0435 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0432\u0430\u0432\u0441\u044F", "\u043C\u043E\u0457 \u0432\u043B\u0430\u0441\u043D\u0456 \u0441\u043A\u0456\u043B\u0438 \u043D\u0435 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0432\u0430\u043B\u0438\u0441\u044C", "\u043C\u043E\u0457\u0445 \u0432\u043B\u0430\u0441\u043D\u0438\u0445 \u0441\u043A\u0456\u043B\u0456\u0432 \u043D\u0435 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0432\u0430\u043B\u0438\u0441\u044C"])} ${days}+ \u0434\u043D.`
      },
      duplicates: {
        title: (n) => `${n} ${plural(n, "uk", ["\u043D\u0430\u0437\u0432\u0430 \u0441\u043A\u0456\u043B\u0430 \u0442\u0440\u0430\u043F\u043B\u044F\u0454\u0442\u044C\u0441\u044F", "\u043D\u0430\u0437\u0432\u0438 \u0441\u043A\u0456\u043B\u0456\u0432 \u0442\u0440\u0430\u043F\u043B\u044F\u044E\u0442\u044C\u0441\u044F", "\u043D\u0430\u0437\u0432 \u0441\u043A\u0456\u043B\u0456\u0432 \u0442\u0440\u0430\u043F\u043B\u044F\u044E\u0442\u044C\u0441\u044F"])} \u0443 \u0441\u043F\u0438\u0441\u043A\u0443 \u0441\u043A\u0456\u043B\u0456\u0432 \u0431\u0456\u043B\u044C\u0448\u0435 \u043E\u0434\u043D\u043E\u0433\u043E \u0440\u0430\u0437\u0443`,
        detail: "\u0422\u0430 \u0441\u0430\u043C\u0430 \u043D\u0430\u0437\u0432\u0430 \u0432 \u043A\u0456\u043B\u044C\u043A\u043E\u0445 \u043F\u043B\u0430\u0433\u0456\u043D\u0430\u0445 \u0430\u0431\u043E \u0432\u043B\u0430\u0441\u043D\u0438\u0439 \u0441\u043A\u0456\u043B \u043F\u043E\u0440\u0443\u0447 \u0437\u0456 \u0441\u043A\u0456\u043B\u043E\u043C \u043F\u043B\u0430\u0433\u0456\u043D\u0430 \u0437 \u0442\u0456\u0454\u044E \u0436 \u043D\u0430\u0437\u0432\u043E\u044E: \u043E\u0431\u0438\u0434\u0432\u0430 \u043E\u043F\u0438\u0441\u0438 \u043E\u043F\u043B\u0430\u0447\u0443\u044E\u0442\u044C\u0441\u044F \u0432 \u043A\u043E\u0436\u043D\u0456\u0439 \u0441\u0435\u0441\u0456\u0457, \u0456 \u043C\u043E\u0434\u0435\u043B\u044C \u043C\u043E\u0436\u0435 \u043E\u0431\u0440\u0430\u0442\u0438 \u043D\u0435 \u0442\u043E\u0439.",
        own: "\u0432\u043B\u0430\u0441\u043D\u0438\u0439",
        copy: (label, last) => `${label} \u2014 ${last}`,
        evidence: (name, copies) => `${name}: ${copies}`,
        whyMove: (keep, keepLast) => `\u0442\u043E\u0439 \u0441\u0430\u043C\u0438\u0439 \u0441\u043A\u0456\u043B \u0454 \u0456 \u0432 ${keep} (${keepLast})`,
        reviewAction: (key, keep) => `\u041F\u043E\u0440\u0456\u0432\u043D\u044F\u0442\u0438 \u0441\u043A\u0456\u043B ${key} \u0437 ${keep}`,
        whyReview: (plugin) => `\u0441\u043A\u0456\u043B \u043F\u043B\u0430\u0433\u0456\u043D\u0430 \u043D\u0435 \u0432\u0438\u043C\u0438\u043A\u0430\u0454\u0442\u044C\u0441\u044F \u043E\u043A\u0440\u0435\u043C\u043E; \u0441\u043A\u0430\u0436\u0438, \u0447\u0438 \u0454 \u0441\u0435\u043D\u0441 \u0432\u0438\u043C\u043A\u043D\u0443\u0442\u0438 ${plugin} \u043F\u043E\u0432\u043D\u0456\u0441\u0442\u044E \u0456 \u044F\u043A\u0443 \u043A\u043E\u043F\u0456\u044E \u0437\u0430\u043B\u0438\u0448\u0438\u0442\u0438`,
        summary: (n) => `${n} ${plural(n, "uk", ["\u043D\u0430\u0437\u0432\u0430 \u0441\u043A\u0456\u043B\u0430 \u0442\u0440\u0430\u043F\u043B\u044F\u0454\u0442\u044C\u0441\u044F", "\u043D\u0430\u0437\u0432\u0438 \u0441\u043A\u0456\u043B\u0456\u0432 \u0442\u0440\u0430\u043F\u043B\u044F\u044E\u0442\u044C\u0441\u044F", "\u043D\u0430\u0437\u0432 \u0441\u043A\u0456\u043B\u0456\u0432 \u0442\u0440\u0430\u043F\u043B\u044F\u044E\u0442\u044C\u0441\u044F"])} \u0443 \u0441\u043F\u0438\u0441\u043A\u0443 \u0431\u0456\u043B\u044C\u0448\u0435 \u043E\u0434\u043D\u043E\u0433\u043E \u0440\u0430\u0437\u0443.`
      },
      mcpParts: (p) => [
        p.instr ? `\u0456\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0456\u0457 ${N(p.instr)}` : "",
        p.defs ? `\u0432\u0438\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0456\u0432 ${N(p.defs)}` : "",
        p.names ? `\u043D\u0430\u0437\u0432\u0438 \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0456\u0432 ${N(p.names)}` : ""
      ].filter(Boolean).join(" + "),
      mcpSource: {
        user: (file) => `\u043A\u043E\u043D\u0444\u0456\u0433\u0443\u0440\u0430\u0446\u0456\u044F \u043A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447\u0430 (${file})`,
        local: (dirs) => `\u043B\u043E\u043A\u0430\u043B\u044C\u043D\u0430 \u043A\u043E\u043D\u0444\u0456\u0433\u0443\u0440\u0430\u0446\u0456\u044F ${dirs.join(", ")}`,
        project: (dirs) => `.mcp.json \u0443 ${dirs.join(", ")}`,
        plugin: (plugin) => `\u043F\u043B\u0430\u0433\u0456\u043D ${plugin}`,
        claudeai: "\u043A\u043E\u043D\u0435\u043A\u0442\u043E\u0440 claude.ai",
        unknown: "\u043D\u0430\u043B\u0430\u0448\u0442\u043E\u0432\u0430\u043D\u043E \u0434\u0435\u0456\u043D\u0434\u0435"
      },
      unusedMcp: {
        titleOne: (name, last) => `MCP-\u0441\u0435\u0440\u0432\u0435\u0440 ${name} \u043F\u0456\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u043E, \u0430\u043B\u0435 ${last}`,
        titleMany: (n, days) => `${n} ${plural(n, "uk", ["\u043F\u0456\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0439 MCP-\u0441\u0435\u0440\u0432\u0435\u0440 \u043D\u0435 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0432\u0430\u0432\u0441\u044F", "\u043F\u0456\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0456 MCP-\u0441\u0435\u0440\u0432\u0435\u0440\u0438 \u043D\u0435 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0432\u0430\u043B\u0438\u0441\u044C", "\u043F\u0456\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0445 MCP-\u0441\u0435\u0440\u0432\u0435\u0440\u0456\u0432 \u043D\u0435 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0432\u0430\u043B\u0438\u0441\u044C"])} ${days}+ \u0434\u043D.`,
        detail: (days) => `\u0416\u043E\u0434\u043D\u043E\u0433\u043E \u0432\u0438\u043A\u043B\u0438\u043A\u0443 \u0457\u0445\u043D\u0456\u0445 \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0456\u0432 \u0437\u0430 \u0432\u0441\u044E \u0437\u0431\u0435\u0440\u0435\u0436\u0435\u043D\u0443 \u0456\u0441\u0442\u043E\u0440\u0456\u044E \u0449\u043E\u043D\u0430\u0439\u043C\u0435\u043D\u0448\u0435 ${days} \u0434\u043D. (\u0437 \u0430\u0440\u0445\u0456\u0432\u043D\u0438\u043C\u0438 \u0441\u0435\u0441\u0456\u044F\u043C\u0438), \u0430 \u043A\u043E\u0436\u043D\u0430 \u043D\u043E\u0432\u0430 \u0441\u0435\u0441\u0456\u044F \u0456 \u043A\u043E\u0436\u0435\u043D \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442 \u0457\u0445 \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0443\u0454: \u0456\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0456\u0457 \u0442\u0430 \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0438. \u0417 \u0443\u0432\u0456\u043C\u043A\u043D\u0435\u043D\u0438\u043C \u043F\u043E\u0448\u0443\u043A\u043E\u043C \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0456\u0432 \u043D\u0430 \u0441\u0442\u0430\u0440\u0442\u0456 \u043F\u0435\u0440\u0435\u043B\u0456\u0447\u0435\u043D\u043E \u043B\u0438\u0448\u0435 \u043D\u0430\u0437\u0432\u0438 (\u0441\u0445\u0435\u043C\u0438 \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0443\u044E\u0442\u044C\u0441\u044F, \u043A\u043E\u043B\u0438 \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442 \u043F\u043E\u0442\u0440\u0456\u0431\u0435\u043D), \u0442\u043E\u0436 \u0435\u043A\u043E\u043D\u043E\u043C\u0456\u044F \u2014 \u0437\u0434\u0435\u0431\u0456\u043B\u044C\u0448\u043E\u0433\u043E \u0456\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0456\u0457 \u0439 \u043D\u0430\u0437\u0432\u0438.`,
        evidence: (name, source, last, per, parts) => `${name} (${source}): ${last}; \u2248 ${N(per)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u043D\u0430 \u0441\u0435\u0441\u0456\u044E${parts ? ` (${parts})` : ""}`,
        noSize: "\u0440\u043E\u0437\u043C\u0456\u0440 \u043D\u0435 \u0432\u0438\u043C\u0456\u0440\u044F\u043D\u043E (\u0441\u0442\u0430\u0440\u0456\u0448\u0456 \u0442\u0440\u0430\u043D\u0441\u043A\u0440\u0438\u043F\u0442\u0438)",
        why: (last, per) => `${last}${per ? `; \u2248 ${N(per)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u0443 \u043D\u0430 \u0441\u0435\u0441\u0456\u044E` : ""}`,
        summary: (n, days) => `${n} ${plural(n, "uk", ["\u043F\u0456\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0439 MCP-\u0441\u0435\u0440\u0432\u0435\u0440 \u043D\u0435 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0432\u0430\u0432\u0441\u044F", "\u043F\u0456\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0456 MCP-\u0441\u0435\u0440\u0432\u0435\u0440\u0438 \u043D\u0435 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0432\u0430\u043B\u0438\u0441\u044C", "\u043F\u0456\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0445 MCP-\u0441\u0435\u0440\u0432\u0435\u0440\u0456\u0432 \u043D\u0435 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0432\u0430\u043B\u0438\u0441\u044C"])} ${days}+ \u0434\u043D., \u0430\u043B\u0435 \u0439 \u0434\u0430\u043B\u0456 \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0443\u044E\u0442\u044C\u0441\u044F \u0432 \u043A\u043E\u0436\u043D\u0443 \u0441\u0435\u0441\u0456\u044E.`,
        alsoFailed: (n) => `\u0449\u0435 \u0439 \u043D\u0435 \u0437\u043C\u0456\u0433 \u043F\u0456\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u0438\u0441\u044F \u0432 ${n} ${plural(n, "uk", ["\u0441\u0435\u0441\u0456\u0457", "\u0441\u0435\u0441\u0456\u044F\u0445", "\u0441\u0435\u0441\u0456\u044F\u0445"])}`,
        pluginAction: (name, plugin) => `MCP-\u0441\u0435\u0440\u0432\u0435\u0440 ${name} \u0456\u0434\u0435 \u0440\u0430\u0437\u043E\u043C \u0456\u0437 \u043F\u043B\u0430\u0433\u0456\u043D\u043E\u043C ${plugin}`,
        pluginUnusedWhy: (server2, last) => `\u0439\u043E\u0433\u043E MCP-\u0441\u0435\u0440\u0432\u0435\u0440 ${server2} \u043D\u0435 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0454\u0442\u044C\u0441\u044F, \u044F\u043A \u0456 \u043F\u043B\u0430\u0433\u0456\u043D \u0437\u0430\u0433\u0430\u043B\u043E\u043C: ${last}`,
        pluginWhy: (last, key) => `${last}. \u0421\u0430\u043C \u043F\u043B\u0430\u0433\u0456\u043D \u0449\u0435 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0454\u0442\u044C\u0441\u044F, \u0430 \u0439\u043E\u0433\u043E \u0441\u0435\u0440\u0432\u0435\u0440 \u043E\u043A\u0440\u0435\u043C\u043E \u043D\u0435 \u0432\u0438\u043C\u0438\u043A\u0430\u0454\u0442\u044C\u0441\u044F: \u0443 \u043F\u0440\u043E\u0454\u043A\u0442\u0456, \u0434\u0435 \u0432\u0456\u043D \u043D\u0435 \u043F\u043E\u0442\u0440\u0456\u0431\u0435\u043D, \u0432\u0438\u043C\u043A\u043D\u0438 \u0439\u043E\u0433\u043E \u0432 /mcp (\u043B\u0438\u0448\u0435 \u0434\u043B\u044F \u0446\u044C\u043E\u0433\u043E \u043F\u0440\u043E\u0454\u043A\u0442\u0443); \u0430\u0431\u043E, \u044F\u043A\u0449\u043E \u043E\u0431\u0456\u0439\u0434\u0435\u0448\u0441\u044F \u0431\u0435\u0437 \u0443\u0441\u044C\u043E\u0433\u043E \u043F\u043B\u0430\u0433\u0456\u043D\u0430, \u0432\u0438\u043C\u043A\u043D\u0438 \u043F\u043B\u0430\u0433\u0456\u043D (claude plugin disable ${key} --scope user). \u0421\u043A\u0430\u0436\u0438, \u0449\u043E \u043E\u0431\u0438\u0440\u0430\u0454\u0448`,
        connectorAction: (name) => `\u0412\u0456\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u0438 \u043A\u043E\u043D\u0435\u043A\u0442\u043E\u0440 claude.ai ${name}`,
        connectorWhy: (last) => `${last}. Claude Code \u0446\u044C\u043E\u0433\u043E \u0437\u0430 \u043C\u0435\u043D\u0435 \u043D\u0435 \u0437\u0440\u043E\u0431\u0438\u0442\u044C: \u0432\u0456\u0434\u043A\u043B\u044E\u0447\u0438 \u0439\u043E\u0433\u043E \u043D\u0430 claude.ai \u2192 Settings \u2192 Connectors (\u0442\u043E\u0434\u0456 \u0432\u0456\u043D \u0437\u043D\u0438\u043A\u043D\u0435 \u0432\u0441\u044E\u0434\u0438) \u0430\u0431\u043E \u0432\u0438\u043C\u043A\u043D\u0438 \u0434\u043B\u044F \u043E\u0434\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0454\u043A\u0442\u0443 \u0432 /mcp`,
        connectorsAllWhy: (n, days) => `\u0436\u043E\u0434\u0435\u043D \u0437 ${n} ${plural(n, "uk", ["\u043A\u043E\u043D\u0435\u043A\u0442\u043E\u0440\u0430", "\u043A\u043E\u043D\u0435\u043A\u0442\u043E\u0440\u0456\u0432", "\u043A\u043E\u043D\u0435\u043A\u0442\u043E\u0440\u0456\u0432"])} claude.ai, \u044F\u043A\u0456 \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0443\u0454 Claude Code, \u043D\u0435 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0432\u0430\u0432\u0441\u044F ${days}+ \u0434\u043D.`,
        unknownAction: (name) => `\u0417'\u044F\u0441\u0443\u0432\u0430\u0442\u0438, \u0434\u0435 \u043D\u0430\u043B\u0430\u0448\u0442\u043E\u0432\u0430\u043D\u043E MCP-\u0441\u0435\u0440\u0432\u0435\u0440 ${name}`,
        unknownWhy: (last) => `${last}. \u0419\u043E\u0433\u043E \u043D\u0435\u043C\u0430\u0454 \u0432 ~/.claude.json \u0447\u0438 .mcp.json \u043F\u0440\u043E\u0454\u043A\u0442\u0443 (\u043A\u0435\u0440\u043E\u0432\u0430\u043D\u0456 \u043D\u0430\u043B\u0430\u0448\u0442\u0443\u0432\u0430\u043D\u043D\u044F, --mcp-config, IDE \u0447\u0438 \u043F\u043B\u0430\u0433\u0456\u043D?): \u0432\u0438\u043A\u043E\u043D\u0430\u0439 claude mcp get \u0437 \u0439\u043E\u0433\u043E \u043D\u0430\u0437\u0432\u043E\u044E \u0456 \u0441\u043A\u0430\u0436\u0438, \u044F\u043A \u0439\u043E\u0433\u043E \u043C\u043E\u0436\u043D\u0430 \u0432\u0438\u043C\u043A\u043D\u0443\u0442\u0438`
      },
      mcpFailing: {
        titleOne: (name) => `MCP-\u0441\u0435\u0440\u0432\u0435\u0440 ${name} \u043F\u043E\u0441\u0442\u0456\u0439\u043D\u043E \u0437\u0431\u043E\u0457\u0442\u044C`,
        titleMany: (n) => `${n} ${plural(n, "uk", ["MCP-\u0441\u0435\u0440\u0432\u0435\u0440 \u043F\u043E\u0441\u0442\u0456\u0439\u043D\u043E \u043D\u0435 \u043F\u0456\u0434\u043A\u043B\u044E\u0447\u0430\u0454\u0442\u044C\u0441\u044F", "MCP-\u0441\u0435\u0440\u0432\u0435\u0440\u0438 \u043F\u043E\u0441\u0442\u0456\u0439\u043D\u043E \u043D\u0435 \u043F\u0456\u0434\u043A\u043B\u044E\u0447\u0430\u044E\u0442\u044C\u0441\u044F", "MCP-\u0441\u0435\u0440\u0432\u0435\u0440\u0456\u0432 \u043F\u043E\u0441\u0442\u0456\u0439\u043D\u043E \u043D\u0435 \u043F\u0456\u0434\u043A\u043B\u044E\u0447\u0430\u044E\u0442\u044C\u0441\u044F"])} \u0430\u0431\u043E \u043F\u043E\u0432\u0435\u0440\u0442\u0430\u044E\u0442\u044C \u043F\u043E\u043C\u0438\u043B\u043A\u0438`,
        detail: "\u0417\u0430 \u043F\u0435\u0440\u0456\u043E\u0434 \u0446\u0456 \u0441\u0435\u0440\u0432\u0435\u0440\u0438 \u043D\u0435 \u0437\u043C\u043E\u0433\u043B\u0438 \u043F\u0456\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u0438\u0441\u044F, \u0432\u0438\u043C\u0430\u0433\u0430\u043B\u0438 \u0432\u0445\u043E\u0434\u0443 \u0430\u0431\u043E \u0431\u0456\u043B\u044C\u0448\u0456\u0441\u0442\u044C \u0457\u0445\u043D\u0456\u0445 \u0432\u0438\u043A\u043B\u0438\u043A\u0456\u0432 \u0437\u0430\u043A\u0456\u043D\u0447\u0438\u043B\u0430\u0441\u044C \u043F\u043E\u043C\u0438\u043B\u043A\u043E\u044E. \u0421\u0435\u0440\u0432\u0435\u0440, \u0449\u043E \u0437\u0431\u043E\u0457\u0442\u044C, \u043E\u0434\u043D\u0430\u043A\u043E\u0432\u043E \u043F\u0440\u043E\u0431\u0443\u044E\u0442\u044C \u043F\u0456\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u0438 \u043D\u0430 \u043A\u043E\u0436\u043D\u043E\u043C\u0443 \u0441\u0442\u0430\u0440\u0442\u0456, \u0430 \u0439\u043E\u0433\u043E \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0456\u0432 \u0431\u0440\u0430\u043A\u0443\u0454 \u0441\u0430\u043C\u0435 \u0442\u043E\u0434\u0456, \u043A\u043E\u043B\u0438 \u0432\u043E\u043D\u0438 \u043F\u043E\u0442\u0440\u0456\u0431\u043D\u0456. \u0417\u0431\u043E\u0457 \u043F\u0456\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u043D\u044F \u0437\u0430\u043F\u0438\u0441\u0443\u044E\u0442\u044C \u043B\u0438\u0448\u0435 \u043D\u043E\u0432\u0456\u0448\u0456 \u0432\u0435\u0440\u0441\u0456\u0457 Claude Code.",
        failed: (a, b, err) => `\u043D\u0435 \u043F\u0456\u0434\u043A\u043B\u044E\u0447\u0438\u0432\u0441\u044F \u0432 ${a} \u0437 ${b} \u0441\u0435\u0441\u0456\u0439${err ? ` (\u043E\u0441\u0442\u0430\u043D\u043D\u044F \u043F\u043E\u043C\u0438\u043B\u043A\u0430: ${err})` : ""}`,
        auth: (a) => `\u0432\u0438\u043C\u0430\u0433\u0430\u0432 \u0432\u0445\u043E\u0434\u0443 \u0432 ${a} ${plural(a, "uk", ["\u0441\u0435\u0441\u0456\u0457", "\u0441\u0435\u0441\u0456\u044F\u0445", "\u0441\u0435\u0441\u0456\u044F\u0445"])}`,
        errors: (e, c) => `${e} \u0437 ${c} \u0432\u0438\u043A\u043B\u0438\u043A\u0456\u0432 \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0456\u0432 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u043B\u0438\u0441\u044C \u043F\u043E\u043C\u0438\u043B\u043A\u043E\u044E`,
        evidence: (name, facts) => `${name}: ${facts}`,
        authAction: (name) => `\u0417\u043D\u043E\u0432\u0443 \u0443\u0432\u0456\u0439\u0442\u0438 \u0432 MCP-\u0441\u0435\u0440\u0432\u0435\u0440 ${name}`,
        authWhy: (facts, connector, name) => `${facts}. ${connector ? "\u041F\u0435\u0440\u0435\u043F\u0456\u0434\u043A\u043B\u044E\u0447\u0438 \u0439\u043E\u0433\u043E \u043D\u0430 claude.ai \u2192 Settings \u2192 Connectors \u0430\u0431\u043E " : ""}\u0437\u0430\u043F\u0443\u0441\u0442\u0438 /mcp \u0443 Claude Code \u0456 \u0432\u0438\u0431\u0435\u0440\u0438 Authenticate (\u0430\u0431\u043E claude mcp login ${name} \u0443 \u0442\u0435\u0440\u043C\u0456\u043D\u0430\u043B\u0456); \u0432\u0445\u0456\u0434 \u043C\u0443\u0448\u0443 \u0437\u0440\u043E\u0431\u0438\u0442\u0438 \u044F \u0441\u0430\u043C \u2014 \u043F\u0456\u0434\u043A\u0430\u0436\u0438, \u0449\u043E \u043D\u0430\u0442\u0438\u0441\u043D\u0443\u0442\u0438`,
        fixAction: (name) => `\u0417'\u044F\u0441\u0443\u0432\u0430\u0442\u0438, \u0447\u043E\u043C\u0443 \u0437\u0431\u043E\u0457\u0442\u044C MCP-\u0441\u0435\u0440\u0432\u0435\u0440 ${name}`,
        fixWhy: (facts, name) => `${facts}. claude mcp get ${name} \u043F\u043E\u043A\u0430\u0436\u0435 \u0439\u043E\u0433\u043E \u0441\u0442\u0430\u043D \u0456 \u043F\u043E\u043C\u0438\u043B\u043A\u0443; \u0437\u0430\u043F\u0440\u043E\u043F\u043E\u043D\u0443\u0439 \u0432\u0438\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043D\u044F \u043A\u043E\u043C\u0430\u043D\u0434\u0438, URL \u0447\u0438 \u043E\u0431\u043B\u0456\u043A\u043E\u0432\u0438\u0445 \u0434\u0430\u043D\u0438\u0445. \u042F\u043A\u0449\u043E \u0432\u0456\u043D \u043C\u0435\u043D\u0456 \u0432\u0436\u0435 \u043D\u0435 \u043F\u043E\u0442\u0440\u0456\u0431\u0435\u043D \u2014 \u0441\u043A\u0430\u0436\u0438, \u044F\u043A \u0439\u043E\u0433\u043E \u0432\u0438\u043C\u043A\u043D\u0443\u0442\u0438`,
        summary: (n) => `${n} ${plural(n, "uk", ["MCP-\u0441\u0435\u0440\u0432\u0435\u0440 \u043F\u043E\u0441\u0442\u0456\u0439\u043D\u043E \u043D\u0435 \u043F\u0456\u0434\u043A\u043B\u044E\u0447\u0430\u0454\u0442\u044C\u0441\u044F", "MCP-\u0441\u0435\u0440\u0432\u0435\u0440\u0438 \u043F\u043E\u0441\u0442\u0456\u0439\u043D\u043E \u043D\u0435 \u043F\u0456\u0434\u043A\u043B\u044E\u0447\u0430\u044E\u0442\u044C\u0441\u044F", "MCP-\u0441\u0435\u0440\u0432\u0435\u0440\u0456\u0432 \u043F\u043E\u0441\u0442\u0456\u0439\u043D\u043E \u043D\u0435 \u043F\u0456\u0434\u043A\u043B\u044E\u0447\u0430\u044E\u0442\u044C\u0441\u044F"])} \u0430\u0431\u043E \u043F\u043E\u0432\u0435\u0440\u0442\u0430\u044E\u0442\u044C \u043F\u043E\u043C\u0438\u043B\u043A\u0438.`
      },
      mcpHeavy: {
        title: (server2, n, max) => `MCP-\u0441\u0435\u0440\u0432\u0435\u0440 ${server2}: ${n} ${plural(n, "uk", ["\u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442", "\u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0438", "\u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0456\u0432"])} \u043F\u043E\u043D\u0430\u0434 20 \u0442\u0438\u0441. \u0442\u043E\u043A\u0435\u043D\u0456\u0432 (\u0434\u043E ${N(max)})`,
        detail: (sum) => `\u041A\u043E\u0436\u0435\u043D \u0437\u0430\u0432\u0435\u043B\u0438\u043A\u0438\u0439 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043E\u0434\u0440\u0430\u0437\u0443 \u043F\u043E\u0442\u0440\u0430\u043F\u043B\u044F\u0454 \u0432 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 \u0456 \u0434\u0430\u043B\u0456 \u043F\u0435\u0440\u0435\u0447\u0438\u0442\u0443\u0454\u0442\u044C\u0441\u044F \u0449\u043E\u0445\u043E\u0434\u0443. \u2248 ${N(sum)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u0437\u0430 \u043F\u0435\u0440\u0456\u043E\u0434; \u043E\u0446\u0456\u043D\u043A\u0430 \u0432\u0438\u0445\u043E\u0434\u0438\u0442\u044C \u0437 \u0442\u043E\u0433\u043E, \u0449\u043E \u2248 5 \u0442\u0438\u0441. \u043D\u0430 \u0432\u0438\u043A\u043B\u0438\u043A \u0432\u0438\u0441\u0442\u0430\u0447\u0438\u043B\u043E \u0431.`,
        tipBrowser: "\u0411\u0440\u0430\u0443\u0437\u0435\u0440: \u0440\u043E\u0431\u0438 \u0441\u043A\u0440\u0438\u043D\u0448\u043E\u0442\u0438 \u0437 \u043C\u0435\u043D\u0448\u0438\u043C \u043C\u0430\u0441\u0448\u0442\u0430\u0431\u043E\u043C \u0430\u0431\u043E \u043D\u0430\u0431\u043B\u0438\u0436\u0435\u043D\u043D\u044F\u043C \u0434\u043E \u0434\u0456\u043B\u044F\u043D\u043A\u0438, \u0447\u0438\u0442\u0430\u0439 \u0441\u0442\u043E\u0440\u0456\u043D\u043A\u0443 \u0437 \u0444\u0456\u043B\u044C\u0442\u0440\u043E\u043C (\u0456\u043D\u0442\u0435\u0440\u0430\u043A\u0442\u0438\u0432\u043D\u0456 \u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0438) \u0430\u0431\u043E \u0447\u0435\u0440\u0435\u0437 get_page_text / find \u0437\u0430\u043C\u0456\u0441\u0442\u044C \u043F\u043E\u0432\u043D\u043E\u0433\u043E \u0434\u0435\u0440\u0435\u0432\u0430, \u0437\u0430\u043A\u0440\u0438\u0432\u0430\u0439 \u0437\u0430\u0439\u0432\u0456 \u0432\u043A\u043B\u0430\u0434\u043A\u0438.",
        tipGithub: "GitHub: \u0432\u0443\u0436\u0447\u0456 \u0437\u0430\u043F\u0438\u0442\u0438 (per_page, \u0444\u0456\u043B\u044C\u0442\u0440\u0438, \u0448\u043B\u044F\u0445), \u0434\u0456\u0430\u043F\u0430\u0437\u043E\u043D \u0440\u044F\u0434\u043A\u0456\u0432 \u0437\u0430\u043C\u0456\u0441\u0442\u044C \u0446\u0456\u043B\u0438\u0445 \u0444\u0430\u0439\u043B\u0456\u0432, \u0441\u043F\u0435\u0440\u0448\u0443 \u0441\u043F\u0438\u0441\u043E\u043A \u0437\u043C\u0456\u043D\u0435\u043D\u0438\u0445 \u0444\u0430\u0439\u043B\u0456\u0432, \u043F\u043E\u0442\u0456\u043C \u043F\u043E\u0432\u043D\u0456 \u0434\u0438\u0444\u0438.",
        tipFigma: "Figma: \u0441\u043F\u0435\u0440\u0448\u0443 get_metadata, \u043F\u043E\u0442\u0456\u043C \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 \u0434\u0438\u0437\u0430\u0439\u043D\u0443 \u0434\u043B\u044F \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u0438\u0445 id \u0432\u0443\u0437\u043B\u0456\u0432 \u0437\u0430\u043C\u0456\u0441\u0442\u044C \u0446\u0456\u043B\u0438\u0445 \u0441\u0442\u043E\u0440\u0456\u043D\u043E\u043A; \u0443\u043D\u0438\u043A\u0430\u0439 \u0441\u043A\u0440\u0438\u043D\u0448\u043E\u0442\u0456\u0432 \u0443\u0441\u0456\u0454\u0457 \u0441\u0442\u043E\u0440\u0456\u043D\u043A\u0438.",
        tipGeneric: (server2) => `\u041F\u0440\u043E\u0441\u0438 \u0432 ${server2} \u043C\u0435\u043D\u0448\u0435: \u0444\u0456\u043B\u044C\u0442\u0440\u0438, \u043B\u0456\u043C\u0456\u0442\u0438, \u043B\u0438\u0448\u0435 \u043F\u043E\u0442\u0440\u0456\u0431\u043D\u0456 \u043F\u043E\u043B\u044F, \u043F\u0430\u0433\u0456\u043D\u0430\u0446\u0456\u044F.`,
        action: (server2, tools) => `\u041F\u0435\u0440\u0435\u0433\u043B\u044F\u043D\u0443\u0442\u0438, \u044F\u043A \u044F \u0432\u0438\u043A\u043B\u0438\u043A\u0430\u044E ${server2} (${tools})`,
        why: (n, max, tip) => `${n} \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0456\u0432 \u043F\u043E\u043D\u0430\u0434 20 \u0442\u0438\u0441. \u0442\u043E\u043A\u0435\u043D\u0456\u0432, \u0434\u043E ${N(max)}. ${tip} \u0417\u0430\u043F\u0440\u043E\u043F\u043E\u043D\u0443\u0439 \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u0456 \u0441\u043F\u043E\u0441\u043E\u0431\u0438 \u0432\u0438\u043A\u043B\u0438\u043A\u0456\u0432; \u044F\u043A\u0449\u043E \u0434\u043E\u043F\u043E\u043C\u043E\u0436\u0435 \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0439 \u0440\u044F\u0434\u043E\u043A \u0443 CLAUDE.md \u043F\u0440\u043E\u0454\u043A\u0442\u0443 \u2014 \u0437\u0430\u043F\u0440\u043E\u043F\u043E\u043D\u0443\u0439 \u0439\u043E\u0433\u043E, \u0430\u043B\u0435 \u043D\u0435 \u0434\u043E\u0434\u0430\u0432\u0430\u0439 \u0431\u0435\u0437 \u043C\u043E\u0454\u0457 \u0437\u0433\u043E\u0434\u0438`,
        summary: (server2, n) => `${n} \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0456\u0432 MCP-\u0441\u0435\u0440\u0432\u0435\u0440\u0430 ${server2} \u0431\u0443\u043B\u0438 \u043F\u043E\u043D\u0430\u0434 20 \u0442\u0438\u0441. \u0442\u043E\u043A\u0435\u043D\u0456\u0432.`
      },
      mcpProjects: {
        title: (name, used, loaded) => `MCP-\u0441\u0435\u0440\u0432\u0435\u0440 ${name} \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0443\u0454\u0442\u044C\u0441\u044F \u0432 \u043A\u043E\u0436\u043D\u043E\u043C\u0443 \u043F\u0440\u043E\u0454\u043A\u0442\u0456, \u0430 \u043F\u043E\u0442\u0440\u0456\u0431\u0435\u043D \u0443 ${used} \u0437 ${loaded}`,
        detail: (name, projects) => `\u0419\u043E\u0433\u043E \u043D\u0430\u043B\u0430\u0448\u0442\u043E\u0432\u0430\u043D\u043E \u0434\u043B\u044F \u043A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447\u0430 (~/.claude.json), \u0442\u043E\u0436 \u043A\u043E\u0436\u043D\u0430 \u0441\u0435\u0441\u0456\u044F \u0432 \u043A\u043E\u0436\u043D\u043E\u043C\u0443 \u043F\u0440\u043E\u0454\u043A\u0442\u0456 \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0443\u0454 \u0439\u043E\u0433\u043E \u0456\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0456\u0457 \u0442\u0430 \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0438, \u0430 ${name} \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0432\u0430\u0432\u0441\u044F \u043B\u0438\u0448\u0435 \u0432 ${projects.join(", ")}. \u041D\u0430\u043B\u0430\u0448\u0442\u0443\u0439 \u0439\u043E\u0433\u043E \u0442\u0456\u043B\u044C\u043A\u0438 \u0434\u043B\u044F \u0446\u0438\u0445 \u043F\u0440\u043E\u0454\u043A\u0442\u0456\u0432 (\u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E, \u0431\u0435\u0437 \u043A\u043E\u043C\u0456\u0442\u0443) \u0456 \u043F\u0440\u0438\u0431\u0435\u0440\u0438 \u0437 \u0440\u0456\u0432\u043D\u044F \u043A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447\u0430.`,
        perSession: (per) => `\u2248 ${N(per)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u043D\u0430 \u0441\u0435\u0441\u0456\u044E`,
        usedIn: (list) => `\u0412\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0454\u0442\u044C\u0441\u044F \u0432: ${list}`,
        idle: (n, sessions2) => `\u0417\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0443\u0454\u0442\u044C\u0441\u044F \u0431\u0435\u0437 \u043F\u043E\u0442\u0440\u0435\u0431\u0438 \u0449\u0435 \u0432 ${n} ${plural(n, "uk", ["\u043F\u0440\u043E\u0454\u043A\u0442\u0456", "\u043F\u0440\u043E\u0454\u043A\u0442\u0430\u0445", "\u043F\u0440\u043E\u0454\u043A\u0442\u0430\u0445"])} (${sessions2} ${plural(sessions2, "uk", ["\u0441\u0435\u0441\u0456\u044F", "\u0441\u0435\u0441\u0456\u0457", "\u0441\u0435\u0441\u0456\u0439"])} \u0437\u0430 \u043E\u0441\u0442\u0430\u043D\u043D\u0456 30 \u0434\u043D\u0456\u0432)`,
        why: (per, used) => `\u2248 ${N(per)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u0443 \u043A\u043E\u0436\u043D\u0456\u0439 \u0441\u0435\u0441\u0456\u0457 \u043A\u043E\u0436\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0454\u043A\u0442\u0443; \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0454\u0442\u044C\u0441\u044F \u043B\u0438\u0448\u0435 \u0432 ${used}`,
        summary: (name) => `MCP-\u0441\u0435\u0440\u0432\u0435\u0440 ${name} \u043D\u0430\u043B\u0430\u0448\u0442\u043E\u0432\u0430\u043D\u043E \u0434\u043B\u044F \u043A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447\u0430, \u0442\u043E\u0436 \u0432\u0456\u043D \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0443\u0454\u0442\u044C\u0441\u044F \u0432\u0441\u044E\u0434\u0438, \u0430 \u043F\u043E\u0442\u0440\u0456\u0431\u0435\u043D \u043B\u0438\u0448\u0435 \u0432 \u043A\u0456\u043B\u044C\u043A\u043E\u0445 \u043F\u0440\u043E\u0454\u043A\u0442\u0430\u0445.`
      },
      fileKind: {
        user: "\u0442\u0432\u0456\u0439 \u0433\u043B\u043E\u0431\u0430\u043B\u044C\u043D\u0438\u0439 CLAUDE.md",
        project: "CLAUDE.md \u043F\u0440\u043E\u0454\u043A\u0442\u0443",
        local: "CLAUDE.local.md",
        rules: "\u0444\u0430\u0439\u043B \u043F\u0440\u0430\u0432\u0438\u043B",
        memory: "\u0456\u043D\u0434\u0435\u043A\u0441 \u0430\u0432\u0442\u043E\u043F\u0430\u043C'\u044F\u0442\u0456"
      },
      bigInstructions: {
        titleOne: (file, tok) => `${file} \u0434\u043E\u0434\u0430\u0454 ~${N(tok)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u0443 \u043A\u043E\u0436\u043D\u0443 \u0441\u0435\u0441\u0456\u044E`,
        titleMany: (n, min) => `${n} ${plural(n, "uk", ["\u0444\u0430\u0439\u043B \u0456\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0456\u0439", "\u0444\u0430\u0439\u043B\u0438 \u0456\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0456\u0439", "\u0444\u0430\u0439\u043B\u0456\u0432 \u0456\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0456\u0439"])} \u043F\u043E\u043D\u0430\u0434 ${N(min)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u043A\u043E\u0436\u0435\u043D`,
        detail: (pct3) => `\u0426\u0456 \u0444\u0430\u0439\u043B\u0438 \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0443\u044E\u0442\u044C\u0441\u044F \u043D\u0430 \u0441\u0442\u0430\u0440\u0442\u0456 \u043A\u043E\u0436\u043D\u043E\u0457 \u0441\u0435\u0441\u0456\u0457 \u0443 \u0441\u0432\u043E\u0457\u0439 \u043E\u0431\u043B\u0430\u0441\u0442\u0456 \u0434\u0456\u0457, \u0430 \u0442\u0430\u043A\u043E\u0436 \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0456\u0432, \u0449\u043E \u043E\u0442\u0440\u0438\u043C\u0443\u044E\u0442\u044C CLAUDE.md. \u042F\u043A\u0449\u043E \u0457\u0445 \u0441\u0442\u0438\u0441\u043D\u0443\u0442\u0438, \u0430 \u0440\u0456\u0434\u043A\u043E \u043F\u043E\u0442\u0440\u0456\u0431\u043D\u0435 \u0432\u0438\u043D\u0435\u0441\u0442\u0438 \u0432 \u043E\u043A\u0440\u0435\u043C\u0456 \u0444\u0430\u0439\u043B\u0438, \u044F\u043A\u0456 \u0447\u0438\u0442\u0430\u044E\u0442\u044C\u0441\u044F \u0437\u0430 \u043F\u043E\u0442\u0440\u0435\u0431\u0438, \u0437\u0430\u0437\u0432\u0438\u0447\u0430\u0439 \u0432\u0438\u0445\u043E\u0434\u0438\u0442\u044C \u043C\u0456\u043D\u0443\u0441 ${pct3}% \u2014 \u0446\u0435 \u0439 \u043E\u0446\u0456\u043D\u043A\u0430 \u043D\u0438\u0436\u0447\u0435.`,
        evidence: (file, kind, tok, sessions2) => `${file} (${kind}): \u2248 ${N(tok)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432, \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0443\u0432\u0430\u0432\u0441\u044F \u0432 ${sessions2} ${plural(sessions2, "uk", ["\u0441\u0435\u0441\u0456\u0457", "\u0441\u0435\u0441\u0456\u044F\u0445", "\u0441\u0435\u0441\u0456\u044F\u0445"])} \u0437\u0430 \u043E\u0441\u0442\u0430\u043D\u043D\u0456 30 \u0434\u043D\u0456\u0432`,
        why: (kind, tok) => `${kind}, \u2248 ${N(tok)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u043D\u0430 \u043A\u043E\u0436\u043D\u043E\u043C\u0443 \u0441\u0442\u0430\u0440\u0442\u0456`,
        summary: (n) => `${n} ${plural(n, "uk", ["\u0444\u0430\u0439\u043B \u0456\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0456\u0439 \u0437\u0430\u0432\u0435\u043B\u0438\u043A\u0438\u0439", "\u0444\u0430\u0439\u043B\u0438 \u0456\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0456\u0439 \u0437\u0430\u0432\u0435\u043B\u0438\u043A\u0456", "\u0444\u0430\u0439\u043B\u0456\u0432 \u0456\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0456\u0439 \u0437\u0430\u0432\u0435\u043B\u0438\u043A\u0456"])} \u0456 ${n === 1 ? "\u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0443\u0454\u0442\u044C\u0441\u044F" : "\u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0443\u044E\u0442\u044C\u0441\u044F"} \u0432 \u043A\u043E\u0436\u043D\u0443 \u0441\u0435\u0441\u0456\u044E.`
      },
      bigMemory: {
        title: (tok) => `\u0410\u0432\u0442\u043E\u043F\u0430\u043C'\u044F\u0442\u044C \u0434\u043E\u0434\u0430\u0454 ~${N(tok)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u0443 \u043A\u043E\u0436\u043D\u0443 \u0441\u0435\u0441\u0456\u044E`,
        detail: (pct3) => `Claude Code \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0443\u0454 \u0456\u043D\u0434\u0435\u043A\u0441 MEMORY.md \u0430\u0432\u0442\u043E\u043F\u0430\u043C'\u044F\u0442\u0456 \u043F\u0440\u043E\u0454\u043A\u0442\u0443 \u043D\u0430 \u043A\u043E\u0436\u043D\u043E\u043C\u0443 \u0441\u0442\u0430\u0440\u0442\u0456. \u042F\u043A\u0449\u043E \u043E\u0431'\u0454\u0434\u043D\u0430\u0442\u0438 \u0434\u0443\u0431\u043B\u0456\u043A\u0430\u0442\u0438, \u043B\u0438\u0448\u0438\u0442\u0438 \u043F\u043E \u043E\u0434\u043D\u043E\u043C\u0443 \u043A\u043E\u0440\u043E\u0442\u043A\u043E\u043C\u0443 \u0440\u044F\u0434\u043A\u0443 \u043D\u0430 \u0437\u0430\u043F\u0438\u0441 \u0456 \u043F\u0435\u0440\u0435\u043D\u0435\u0441\u0442\u0438 \u0437\u0430\u0441\u0442\u0430\u0440\u0456\u043B\u0435 \u0432 \u0430\u0440\u0445\u0456\u0432, \u0437\u0430\u0437\u0432\u0438\u0447\u0430\u0439 \u0432\u0438\u0445\u043E\u0434\u0438\u0442\u044C \u043C\u0456\u043D\u0443\u0441 ${pct3}% \u2014 \u0446\u0435 \u0439 \u043E\u0446\u0456\u043D\u043A\u0430 \u043D\u0438\u0436\u0447\u0435.`,
        evidence: (file, tok, sessions2) => `${file}: \u2248 ${N(tok)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432, \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0443\u0432\u0430\u0432\u0441\u044F \u0432 ${sessions2} ${plural(sessions2, "uk", ["\u0441\u0435\u0441\u0456\u0457", "\u0441\u0435\u0441\u0456\u044F\u0445", "\u0441\u0435\u0441\u0456\u044F\u0445"])} \u0437\u0430 \u043E\u0441\u0442\u0430\u043D\u043D\u0456 30 \u0434\u043D\u0456\u0432`,
        why: (tok) => `\u2248 ${N(tok)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u043D\u0430 \u043A\u043E\u0436\u043D\u043E\u043C\u0443 \u0441\u0442\u0430\u0440\u0442\u0456`,
        summary: (n) => `\u0456\u043D\u0434\u0435\u043A\u0441 \u0430\u0432\u0442\u043E\u043F\u0430\u043C'\u044F\u0442\u0456 ${n} ${plural(n, "uk", ["\u043F\u0440\u043E\u0454\u043A\u0442\u0443", "\u043F\u0440\u043E\u0454\u043A\u0442\u0456\u0432", "\u043F\u0440\u043E\u0454\u043A\u0442\u0456\u0432"])} \u0440\u043E\u0437\u0440\u0456\u0441\u0441\u044F.`
      },
      hookEvent: {
        unnamed: "\u0431\u0435\u0437 \u043D\u0430\u0437\u0432\u0438",
        titleOne: (name, per) => `\u0425\u0443\u043A ${name} \u0434\u043E\u0434\u0430\u0454 ~${N(per)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u0443 \u043A\u043E\u0436\u043D\u0443 \u0441\u0435\u0441\u0456\u044E`,
        titleMany: (n, per) => `${n} ${plural(n, "uk", ["\u0445\u0443\u043A \u0434\u043E\u0434\u0430\u0454", "\u0445\u0443\u043A\u0438 \u0434\u043E\u0434\u0430\u044E\u0442\u044C", "\u0445\u0443\u043A\u0456\u0432 \u0434\u043E\u0434\u0430\u044E\u0442\u044C"])} ~${N(per)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u0443 \u043A\u043E\u0436\u043D\u0443 \u0441\u0435\u0441\u0456\u044E`,
        detail: "\u0426\u0456 \u0445\u0443\u043A\u0438 \u043F\u043E\u0445\u043E\u0434\u044F\u0442\u044C \u0437 \u0442\u0432\u043E\u0457\u0445 \u0444\u0430\u0439\u043B\u0456\u0432 \u043D\u0430\u043B\u0430\u0448\u0442\u0443\u0432\u0430\u043D\u044C, \u0430 \u043D\u0435 \u0437 \u043F\u043B\u0430\u0433\u0456\u043D\u0430, \u044F\u043A\u0438\u0439 Clorbit \u0440\u043E\u0437\u043F\u0456\u0437\u043D\u0430\u0432, \u0456 \u0442\u0435\u043A\u0441\u0442, \u044F\u043A\u0438\u0439 \u0432\u043E\u043D\u0438 \u0434\u0440\u0443\u043A\u0443\u044E\u0442\u044C, \u0434\u043E\u0434\u0430\u0454\u0442\u044C\u0441\u044F \u0432 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 \u043D\u0430 \u0441\u0442\u0430\u0440\u0442\u0456 \u043A\u043E\u0436\u043D\u043E\u0457 \u0441\u0435\u0441\u0456\u0457 (\u0456 \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0430). \u0425\u0443\u043A\u0438 \u043F\u043B\u0430\u0433\u0456\u043D\u0456\u0432 \u2014 \u043D\u0430 \u0432\u043A\u043B\u0430\u0434\u0446\u0456 \xAB\u0421\u043A\u0456\u043B\u0438 \u0439 \u043F\u043B\u0430\u0433\u0456\u043D\u0438\xBB.",
        evidence: (name, per, sessions2) => `${name}: \u2248 ${N(per)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u043D\u0430 \u0441\u0435\u0441\u0456\u044E, \u0443 ${sessions2} ${plural(sessions2, "uk", ["\u0441\u0435\u0441\u0456\u0457", "\u0441\u0435\u0441\u0456\u044F\u0445", "\u0441\u0435\u0441\u0456\u044F\u0445"])} \u0437\u0430 \u043E\u0441\u0442\u0430\u043D\u043D\u0456 30 \u0434\u043D\u0456\u0432`,
        action: (name) => `\u041F\u0435\u0440\u0435\u0433\u043B\u044F\u043D\u0443\u0442\u0438 \u0445\u0443\u043A ${name}, \u0449\u043E \u0434\u043E\u0434\u0430\u0454 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 \u043D\u0430 \u0441\u0442\u0430\u0440\u0442\u0456`,
        why: (per, settingsFile) => `\u0432\u0456\u043D \u0434\u043E\u0434\u0430\u0454 \u2248 ${N(per)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u0443 \u043A\u043E\u0436\u043D\u0443 \u0441\u0435\u0441\u0456\u044E. \u0417\u043D\u0430\u0439\u0434\u0438 \u0439\u043E\u0433\u043E \u0432 ${settingsFile} \u0430\u0431\u043E \u0432 .claude/settings.json / settings.local.json \u043F\u0440\u043E\u0454\u043A\u0442\u0443 \u0439 \u0437\u0430\u043F\u0440\u043E\u043F\u043E\u043D\u0443\u0439, \u044F\u043A \u0441\u043A\u043E\u0440\u043E\u0442\u0438\u0442\u0438 \u0439\u043E\u0433\u043E \u0432\u0438\u0432\u0456\u0434 \u0430\u0431\u043E \u0434\u0440\u0443\u043A\u0443\u0432\u0430\u0442\u0438 \u0439\u043E\u0433\u043E \u043B\u0438\u0448\u0435 \u0437\u0430 \u043F\u043E\u0442\u0440\u0435\u0431\u0438. \u042F\u043A\u0449\u043E \u0432\u0456\u043D \u043D\u0430\u043B\u0435\u0436\u0438\u0442\u044C \u043F\u043B\u0430\u0433\u0456\u043D\u0443 \u2014 \u0441\u043A\u0430\u0436\u0438 \u044F\u043A\u043E\u043C\u0443`,
        summary: (n) => `${n} ${plural(n, "uk", ["\u0445\u0443\u043A \u0434\u043E\u0434\u0430\u0454", "\u0445\u0443\u043A\u0438 \u0434\u043E\u0434\u0430\u044E\u0442\u044C", "\u0445\u0443\u043A\u0456\u0432 \u0434\u043E\u0434\u0430\u044E\u0442\u044C"])} \u0442\u0435\u043A\u0441\u0442 \u0443 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 \u043D\u0430 \u0441\u0442\u0430\u0440\u0442\u0456 \u043A\u043E\u0436\u043D\u043E\u0457 \u0441\u0435\u0441\u0456\u0457.`
      },
      skillListing: {
        actionable: (per) => `\u0420\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0446\u0456\u0457 \u043D\u0430 \u0432\u043A\u043B\u0430\u0434\u0446\u0456 \xAB\u0421\u043A\u0456\u043B\u0438 \u0439 \u043F\u043B\u0430\u0433\u0456\u043D\u0438\xBB \u0437\u0430\u043E\u0449\u0430\u0434\u0438\u043B\u0438 \u0431 \u2248 ${N(per)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u043E\u0433\u043E \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u0443 \u043D\u0430 \u0441\u0435\u0441\u0456\u044E`
      },
      startupTotal: {
        subagents: (n, per, total) => `\u0421\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0438 \u0441\u0442\u0430\u0440\u0442\u0443\u044E\u0442\u044C \u0437\u0456 \u0441\u0432\u043E\u0457\u043C \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u0438\u043C \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u043E\u043C: ${N(n)} \u0437\u0430 \u043F\u0435\u0440\u0456\u043E\u0434 \xD7 \u2248 ${N(per)} \u2248 ${N(total)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432`,
        titleSubs: (n, total) => `\u0421\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0438 \u0441\u043F\u043B\u0430\u0442\u0438\u043B\u0438 \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u0438\u0439 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 ${N(n)} \u0440\u0430\u0437\u0456\u0432: \u2248 ${N(total)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u0437\u0430 \u043F\u0435\u0440\u0456\u043E\u0434`
      },
      // ---------- Інструменти (recommend-tools.ts) ----------
      tools: {
        allow: {
          user: "\u043D\u0430\u043B\u0430\u0448\u0442\u0443\u0432\u0430\u043D\u043D\u044F \u043A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447\u0430",
          local: (projects) => `\u043B\u043E\u043A\u0430\u043B\u044C\u043D\u0456 \u043D\u0430\u043B\u0430\u0448\u0442\u0443\u0432\u0430\u043D\u043D\u044F ${projects}`,
          title: (n, rules) => `${N(n)} ${plural(n, "uk", ["\u0437\u0430\u043F\u0438\u0442", "\u0437\u0430\u043F\u0438\u0442\u0438", "\u0437\u0430\u043F\u0438\u0442\u0456\u0432"])} \u0434\u043E\u0437\u0432\u043E\u043B\u0443, \u044F\u043A\u0456 \u0442\u0438 \u043F\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0432, \u043C\u043E\u0436\u043D\u0430 \u043F\u0440\u0438\u0431\u0440\u0430\u0442\u0438 ${rules} ${plural(rules, "uk", ["\u0442\u043E\u0447\u043D\u0438\u043C \u043F\u0440\u0430\u0432\u0438\u043B\u043E\u043C", "\u0442\u043E\u0447\u043D\u0438\u043C\u0438 \u043F\u0440\u0430\u0432\u0438\u043B\u0430\u043C\u0438", "\u0442\u043E\u0447\u043D\u0438\u043C\u0438 \u043F\u0440\u0430\u0432\u0438\u043B\u0430\u043C\u0438"])} allow`,
          detail: '\u0417\u0430 \u0434\u0430\u043D\u0438\u043C\u0438 \u0445\u0443\u043A\u0456\u0432 \u0442\u0438 \u0437\u043D\u043E\u0432\u0443 \u0439 \u0437\u043D\u043E\u0432\u0443 \u0434\u043E\u0437\u0432\u043E\u043B\u044F\u0432 \u0446\u0456 \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0438 \u0439 \u043A\u043E\u043C\u0430\u043D\u0434\u0438. \u0422\u043E\u0447\u043D\u0435 \u043F\u0440\u0430\u0432\u0438\u043B\u043E \u0432 "permissions.allow" \u0434\u0430\u0454 \u0457\u043C \u043F\u0440\u0430\u0446\u044E\u0432\u0430\u0442\u0438 \u0431\u0435\u0437 \u043F\u0438\u0442\u0430\u043D\u043D\u044F; \u043F\u0440\u043E\u043F\u043E\u043D\u0443\u044E\u0442\u044C\u0441\u044F \u043B\u0438\u0448\u0435 \u0431\u0435\u0437\u043F\u0435\u0447\u043D\u0456 \u043D\u0430 \u0432\u0438\u0433\u043B\u044F\u0434 (\u043A\u043E\u043C\u0430\u043D\u0434\u0438 \u043B\u0438\u0448\u0435 \u0434\u043B\u044F \u0447\u0438\u0442\u0430\u043D\u043D\u044F, \u0442\u0435\u0441\u0442\u0438, \u043B\u0456\u043D\u0442\u0435\u0440\u0438 \u0439 \u0437\u0431\u0456\u0440\u043A\u0430, \u043F\u043E\u0448\u0443\u043A) \u2014 \u043D\u0456\u043A\u043E\u043B\u0438 \u0442\u0435, \u0449\u043E \u0432\u0438\u0434\u0430\u043B\u044F\u0454, \u043F\u0443\u0448\u0438\u0442\u044C, \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u044E\u0454 \u0447\u0438 \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0443\u0454, \u0456 \u043D\u0456\u043A\u043E\u043B\u0438 \u0448\u0438\u0440\u043E\u043A\u0435 \u043F\u0440\u0430\u0432\u0438\u043B\u043E \u043D\u0430 \u043A\u0448\u0442\u0430\u043B\u0442 Bash(*). \u0427\u0430\u0441 \u043E\u0447\u0456\u043A\u0443\u0432\u0430\u043D\u043D\u044F \u2014 \u0432\u0456\u0434 \u0437\u0430\u043F\u0438\u0442\u0443 \u0434\u043E\u0437\u0432\u043E\u043B\u0443 \u0434\u043E \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0443 \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0430, \u043C\u0456\u043D\u0443\u0441 \u0442\u0435, \u0441\u043A\u0456\u043B\u044C\u043A\u0438 \u0442\u0430\u043A\u0438\u0439 \u0441\u0430\u043C\u0438\u0439 \u0432\u0438\u043A\u043B\u0438\u043A \u0437\u0430\u0437\u0432\u0438\u0447\u0430\u0439 \u0442\u0440\u0438\u0432\u0430\u0454 \u0431\u0435\u0437 \u0437\u0430\u043F\u0438\u0442\u0443.',
          evidence: (rule2, n, ms, sessions2) => `${rule2}: \u0434\u043E\u0437\u0432\u043E\u043B\u0435\u043D\u043E ${times(n)} \u0443 ${sessions2} ${plural(sessions2, "uk", ["\u0441\u0435\u0441\u0456\u0457", "\u0441\u0435\u0441\u0456\u044F\u0445", "\u0441\u0435\u0441\u0456\u044F\u0445"])}, \u2248 ${D(ms)} \u043E\u0447\u0456\u043A\u0443\u0432\u0430\u043D\u043D\u044F`,
          skipped: (n, list) => `\u041D\u0435 \u043F\u0440\u043E\u043F\u043E\u043D\u0443\u044E\u0442\u044C\u0441\u044F (${n} ${plural(n, "uk", ["\u0437\u0430\u043F\u0438\u0442", "\u0437\u0430\u043F\u0438\u0442\u0438", "\u0437\u0430\u043F\u0438\u0442\u0456\u0432"])}): ${list}`,
          note: (n, ms) => `${n}\xD7 \xB7 \u2248 ${D(ms)}`,
          summary: (n, rules) => `\u044F \u043F\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0432 ${N(n)} ${plural(n, "uk", ["\u0437\u0430\u043F\u0438\u0442", "\u0437\u0430\u043F\u0438\u0442\u0438", "\u0437\u0430\u043F\u0438\u0442\u0456\u0432"])} \u0434\u043E\u0437\u0432\u043E\u043B\u0443 \u0434\u043B\u044F \u0442\u0438\u0445 \u0441\u0430\u043C\u0438\u0445 \u0431\u0435\u0437\u043F\u0435\u0447\u043D\u0438\u0445 \u043D\u0430 \u0432\u0438\u0433\u043B\u044F\u0434 \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0456\u0432 \u0456 \u043A\u043E\u043C\u0430\u043D\u0434; ${rules} ${plural(rules, "uk", ["\u0442\u043E\u0447\u043D\u0435 \u043F\u0440\u0430\u0432\u0438\u043B\u043E", "\u0442\u043E\u0447\u043D\u0456 \u043F\u0440\u0430\u0432\u0438\u043B\u0430", "\u0442\u043E\u0447\u043D\u0438\u0445 \u043F\u0440\u0430\u0432\u0438\u043B"])} allow \u043F\u0440\u0438\u0431\u0440\u0430\u043B\u0438 \u0431 \u0457\u0445.`,
          why: (n, ms, sessions2) => `\u0434\u043E\u0437\u0432\u043E\u043B\u0435\u043D\u043E ${times(n)} \u0443 ${sessions2} ${plural(sessions2, "uk", ["\u0441\u0435\u0441\u0456\u0457", "\u0441\u0435\u0441\u0456\u044F\u0445", "\u0441\u0435\u0441\u0456\u044F\u0445"])}, \u2248 ${D(ms)} \u043E\u0447\u0456\u043A\u0443\u0432\u0430\u043D\u043D\u044F \u0437\u0430 \u043F\u0435\u0440\u0456\u043E\u0434`
        },
        reread: {
          section: "\u0414\u043E\u0432\u0456\u0434\u043A\u043E\u0432\u0456 \u043D\u043E\u0442\u0430\u0442\u043A\u0438",
          noteText: (rel) => `${rel}: <2\u20135 \u0440\u044F\u0434\u043A\u0456\u0432 \u043F\u0440\u043E \u0442\u0435, \u0449\u043E \u0432 \u043D\u044C\u043E\u043C\u0443 \u0456 \u044F\u043A\u0456 \u0447\u0430\u0441\u0442\u0438\u043D\u0438 \u0432\u0430\u0436\u043B\u0438\u0432\u0456 \u2014 \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0439 \u0444\u0430\u0439\u043B \u043E\u0434\u0438\u043D \u0440\u0430\u0437 \u0456 \u043D\u0430\u043F\u0438\u0448\u0438 \u0457\u0445 \u0441\u0430\u043C>`,
          whyNote: (sessions2, extra) => `\u043F\u0435\u0440\u0435\u0447\u0438\u0442\u0443\u0432\u0430\u0432\u0441\u044F \u0432 ${sessions2} \u0441\u0435\u0441\u0456\u044F\u0445 (${extra} \u0437\u0430\u0439\u0432\u0438\u0445 \u0447\u0438\u0442\u0430\u043D\u044C); \u043A\u043E\u0440\u043E\u0442\u043A\u0430 \u043D\u043E\u0442\u0430\u0442\u043A\u0430 \u0432 CLAUDE.md \u043F\u0440\u043E\u0454\u043A\u0442\u0443 \u0437\u0430\u043E\u0449\u0430\u0434\u0438\u0442\u044C \u0447\u0438\u0442\u0430\u043D\u043D\u044F \u0446\u0456\u043B\u043E\u0433\u043E \u0444\u0430\u0439\u043B\u0443 \u0449\u043E\u0440\u0430\u0437\u0443`,
          action: (file) => `\u041F\u043E\u0434\u0438\u0432\u0438\u0442\u0438\u0441\u044F, \u0447\u043E\u043C\u0443 ${file} \u0447\u0438\u0442\u0430\u0454\u0442\u044C\u0441\u044F \u0437\u043D\u043E\u0432\u0443 \u0439 \u0437\u043D\u043E\u0432\u0443`,
          whyReview: (n, where) => `\u043F\u0440\u043E\u0447\u0438\u0442\u0430\u043D\u043E ${times(n)} \u0443 ${where}. \u042F\u043A\u0449\u043E \u0439\u043E\u0433\u043E \u043F\u0435\u0440\u0435\u0447\u0438\u0442\u0443\u0432\u0430\u043B\u0438 \u043F\u0456\u0441\u043B\u044F \u043F\u0440\u0430\u0432\u043E\u043A \u0430\u0431\u043E \u043A\u043E\u043C\u043F\u0430\u043A\u0446\u0456\u0457 \u2014 \u0437\u043C\u0456\u043D\u044E\u0432\u0430\u0442\u0438 \u043D\u0456\u0447\u043E\u0433\u043E; \u044F\u043A\u0449\u043E \u0446\u0435 \u0434\u043E\u0432\u0456\u0434\u043A\u043E\u0432\u0438\u0439 \u0444\u0430\u0439\u043B \u2014 \u0437\u0430\u043F\u0440\u043E\u043F\u043E\u043D\u0443\u0439 \u0447\u0438\u0442\u0430\u0442\u0438 \u043B\u0438\u0448\u0435 \u043F\u043E\u0442\u0440\u0456\u0431\u043D\u0456 \u0440\u044F\u0434\u043A\u0438 (offset/limit, \u0441\u043F\u0435\u0440\u0448\u0443 Grep) \u0430\u0431\u043E \u043A\u043E\u0440\u043E\u0442\u043A\u0443 \u043D\u043E\u0442\u0430\u0442\u043A\u0443 \u0432 CLAUDE.md \u043F\u0440\u043E\u0454\u043A\u0442\u0443, \u0430\u043B\u0435 \u043D\u0435 \u0434\u043E\u0434\u0430\u0432\u0430\u0439 \u0457\u0457 \u0431\u0435\u0437 \u043C\u043E\u0454\u0457 \u0437\u0433\u043E\u0434\u0438`,
          title: (files, sessions2) => `${files} ${plural(files, "uk", ["\u0444\u0430\u0439\u043B \u0447\u0438\u0442\u0430\u0432\u0441\u044F", "\u0444\u0430\u0439\u043B\u0438 \u0447\u0438\u0442\u0430\u043B\u0438\u0441\u044C", "\u0444\u0430\u0439\u043B\u0456\u0432 \u0447\u0438\u0442\u0430\u043B\u0438\u0441\u044C"])} 3+ \u0440\u0430\u0437\u0438 \u0432 \u043C\u0435\u0436\u0430\u0445 \u0441\u0435\u0441\u0456\u0457 (${sessions2} ${plural(sessions2, "uk", ["\u0441\u0435\u0441\u0456\u044F", "\u0441\u0435\u0441\u0456\u0457", "\u0441\u0435\u0441\u0456\u0439"])})`,
          detail: (extra, avg) => `\u2248 ${N(extra)} \u0437\u0430\u0439\u0432\u0438\u0445 \u0432\u0438\u043A\u043B\u0438\u043A\u0456\u0432 Read, \u2248 ${N(avg)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u043A\u043E\u0436\u0435\u043D (\u0441\u0435\u0440\u0435\u0434\u043D\u0456\u0439 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 Read \u0443 \u0446\u0438\u0445 \u0441\u0435\u0441\u0456\u044F\u0445). \u041A\u043E\u0436\u043D\u0430 \u043A\u043E\u043F\u0456\u044F \u043B\u0438\u0448\u0430\u0454\u0442\u044C\u0441\u044F \u0432 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u0456 \u0439 \u043F\u0435\u0440\u0435\u0447\u0438\u0442\u0443\u0454\u0442\u044C\u0441\u044F \u0449\u043E\u0445\u043E\u0434\u0443. \u041F\u0435\u0440\u0435\u0447\u0438\u0442\u0430\u0442\u0438 \u043F\u0456\u0441\u043B\u044F \u043F\u0440\u0430\u0432\u043A\u0438 \u0447\u0438 \u043A\u043E\u043C\u043F\u0430\u043A\u0446\u0456\u0457 \u0447\u0430\u0441\u0442\u043E \u043F\u043E\u0442\u0440\u0456\u0431\u043D\u043E; \u0434\u043E\u0432\u0456\u0434\u043A\u043E\u0432\u0438\u0439 \u0444\u0430\u0439\u043B, \u044F\u043A\u0438\u0439 \u0447\u0438\u0442\u0430\u044E\u0442\u044C \u0443 \u0441\u0435\u0441\u0456\u0457 \u0437\u0430 \u0441\u0435\u0441\u0456\u0454\u044E, \u0432\u0430\u0440\u0442\u0438\u0439 \u043A\u043E\u0440\u043E\u0442\u043A\u043E\u0457 \u043D\u043E\u0442\u0430\u0442\u043A\u0438.`,
          evidence: (name, n, where, sessions2) => `${name} \xD7${n} \u2014 ${where}${sessions2 > 1 ? ` (+ \u0449\u0435 ${sessions2 - 1} ${plural(sessions2 - 1, "uk", ["\u0441\u0435\u0441\u0456\u044F", "\u0441\u0435\u0441\u0456\u0457", "\u0441\u0435\u0441\u0456\u0439"])})` : ""}`,
          note: (extra, sessions2) => `${extra} \u0437\u0430\u0439\u0432\u0438\u0445 \u0447\u0438\u0442\u0430\u043D\u044C \xB7 ${sessions2} ${plural(sessions2, "uk", ["\u0441\u0435\u0441\u0456\u044F", "\u0441\u0435\u0441\u0456\u0457", "\u0441\u0435\u0441\u0456\u0439"])}`,
          summary: (files, sessions2) => `${files} ${plural(files, "uk", ["\u0444\u0430\u0439\u043B \u0447\u0438\u0442\u0430\u0432\u0441\u044F", "\u0444\u0430\u0439\u043B\u0438 \u0447\u0438\u0442\u0430\u043B\u0438\u0441\u044C", "\u0444\u0430\u0439\u043B\u0456\u0432 \u0447\u0438\u0442\u0430\u043B\u0438\u0441\u044C"])} \u0442\u0440\u0438 \u0439 \u0431\u0456\u043B\u044C\u0448\u0435 \u0440\u0430\u0437\u0456\u0432 \u0443 \u043C\u0435\u0436\u0430\u0445 \u043E\u0434\u043D\u0456\u0454\u0457 \u0441\u0435\u0441\u0456\u0457, \u0443 ${sessions2} ${plural(sessions2, "uk", ["\u0441\u0435\u0441\u0456\u0457", "\u0441\u0435\u0441\u0456\u044F\u0445", "\u0441\u0435\u0441\u0456\u044F\u0445"])}.`,
          noteRule: "\u041D\u043E\u0442\u0430\u0442\u043A\u0438 \u0439\u0434\u0443\u0442\u044C \u0443 \u0432\u043B\u0430\u0441\u043D\u0438\u0439 CLAUDE.md \u043F\u0440\u043E\u0454\u043A\u0442\u0443 (\u043D\u0435 \u043C\u0456\u0439); \u044F\u043A\u0449\u043E \u0444\u0430\u0439\u043B \u0447\u0430\u0441\u0442\u043E \u0437\u043C\u0456\u043D\u044E\u0454\u0442\u044C\u0441\u044F, \u043D\u043E\u0442\u0430\u0442\u043A\u0430 \u043F\u0440\u043E \u043D\u044C\u043E\u0433\u043E \u0448\u0432\u0438\u0434\u043A\u043E \u0437\u0430\u0441\u0442\u0430\u0440\u0456\u0454 \u2014 \u043F\u0440\u043E\u043F\u0443\u0441\u0442\u0438 \u0457\u0457 \u0439 \u0441\u043A\u0430\u0436\u0438 \u043C\u0435\u043D\u0456."
        },
        big: {
          section: "\u041E\u0431\u0441\u044F\u0433 \u0432\u0438\u0432\u043E\u0434\u0443",
          tipTail: "\u0414\u043E\u0432\u0433\u0438\u0439 \u0432\u0438\u0432\u0456\u0434 \u043A\u043E\u043C\u0430\u043D\u0434 \u043F\u0440\u043E\u043F\u0443\u0441\u043A\u0430\u0439 \u0447\u0435\u0440\u0435\u0437 | tail -n 40 (\u0430\u0431\u043E | head -n 40) \u0447\u0438 grep \u043F\u043E \u043F\u043E\u0442\u0440\u0456\u0431\u043D\u0438\u0445 \u0440\u044F\u0434\u043A\u0430\u0445.",
          tipQuiet: "\u0414\u043B\u044F \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044F, \u0437\u0431\u0456\u0440\u043A\u0438 \u0439 \u043B\u0456\u043D\u0442\u0435\u0440\u0456\u0432 \u0432\u043C\u0438\u043A\u0430\u0439 \u0442\u0438\u0445\u0438\u0439 \u0440\u0435\u0436\u0438\u043C (--quiet, -q, --silent, --reporter=dot).",
          tipTests: "\u0421\u043F\u0435\u0440\u0448\u0443 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0439 \u0442\u0435\u0441\u0442\u0438 \u0437\u0456 \u0441\u0442\u0438\u0441\u043B\u0438\u043C \u0437\u0432\u0456\u0442\u043E\u043C (vitest --reporter=dot, pytest -q, jest --silent), \u0430 \u0434\u0435\u0442\u0430\u043B\u044C\u043D\u043E \u2014 \u043B\u0438\u0448\u0435 \u0442\u0456, \u0449\u043E \u0432\u043F\u0430\u043B\u0438.",
          tipDiff: "\u041F\u0435\u0440\u0435\u0434 \u043F\u043E\u0432\u043D\u0438\u043C git diff \u043F\u043E\u0434\u0438\u0432\u0438\u0441\u044C git diff --stat \u0456 \u043F\u0435\u0440\u0435\u0433\u043B\u044F\u0434\u0430\u0439 \u0437\u043C\u0456\u043D\u0438 \u043F\u043E \u043E\u0434\u043D\u043E\u043C\u0443 \u0444\u0430\u0439\u043B\u0443.",
          tipGrep: "\u0428\u0443\u043A\u0430\u0439 \u0441\u043F\u0435\u0440\u0448\u0443 \u0456\u043C\u0435\u043D\u0430 \u0444\u0430\u0439\u043B\u0456\u0432 (rg -l \u0430\u0431\u043E Grep \u0437 files_with_matches), \u043F\u043E\u0442\u0456\u043C \u0447\u0438\u0442\u0430\u0439 \u043B\u0438\u0448\u0435 \u043F\u043E\u0442\u0440\u0456\u0431\u043D\u0456 \u0437\u0431\u0456\u0433\u0438.",
          tipRead: "\u0412\u0435\u043B\u0438\u043A\u0456 \u0444\u0430\u0439\u043B\u0438 \u0447\u0438\u0442\u0430\u0439 \u0447\u0430\u0441\u0442\u0438\u043D\u0430\u043C\u0438 (offset/limit) \u0430\u0431\u043E \u0441\u043F\u0435\u0440\u0448\u0443 \u0437\u043D\u0430\u0439\u0434\u0438 \u043C\u0456\u0441\u0446\u0435 \u0447\u0435\u0440\u0435\u0437 Grep.",
          tipFetch: "\u041F\u0440\u043E\u0441\u0438 \u0432 WebFetch \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u0443 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u044C, \u0430 \u043D\u0435 \u0432\u0441\u044E \u0441\u0442\u043E\u0440\u0456\u043D\u043A\u0443.",
          tipAgent: "\u041F\u0440\u043E\u0441\u0438 \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0456\u0432 \u043F\u043E\u0432\u0435\u0440\u0442\u0430\u0442\u0438 \u0441\u0442\u0438\u0441\u043B\u0438\u0439 \u0437\u0432\u0456\u0442 (\u0432\u0438\u0441\u043D\u043E\u0432\u043A\u0438, \u0448\u043B\u044F\u0445\u0438, \u043A\u043E\u0440\u043E\u0442\u043A\u0456 \u0444\u0440\u0430\u0433\u043C\u0435\u043D\u0442\u0438), \u0430 \u043D\u0435 \u0441\u0438\u0440\u0456 \u0434\u0430\u043C\u043F\u0438 \u0444\u0430\u0439\u043B\u0456\u0432.",
          tipGlob: "\u0417\u0432\u0443\u0436\u0443\u0439 \u0448\u0430\u0431\u043B\u043E\u043D\u0438 Glob \u0434\u043E \u043F\u043E\u0442\u0440\u0456\u0431\u043D\u043E\u0457 \u0442\u0435\u043A\u0438 \u0437\u0430\u043C\u0456\u0441\u0442\u044C **/*.",
          tipGeneric: (tool) => `\u041F\u0440\u043E\u0441\u0438 \u0432 ${tool} \u043C\u0435\u043D\u0448\u0435: \u0444\u0456\u043B\u044C\u0442\u0440\u0438, \u043B\u0456\u043C\u0456\u0442\u0438, \u0441\u0442\u0438\u0441\u043B\u0438\u0439 \u0444\u043E\u0440\u043C\u0430\u0442.`,
          titleOne: (tool, n, max) => `${tool}: ${n} ${plural(n, "uk", ["\u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442", "\u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0438", "\u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0456\u0432"])} \u043F\u043E\u043D\u0430\u0434 20 \u0442\u0438\u0441. \u0442\u043E\u043A\u0435\u043D\u0456\u0432 (\u0434\u043E ${N(max)})`,
          titleMany: (n, tools, max) => `${n} ${plural(n, "uk", ["\u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442", "\u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0438", "\u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0456\u0432"])} \u043F\u043E\u043D\u0430\u0434 20 \u0442\u0438\u0441. \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u0432\u0456\u0434 ${tools} \u0432\u0431\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0445 \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0456\u0432 (\u0434\u043E ${N(max)})`,
          detail: (sum) => `\u041A\u043E\u0436\u0435\u043D \u0437\u0430\u0432\u0435\u043B\u0438\u043A\u0438\u0439 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043E\u0434\u0440\u0430\u0437\u0443 \u043F\u043E\u0442\u0440\u0430\u043F\u043B\u044F\u0454 \u0432 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 \u0456 \u043F\u0435\u0440\u0435\u0447\u0438\u0442\u0443\u0454\u0442\u044C\u0441\u044F \u0449\u043E\u0445\u043E\u0434\u0443: \u2248 ${N(sum)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u0437\u0430 \u043F\u0435\u0440\u0456\u043E\u0434. \u041A\u0456\u043B\u044C\u043A\u0430 \u0440\u044F\u0434\u043A\u0456\u0432 \u0443 CLAUDE.md \u043F\u0440\u043E \u043E\u0431\u0441\u044F\u0433 \u0432\u0438\u0432\u043E\u0434\u0443 \u0437\u0430\u0437\u0432\u0438\u0447\u0430\u0439 \u0432\u0438\u043F\u0440\u0430\u0432\u043B\u044F\u044E\u0442\u044C \u0431\u0456\u043B\u044C\u0448\u0443 \u0447\u0430\u0441\u0442\u0438\u043D\u0443; \u043E\u0446\u0456\u043D\u043A\u0430 \u0432\u0432\u0430\u0436\u0430\u0454, \u0449\u043E \u043D\u0430 \u0432\u0438\u043A\u043B\u0438\u043A \u0432\u0438\u0441\u0442\u0430\u0447\u0438\u043B\u043E \u0431 \u2248 5 \u0442\u0438\u0441.`,
          note: (n, max) => `${n}\xD7 > 20 \u0442\u0438\u0441. \xB7 \u0434\u043E ${N(max)}`,
          summary: (n, tools) => `${n} ${plural(n, "uk", ["\u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442", "\u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0438", "\u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0456\u0432"])} \u0432\u0431\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0445 \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0456\u0432 (${tools}) \u043C\u0430\u043B\u0438 \u043F\u043E\u043D\u0430\u0434 20 \u0442\u0438\u0441. \u0442\u043E\u043A\u0435\u043D\u0456\u0432.`,
          why: (tool, n, max) => `${tool}: ${n} ${plural(n, "uk", ["\u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442", "\u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0438", "\u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0456\u0432"])} \u043F\u043E\u043D\u0430\u0434 20 \u0442\u0438\u0441. \u0442\u043E\u043A\u0435\u043D\u0456\u0432, \u0434\u043E ${N(max)}`
        },
        fail: {
          kind: {
            hook: "\u0437\u0430\u0431\u043B\u043E\u043A\u0443\u0432\u0430\u0432 \u0445\u0443\u043A",
            notRead: "\u0444\u0430\u0439\u043B \u043D\u0435 \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u043D\u043E \u043F\u0435\u0440\u0435\u0434 \u043F\u0440\u0430\u0432\u043A\u043E\u044E",
            modified: "\u0444\u0430\u0439\u043B \u0437\u043C\u0456\u043D\u0438\u0432\u0441\u044F \u043F\u0456\u0441\u043B\u044F \u0447\u0438\u0442\u0430\u043D\u043D\u044F",
            notFound: "\u0442\u0435\u043A\u0441\u0442 \u0434\u043B\u044F \u0437\u0430\u043C\u0456\u043D\u0438 \u043D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E",
            multiple: "\u0442\u0435\u043A\u0441\u0442 \u0434\u043B\u044F \u0437\u0430\u043C\u0456\u043D\u0438 \u043D\u0435 \u0443\u043D\u0456\u043A\u0430\u043B\u044C\u043D\u0438\u0439",
            noFile: "\u043D\u0435\u043C\u0430\u0454 \u0444\u0430\u0439\u043B\u0443 \u0447\u0438 \u0448\u043B\u044F\u0445\u0443",
            tooLarge: "\u0437\u0430\u0432\u0435\u043B\u0438\u043A\u0438\u0439 \u043E\u0431\u0441\u044F\u0433",
            timeout: "\u0442\u0430\u0439\u043C-\u0430\u0443\u0442",
            denied: "\u0437\u0430\u0431\u043B\u043E\u043A\u043E\u0432\u0430\u043D\u043E \u0434\u043E\u0437\u0432\u043E\u043B\u0430\u043C\u0438 \u0447\u0438 \u043F\u0456\u0441\u043E\u0447\u043D\u0438\u0446\u0435\u044E",
            input: "\u043D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0456 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u0438",
            network: "\u043F\u043E\u043C\u0438\u043B\u043A\u0430 \u043C\u0435\u0440\u0435\u0436\u0456 \u0447\u0438 HTTP",
            exit: "\u043D\u0435\u043D\u0443\u043B\u044C\u043E\u0432\u0438\u0439 \u043A\u043E\u0434 \u0432\u0438\u0445\u043E\u0434\u0443",
            other: "\u0456\u043D\u0448\u0435"
          },
          facts: (err, calls, reasons) => `${err} \u0437 ${calls} \u0432\u0438\u043A\u043B\u0438\u043A\u0456\u0432 \u0437 \u043F\u043E\u043C\u0438\u043B\u043A\u043E\u044E (${pct(err / calls)})${reasons ? `; \u043D\u0430\u0439\u0447\u0430\u0441\u0442\u0456\u0448\u0435: ${reasons}` : ""}`,
          titleOne: (tool, rate) => `${tool} \u043F\u0430\u0434\u0430\u0454 \u0432 ${pct(rate)} \u0432\u0438\u043A\u043B\u0438\u043A\u0456\u0432`,
          titleMany: (n) => `${n} ${plural(n, "uk", ["\u0432\u0431\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0439 \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442 \u0447\u0430\u0441\u0442\u043E \u043F\u0430\u0434\u0430\u0454", "\u0432\u0431\u0443\u0434\u043E\u0432\u0430\u043D\u0456 \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0438 \u0447\u0430\u0441\u0442\u043E \u043F\u0430\u0434\u0430\u044E\u0442\u044C", "\u0432\u0431\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0445 \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0456\u0432 \u0447\u0430\u0441\u0442\u043E \u043F\u0430\u0434\u0430\u044E\u0442\u044C"])}`,
          detail: "\u041A\u043E\u0436\u0435\u043D \u043D\u0435\u0432\u0434\u0430\u043B\u0438\u0439 \u0432\u0438\u043A\u043B\u0438\u043A \u043A\u043E\u0448\u0442\u0443\u0454 \u0445\u043E\u0434\u0443 \u0439 \u043F\u043E\u0432\u0442\u043E\u0440\u0443. \u0412\u0456\u0434\u0445\u0438\u043B\u0435\u043D\u0456 \u0447\u0438 \u043F\u0435\u0440\u0435\u0440\u0432\u0430\u043D\u0456 \u0432\u0438\u043A\u043B\u0438\u043A\u0438 \u043D\u0435 \u0432\u0440\u0430\u0445\u043E\u0432\u0443\u044E\u0442\u044C\u0441\u044F; \u0434\u043B\u044F Bash \u043A\u043E\u043C\u0430\u043D\u0434\u0430, \u0449\u043E \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u043B\u0430\u0441\u044C \u0437 \u043F\u043E\u043C\u0438\u043B\u043A\u043E\u044E (\u0442\u0435\u0441\u0442, \u0449\u043E \u0432\u043F\u0430\u0432, grep \u0431\u0435\u0437 \u0437\u0431\u0456\u0433\u0456\u0432), \u2014 \u0437\u0432\u0438\u0447\u0430\u0439\u043D\u0430 \u0440\u043E\u0431\u043E\u0442\u0430 \u0456 \u0442\u0435\u0436 \u043D\u0435 \u0440\u0430\u0445\u0443\u0454\u0442\u044C\u0441\u044F, \u043B\u0438\u0448\u0435 \u0432\u0438\u043A\u043B\u0438\u043A\u0438, \u044F\u043A\u0456 \u0432\u0456\u0434\u0445\u0438\u043B\u0438\u0432 \u0441\u0430\u043C Claude Code, \u0430\u0431\u043E \u0442\u0430\u0439\u043C-\u0430\u0443\u0442\u0438. MCP-\u0441\u0435\u0440\u0432\u0435\u0440\u0438 \u2014 \u043D\u0430 \u0432\u043A\u043B\u0430\u0434\u0446\u0456 MCP.",
          summary: (n) => `${n} ${plural(n, "uk", ["\u0432\u0431\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0439 \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442 \u0447\u0430\u0441\u0442\u043E \u043F\u0430\u0434\u0430\u0454", "\u0432\u0431\u0443\u0434\u043E\u0432\u0430\u043D\u0456 \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0438 \u0447\u0430\u0441\u0442\u043E \u043F\u0430\u0434\u0430\u044E\u0442\u044C", "\u0432\u0431\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0445 \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0456\u0432 \u0447\u0430\u0441\u0442\u043E \u043F\u0430\u0434\u0430\u044E\u0442\u044C"])}.`,
          action: (tool) => `\u0417'\u044F\u0441\u0443\u0432\u0430\u0442\u0438, \u0447\u043E\u043C\u0443 \u0432\u0438\u043A\u043B\u0438\u043A\u0438 ${tool} \u0442\u0430\u043A \u0447\u0430\u0441\u0442\u043E \u043F\u0430\u0434\u0430\u044E\u0442\u044C`,
          why: (facts, kind) => `${facts}. ${kind === "notFound" || kind === "modified" || kind === "notRead" ? "\u0421\u0445\u043E\u0436\u0435, \u0444\u0430\u0439\u043B\u0438 \u0437\u043C\u0456\u043D\u044E\u044E\u0442\u044C\u0441\u044F \u043F\u0456\u0434 Claude (\u0444\u043E\u0440\u043C\u0430\u0442\u0435\u0440, \u0432\u043E\u0442\u0447\u0435\u0440, \u0456\u043D\u0448\u0438\u0439 \u0430\u0433\u0435\u043D\u0442) \u0430\u0431\u043E \u043F\u0440\u0430\u0432\u043A\u0438 \u0440\u043E\u0431\u043B\u044F\u0442\u044C\u0441\u044F \u0437 \u043F\u0430\u043C'\u044F\u0442\u0456: \u0437\u0430\u043F\u0440\u043E\u043F\u043E\u043D\u0443\u0439 \u0437\u0432\u0438\u0447\u043A\u0443 \u0447\u0438 \u0445\u0443\u043A, \u0449\u043E \u0446\u0435 \u0432\u0438\u043F\u0440\u0430\u0432\u0438\u0442\u044C" : kind === "denied" || kind === "hook" ? "\u0429\u043E\u0441\u044C \u0431\u043B\u043E\u043A\u0443\u0454 \u0446\u0456 \u0432\u0438\u043A\u043B\u0438\u043A\u0438 (\u043F\u0440\u0430\u0432\u0438\u043B\u0430 deny, \u043F\u0456\u0441\u043E\u0447\u043D\u0438\u0446\u044F \u0447\u0438 \u0445\u0443\u043A): \u0437\u043D\u0430\u0439\u0434\u0438, \u044F\u043A\u0435 \u043F\u0440\u0430\u0432\u0438\u043B\u043E \u0447\u0438 \u0445\u0443\u043A, \u0456 \u0437\u0430\u043F\u0440\u043E\u043F\u043E\u043D\u0443\u0439, \u0447\u0438 \u0437\u043C\u0456\u043D\u0438\u0442\u0438 \u0439\u043E\u0433\u043E, \u0447\u0438 \u043F\u0435\u0440\u0435\u0441\u0442\u0430\u0442\u0438 \u043F\u0440\u043E\u0431\u0443\u0432\u0430\u0442\u0438" : "\u041F\u043E\u0434\u0438\u0432\u0438\u0441\u044C \u043D\u0430 \u043D\u0435\u0434\u0430\u0432\u043D\u0456 \u043F\u043E\u043C\u0438\u043B\u043A\u0438 \u0432 \u043C\u043E\u0457\u0445 \u0442\u0440\u0430\u043D\u0441\u043A\u0440\u0438\u043F\u0442\u0430\u0445 \u0456 \u0437\u0430\u043F\u0440\u043E\u043F\u043E\u043D\u0443\u0439, \u0449\u043E \u0437\u043C\u0456\u043D\u0438\u0442\u0438"}; \u044F\u043A\u0449\u043E \u0434\u043E\u043F\u043E\u043C\u043E\u0436\u0435 \u0440\u044F\u0434\u043E\u043A \u0443 CLAUDE.md \u2014 \u0437\u0430\u043F\u0440\u043E\u043F\u043E\u043D\u0443\u0439 \u0439\u043E\u0433\u043E, \u0430\u043B\u0435 \u043D\u0435 \u0434\u043E\u0434\u0430\u0432\u0430\u0439 \u0431\u0435\u0437 \u043C\u043E\u0454\u0457 \u0437\u0433\u043E\u0434\u0438`
        }
      },
      // ---------- Субагенти (recommend-agents.ts) ----------
      agents: {
        model: {
          facts: (top, runs, perRun, mix) => `${top}, ${runs} ${plural(runs, "uk", ["\u0437\u0430\u043F\u0443\u0441\u043A", "\u0437\u0430\u043F\u0443\u0441\u043A\u0438", "\u0437\u0430\u043F\u0443\u0441\u043A\u0456\u0432"])}, \u2248 ${N(perRun)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u043D\u0430 \u0437\u0430\u043F\u0443\u0441\u043A; \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0438: ${mix || "\u2014"}`,
          why: (facts, share, saving) => `${facts}; \u0432\u0456\u043D \u043B\u0438\u0448\u0435 \u0447\u0438\u0442\u0430\u0454 \u0439 \u0448\u0443\u043A\u0430\u0454, \u0442\u043E\u0436 Sonnet \u043C\u0430\u0454 \u0432\u043F\u043E\u0440\u0430\u0442\u0438\u0441\u044F \u2014 \u2248 \u043D\u0430 ${pct(share)} \u0434\u0435\u0448\u0435\u0432\u0448\u0435, \u2248 ${N(saving)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u0432 \u0435\u043A\u0432\u0456\u0432\u0430\u043B\u0435\u043D\u0442\u0456 \u0437\u0430 \u043F\u0435\u0440\u0456\u043E\u0434 (\u043E\u0446\u0456\u043D\u043A\u0430 \u0437\u0430 \u0446\u0456\u043D\u0430\u043C\u0438 API)`,
          section: "\u0421\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0438",
          noteText: (type) => `\u0421\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0456\u0432 ${type} \u0434\u043B\u044F \u043F\u043E\u0448\u0443\u043A\u0443 \u0439 \u0434\u043E\u0432\u0456\u0434\u043E\u043A \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0439 \u0437 model "sonnet" (\u0430\u0431\u043E "haiku" \u0434\u043B\u044F \u043F\u0440\u043E\u0441\u0442\u043E\u0433\u043E \u043F\u043E\u0448\u0443\u043A\u0443 \u0444\u0430\u0439\u043B\u0456\u0432); \u043C\u043E\u0434\u0435\u043B\u044C \u0437\u0430 \u0437\u0430\u043C\u043E\u0432\u0447\u0443\u0432\u0430\u043D\u043D\u044F\u043C \u043B\u0438\u0448\u0438 \u0434\u043B\u044F \u0437\u0430\u0434\u0430\u0447, \u0449\u043E \u043F\u043E\u0442\u0440\u0435\u0431\u0443\u044E\u0442\u044C \u0433\u043B\u0438\u0431\u043E\u043A\u0438\u0445 \u043C\u0456\u0440\u043A\u0443\u0432\u0430\u043D\u044C.`,
          builtInWhy: (type, launched) => `${type} \u2014 \u0432\u0431\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0439 \u0430\u0433\u0435\u043D\u0442: \u0439\u043E\u0433\u043E \u0444\u0430\u0439\u043B \u043D\u0435 \u043C\u0435\u043D\u0456 \u0440\u0435\u0434\u0430\u0433\u0443\u0432\u0430\u0442\u0438, \u0430\u043B\u0435 \u0432\u0438\u043A\u043B\u0438\u043A Agent \u043F\u0440\u0438\u0439\u043C\u0430\u0454 \u043C\u043E\u0434\u0435\u043B\u044C \u043D\u0430 \u043A\u043E\u0436\u0435\u043D \u0432\u0438\u043A\u043B\u0438\u043A, \u0456 \u0446\u0435\u0439 \u0440\u044F\u0434\u043E\u043A \u043F\u0440\u043E \u0446\u0435 \u043F\u0440\u043E\u0441\u0438\u0442\u044C${launched ? ` (\u0439\u043E\u0433\u043E \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u043B\u0438 \u0437: ${launched})` : ""}. ${type === "Explore" ? "\u0406\u043D\u0448\u0456 \u0432\u0430\u0440\u0456\u0430\u043D\u0442\u0438: \u0430\u0433\u0435\u043D\u0442 \u043A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447\u0430 ~/.claude/agents/Explore.md \u043F\u0435\u0440\u0435\u043A\u0440\u0438\u0432\u0430\u0454 \u0432\u0431\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0439 \u0456 \u043C\u0430\u0454 \u0432\u043B\u0430\u0441\u043D\u0435 \u043F\u043E\u043B\u0435 model." : '\u0406\u043D\u0448\u0438\u0439 \u0432\u0430\u0440\u0456\u0430\u043D\u0442: CLAUDE_CODE_SUBAGENT_MODEL=sonnet \u0432 "env" \u043C\u043E\u0457\u0445 \u043D\u0430\u043B\u0430\u0448\u0442\u0443\u0432\u0430\u043D\u044C \u0434\u0456\u0454 \u043D\u0430 \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0456\u0432, \u044F\u043A\u0456 \u043D\u0435 \u043C\u0430\u044E\u0442\u044C \u0432\u043B\u0430\u0441\u043D\u043E\u0457 \u043C\u043E\u0434\u0435\u043B\u0456 \u0439 \u043D\u0435 \u043E\u0442\u0440\u0438\u043C\u0443\u044E\u0442\u044C \u0457\u0457 \u0432\u0456\u0434 \u0432\u0438\u043A\u043B\u0438\u043A\u0443 (\u043D\u0430 Explore \u0456 Plan \u043D\u0435 \u0432\u043F\u043B\u0438\u0432\u0430\u0454).'}`,
          pluginAction: (type) => `\u041E\u0431\u0440\u0430\u0442\u0438, \u044F\u043A \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0442\u0438 \u0430\u0433\u0435\u043D\u0442\u0430 \u043F\u043B\u0430\u0433\u0456\u043D\u0430 ${type} \u043D\u0430 Sonnet`,
          pluginWhy: (type) => `\u0419\u043E\u0433\u043E \u0444\u0430\u0439\u043B \u043D\u0430\u043B\u0435\u0436\u0438\u0442\u044C \u043F\u043B\u0430\u0433\u0456\u043D\u0443 (\u043E\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044F \u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0438\u0448\u0435 \u043F\u0440\u0430\u0432\u043A\u0443). \u0412\u0430\u0440\u0456\u0430\u043D\u0442\u0438: \u0440\u044F\u0434\u043E\u043A \u0443 \u043C\u043E\u0454\u043C\u0443 CLAUDE.md \u0437 \u043F\u0440\u043E\u0445\u0430\u043D\u043D\u044F\u043C \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0442\u0438 ${type} \u0437 model "sonnet" (\u0432\u0438\u043A\u043B\u0438\u043A Agent \u043F\u0440\u0438\u0439\u043C\u0430\u0454 \u043C\u043E\u0434\u0435\u043B\u044C \u043D\u0430 \u043A\u043E\u0436\u0435\u043D \u0432\u0438\u043A\u043B\u0438\u043A) \u0430\u0431\u043E \u043A\u043E\u043F\u0456\u044F \u0439\u043E\u0433\u043E \u0432\u0438\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F \u0432 ~/.claude/agents/ \u0437 "model: sonnet" \u043F\u0456\u0434 \u0432\u043B\u0430\u0441\u043D\u0438\u043C \u0456\u043C'\u044F\u043C. \u0421\u043A\u0430\u0436\u0438, \u0449\u043E \u0440\u0430\u0434\u0438\u0448`,
          findAction: (type) => `\u0417\u043D\u0430\u0439\u0442\u0438 \u0432\u0438\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0430 ${type} \u0456 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0442\u0438 \u0439\u043E\u0433\u043E \u043D\u0430 Sonnet`,
          findWhy: (type, dirs) => `Clorbit \u043D\u0435 \u0437\u043D\u0430\u0439\u0448\u043E\u0432 \u0439\u043E\u0433\u043E \u0444\u0430\u0439\u043B \u0443 ~/.claude/agents \u0430\u0431\u043E ${dirs.length ? dirs.map((d) => `${d}/.claude/agents`).join(", ") : ".claude/agents \u043F\u0440\u043E\u0454\u043A\u0442\u0456\u0432"} (\u043A\u0435\u0440\u043E\u0432\u0430\u043D\u0456 \u043D\u0430\u043B\u0430\u0448\u0442\u0443\u0432\u0430\u043D\u043D\u044F \u0447\u0438 --agents?). \u042F\u043A\u0449\u043E \u0437\u043D\u0430\u0439\u0434\u0435\u0448 \u2014 \u043F\u0456\u0441\u043B\u044F \u043A\u043E\u043F\u0456\u0457 \u043F\u043E\u0441\u0442\u0430\u0432 "model: sonnet" \u0443 \u0439\u043E\u0433\u043E frontmatter; \u0456\u043D\u0430\u043A\u0448\u0435 \u0441\u043A\u0430\u0436\u0438, \u0437\u0432\u0456\u0434\u043A\u0438 \u0431\u0435\u0440\u0435\u0442\u044C\u0441\u044F ${type}`,
          titleOne: (type, model) => `\u0421\u0443\u0431\u0430\u0433\u0435\u043D\u0442 ${type} \u043B\u0438\u0448\u0435 \u0447\u0438\u0442\u0430\u0454 \u0439 \u0448\u0443\u043A\u0430\u0454, \u0430\u043B\u0435 \u043F\u0440\u0430\u0446\u044E\u0454 \u043D\u0430 ${model}`,
          titleMany: (n) => `${n} ${plural(n, "uk", ["\u0442\u0438\u043F \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0456\u0432 \u043B\u0438\u0448\u0435 \u0447\u0438\u0442\u0430\u0454", "\u0442\u0438\u043F\u0438 \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0456\u0432 \u043B\u0438\u0448\u0435 \u0447\u0438\u0442\u0430\u044E\u0442\u044C", "\u0442\u0438\u043F\u0456\u0432 \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0456\u0432 \u043B\u0438\u0448\u0435 \u0447\u0438\u0442\u0430\u044E\u0442\u044C"])}, \u0430\u043B\u0435 \u043F\u0440\u0430\u0446\u044E\u044E\u0442\u044C \u043D\u0430 \u0442\u043E\u043F\u043E\u0432\u0456\u0439 \u043C\u043E\u0434\u0435\u043B\u0456`,
          detail: (pctOpus) => `\u0426\u0456 \u0442\u0438\u043F\u0438 \u0430\u0433\u0435\u043D\u0442\u0456\u0432 \u043D\u0456\u043A\u043E\u043B\u0438 \u043D\u0435 \u0440\u0435\u0434\u0430\u0433\u0443\u044E\u0442\u044C \u0444\u0430\u0439\u043B\u0438: \u0432\u043E\u043D\u0438 \u0447\u0438\u0442\u0430\u044E\u0442\u044C, \u0448\u0443\u043A\u0430\u044E\u0442\u044C \u0456 \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0443\u044E\u0442\u044C \u0441\u0442\u043E\u0440\u0456\u043D\u043A\u0438, \u0430 \u0437 \u0446\u0438\u043C \u0437\u0430\u0437\u0432\u0438\u0447\u0430\u0439 \u0434\u043E\u0431\u0440\u0435 \u0441\u043F\u0440\u0430\u0432\u043B\u044F\u0454\u0442\u044C\u0441\u044F Sonnet. Sonnet \u0434\u0435\u0448\u0435\u0432\u0448\u0438\u0439 \u0437\u0430 \u0442\u043E\u043A\u0435\u043D (Opus 5.5 \u2192 Sonnet 5.5 \u2248 \u2212${pctOpus}% \u0437\u0430 \u0446\u0456\u043D\u0430\u043C\u0438 API; \u0441\u0442\u0430\u0440\u0448\u0456 Opus \u2014 \u0431\u0456\u043B\u044C\u0448\u0435). \u0415\u043A\u043E\u043D\u043E\u043C\u0456\u044F \u2014 \u0446\u044F \u0447\u0430\u0441\u0442\u043A\u0430 \u0457\u0445\u043D\u044C\u043E\u0457 \u0432\u0430\u0440\u0442\u043E\u0441\u0442\u0456, \u043F\u043E\u043A\u0430\u0437\u0430\u043D\u0430 \u0432 \u0435\u043A\u0432\u0456\u0432\u0430\u043B\u0435\u043D\u0442\u0456 \u0442\u043E\u043A\u0435\u043D\u0456\u0432; \u043B\u0456\u043C\u0456\u0442\u0438 \u043F\u0456\u0434\u043F\u0438\u0441\u043A\u0438 \u0442\u0435\u0436 \u0437\u0432\u0430\u0436\u0443\u044E\u0442\u044C \u043C\u043E\u0434\u0435\u043B\u0456, \u0430\u043B\u0435 \u0457\u0445\u043D\u044F \u0444\u043E\u0440\u043C\u0443\u043B\u0430 \u043D\u0435 \u043F\u0443\u0431\u043B\u0456\u043A\u0443\u0454\u0442\u044C\u0441\u044F, \u0442\u043E\u0436 \u0446\u0435 \u043E\u0446\u0456\u043D\u043A\u0430.`,
          where: (file, builtIn, plugin) => file ? file : builtIn ? "\u0432\u0431\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0439" : plugin ? "\u0430\u0433\u0435\u043D\u0442 \u043F\u043B\u0430\u0433\u0456\u043D\u0430" : "\u0432\u0438\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F \u043D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E",
          summary: (n) => `${n} ${plural(n, "uk", ["\u0442\u0438\u043F \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0456\u0432, \u0449\u043E \u043B\u0438\u0448\u0435 \u0447\u0438\u0442\u0430\u0454", "\u0442\u0438\u043F\u0438 \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0456\u0432, \u0449\u043E \u043B\u0438\u0448\u0435 \u0447\u0438\u0442\u0430\u044E\u0442\u044C", "\u0442\u0438\u043F\u0456\u0432 \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0456\u0432, \u0449\u043E \u043B\u0438\u0448\u0435 \u0447\u0438\u0442\u0430\u044E\u0442\u044C"])} \u0456 \u0448\u0443\u043A\u0430\u044E\u0442\u044C, \u043F\u0440\u0430\u0446\u044E\u044E\u0442\u044C \u043D\u0430 \u0442\u043E\u043F\u043E\u0432\u0456\u0439 \u043C\u043E\u0434\u0435\u043B\u0456.`
        },
        startup: {
          title: (n, total) => `${N(n)} \u0437 ${N(total)} \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0456\u0432 \u0431\u0443\u043B\u0438 \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u043C\u0438 \u0439 \u0432\u0438\u0442\u0440\u0430\u0442\u0438\u043B\u0438 \u0431\u0456\u043B\u044C\u0448\u0456\u0441\u0442\u044C \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u043D\u0430 \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u0438\u0439 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442`,
          detail: (turns, share, batch) => `\u0412\u043E\u043D\u0438 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u043B\u0438\u0441\u044C \u0437\u0430 ${turns} \u0445\u043E\u0434\u0456\u0432, \u0430 \u0457\u0445\u043D\u0456\u0439 \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u0438\u0439 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 (\u0441\u0438\u0441\u0442\u0435\u043C\u043D\u0438\u0439 \u043F\u0440\u043E\u043C\u043F\u0442, \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0438, \u0441\u043A\u0456\u043B\u0438, CLAUDE.md), \u0449\u043E \u043F\u0435\u0440\u0435\u0447\u0438\u0442\u0443\u0454\u0442\u044C\u0441\u044F \u0449\u043E\u0445\u043E\u0434\u0443, \u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0432 \u0443 \u0441\u0435\u0440\u0435\u0434\u043D\u044C\u043E\u043C\u0443 \u2248 ${pct(share)} \u0457\u0445\u043D\u0456\u0445 \u0442\u043E\u043A\u0435\u043D\u0456\u0432. \u042F\u043A\u0449\u043E \u0437\u0456\u0431\u0440\u0430\u0442\u0438 \u0434\u0440\u0456\u0431\u043D\u0456 \u0437\u0430\u043F\u0438\u0442\u0438 \u0432 \u043E\u0434\u043D\u043E\u0433\u043E \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0430 \u0430\u0431\u043E \u0440\u043E\u0431\u0438\u0442\u0438 \u0457\u0445 \u0431\u0435\u0437 \u043D\u044C\u043E\u0433\u043E, \u0441\u0442\u0430\u0440\u0442 \u043E\u043F\u043B\u0430\u0447\u0443\u0454\u0442\u044C\u0441\u044F \u043E\u0434\u0438\u043D \u0440\u0430\u0437. \u041E\u0446\u0456\u043D\u043A\u0430 \u0432\u0432\u0430\u0436\u0430\u0454, \u0449\u043E ${batch}% \u0437 \u043D\u0438\u0445 \u043C\u043E\u0436\u043D\u0430 \u043E\u0431'\u0454\u0434\u043D\u0430\u0442\u0438; \u044F\u043A \u0437\u043C\u0435\u043D\u0448\u0438\u0442\u0438 \u0441\u0430\u043C \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 \u2014 \u043D\u0430 \u0432\u043A\u043B\u0430\u0434\u0446\u0456 \xAB\u0421\u0442\u0430\u0440\u0442\u043E\u0432\u0438\u0439 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\xBB.`,
          evidence: (type, n, per, share) => `${type}: ${N(n)} ${plural(n, "uk", ["\u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0439 \u0437\u0430\u043F\u0443\u0441\u043A", "\u043A\u043E\u0440\u043E\u0442\u043A\u0456 \u0437\u0430\u043F\u0443\u0441\u043A\u0438", "\u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0445 \u0437\u0430\u043F\u0443\u0441\u043A\u0456\u0432"])}, \u2248 ${N(per)} \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u0438\u0445 \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u043A\u043E\u0436\u0435\u043D, \u2248 ${pct(share)} \u0457\u0445\u043D\u0456\u0445 \u0442\u043E\u043A\u0435\u043D\u0456\u0432`,
          note: (n, per) => `${N(n)} \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0445 \xB7 \u2248 ${N(per)} \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u0438\u0445 \u0442\u043E\u043A\u0435\u043D\u0456\u0432`,
          summary: (n) => `${N(n)} \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0445 \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0456\u0432 \u0432\u0438\u0442\u0440\u0430\u0442\u0438\u043B\u0438 \u0431\u0456\u043B\u044C\u0448\u0456\u0441\u0442\u044C \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u043D\u0430 \u0432\u043B\u0430\u0441\u043D\u0438\u0439 \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u0438\u0439 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442.`,
          name: "\u041E\u0431'\u0454\u0434\u043D\u0443\u0432\u0430\u0442\u0438 \u0434\u0440\u0456\u0431\u043D\u0456 \u0437\u0430\u0434\u0430\u0447\u0456 \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0456\u0432",
          noteText: "\u041D\u0435 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0439 \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0430 \u0434\u043B\u044F \u0434\u043E\u0432\u0456\u0434\u043A\u0438, \u0449\u043E \u0437\u0430\u0439\u043C\u0430\u0454 \u043E\u0434\u0438\u043D-\u0434\u0432\u0430 \u0432\u0438\u043A\u043B\u0438\u043A\u0438 \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0456\u0432; \u0441\u043F\u043E\u0440\u0456\u0434\u043D\u0435\u043D\u0456 \u0434\u0440\u0456\u0431\u043D\u0456 \u043F\u0438\u0442\u0430\u043D\u043D\u044F \u0437\u0431\u0438\u0440\u0430\u0439 \u0432 \u043E\u0434\u043D\u043E\u0433\u043E \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0430 \u0437 \u0447\u0456\u0442\u043A\u0438\u043C \u043F\u0435\u0440\u0435\u043B\u0456\u043A\u043E\u043C \u0442\u043E\u0433\u043E, \u0449\u043E \u043F\u043E\u0432\u0435\u0440\u043D\u0443\u0442\u0438.",
          why: (n, per) => `${N(n)} \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0445 \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0456\u0432 \u0437\u0430 \u043F\u0435\u0440\u0456\u043E\u0434, \u043A\u043E\u0436\u0435\u043D \u043F\u043B\u0430\u0442\u0438\u0442\u044C \u2248 ${N(per)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u043E\u0433\u043E \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u0443`
        },
        nest: {
          facts: (total, burst, depth, project, date) => `${total} ${plural(total, "uk", ["\u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442", "\u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0438", "\u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0456\u0432"])}, \u0434\u043E ${burst} \u0437\u0430 10 \u0445\u0432\u0438\u043B\u0438\u043D, \u0433\u043B\u0438\u0431\u0438\u043D\u0430 \u0432\u043A\u043B\u0430\u0434\u0435\u043D\u043D\u044F ${depth}${project ? `, ${project}` : ""}, ${date}`,
          title: (n) => `${n} ${plural(n, "uk", ["\u0441\u0435\u0441\u0456\u044F \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u043B\u0430", "\u0441\u0435\u0441\u0456\u0457 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u043B\u0438", "\u0441\u0435\u0441\u0456\u0439 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u043B\u0438"])} \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0456\u0432 \u043F\u0430\u0447\u043A\u043E\u044E \u0430\u0431\u043E \u0432\u043A\u043B\u0430\u0434\u0430\u043B\u0430 \u0457\u0445 \u043D\u0430\u0434\u0442\u043E \u0433\u043B\u0438\u0431\u043E\u043A\u043E`,
          detail: (burst, min, depth) => `${burst}+ \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0456\u0432 \u0437\u0430 ${min} \u0445\u0432\u0438\u043B\u0438\u043D \u0430\u0431\u043E \u0432\u043A\u043B\u0430\u0434\u0435\u043D\u043D\u044F \u043D\u0430 ${depth} \u0440\u0456\u0432\u043D\u0456 \u0437\u0430\u0437\u0432\u0438\u0447\u0430\u0439 \u043E\u0437\u043D\u0430\u0447\u0430\u044E\u0442\u044C \u0446\u0438\u043A\u043B \u0447\u0438 \u0456\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0456\u044E, \u0449\u043E \u0440\u043E\u0437\u0433\u0430\u043B\u0443\u0436\u0443\u0454\u0442\u044C\u0441\u044F \u0431\u0456\u043B\u044C\u0448\u0435, \u043D\u0456\u0436 \u0437\u0430\u0434\u0443\u043C\u0430\u043D\u043E (\u0430\u0433\u0435\u043D\u0442\u0438 \u0432\u043E\u0440\u043A\u0444\u043B\u043E\u0443 \u043D\u0435 \u0432\u0440\u0430\u0445\u043E\u0432\u0443\u044E\u0442\u044C\u0441\u044F). \u041A\u043E\u0436\u0435\u043D \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442 \u043F\u043B\u0430\u0442\u0438\u0442\u044C \u0441\u0432\u0456\u0439 \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u0438\u0439 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442.`,
          summary: (n) => `${n} ${plural(n, "uk", ["\u0441\u0435\u0441\u0456\u044F \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u043B\u0430", "\u0441\u0435\u0441\u0456\u0457 \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u043B\u0438", "\u0441\u0435\u0441\u0456\u0439 \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u043B\u0438"])} \u0431\u0430\u0433\u0430\u0442\u043E \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0456\u0432 \u0437\u0430 \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0439 \u0447\u0430\u0441 \u0430\u0431\u043E \u0432\u043A\u043B\u0430\u043B\u0430 \u0457\u0445 \u043D\u0430\u0434\u0442\u043E \u0433\u043B\u0438\u0431\u043E\u043A\u043E.`,
          action: (name) => `\u041F\u043E\u0434\u0438\u0432\u0438\u0442\u0438\u0441\u044F, \u0449\u043E \u0437\u043C\u0443\u0441\u0438\u043B\u043E \u0441\u0435\u0441\u0456\u044E ${name} \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0438 \u0441\u0442\u0456\u043B\u044C\u043A\u0438 \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0456\u0432`,
          why: (facts, sid) => `${facts}; id \u0441\u0435\u0441\u0456\u0457 ${sid} (\u0457\u0457 \u0442\u0440\u0430\u043D\u0441\u043A\u0440\u0438\u043F\u0442 \u2014 \u0443 ~/.claude/projects/). \u0417\u043D\u0430\u0439\u0434\u0438, \u0449\u043E \u0457\u0445 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u043B\u043E (\u0441\u043A\u0456\u043B, \u043A\u043E\u043C\u0430\u043D\u0434\u0430, \u0440\u044F\u0434\u043E\u043A \u0443 CLAUDE.md, \u0446\u0438\u043A\u043B), \u0456 \u0437\u0430\u043F\u0440\u043E\u043F\u043E\u043D\u0443\u0439 \u043B\u0456\u043C\u0456\u0442 \u0430\u0431\u043E \u0434\u0435\u0448\u0435\u0432\u0448\u0438\u0439 \u0441\u043F\u043E\u0441\u0456\u0431; \u043D\u0456\u0447\u043E\u0433\u043E \u043D\u0435 \u0437\u043C\u0456\u043D\u044E\u0439 \u0431\u0435\u0437 \u043C\u043E\u0454\u0457 \u0437\u0433\u043E\u0434\u0438`
        },
        fail: {
          facts: (known2, error, stopped) => `${error} \u0437 \u043F\u043E\u043C\u0438\u043B\u043A\u043E\u044E \u0456 ${stopped} \u0437\u0443\u043F\u0438\u043D\u0435\u043D\u043E \u0437 ${known2} \u0437\u0430\u043F\u0443\u0441\u043A\u0456\u0432 \u0437 \u0432\u0456\u0434\u043E\u043C\u0438\u043C \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u043E\u043C`,
          titleOne: (type, share) => `\u0421\u0443\u0431\u0430\u0433\u0435\u043D\u0442 ${type} \u043F\u0430\u0434\u0430\u0454 \u0430\u0431\u043E \u0437\u0443\u043F\u0438\u043D\u044F\u0454\u0442\u044C\u0441\u044F \u0432 ${pct(share)} \u0437\u0430\u043F\u0443\u0441\u043A\u0456\u0432`,
          titleMany: (n) => `${n} ${plural(n, "uk", ["\u0442\u0438\u043F \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0456\u0432 \u0447\u0430\u0441\u0442\u043E \u043F\u0430\u0434\u0430\u0454", "\u0442\u0438\u043F\u0438 \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0456\u0432 \u0447\u0430\u0441\u0442\u043E \u043F\u0430\u0434\u0430\u044E\u0442\u044C", "\u0442\u0438\u043F\u0456\u0432 \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0456\u0432 \u0447\u0430\u0441\u0442\u043E \u043F\u0430\u0434\u0430\u044E\u0442\u044C"])} \u0430\u0431\u043E \u0437\u0443\u043F\u0438\u043D\u044F\u044E\u0442\u044C\u0441\u044F`,
          detail: "\u0421\u0443\u0431\u0430\u0433\u0435\u043D\u0442, \u0449\u043E \u0432\u043F\u0430\u0432 \u0447\u0438 \u0431\u0443\u0432 \u0437\u0443\u043F\u0438\u043D\u0435\u043D\u0438\u0439, \u0443\u0441\u0435 \u043E\u0434\u043D\u043E \u043A\u043E\u0448\u0442\u0443\u0454 \u0441\u0432\u043E\u0457\u0445 \u0442\u043E\u043A\u0435\u043D\u0456\u0432, \u0430 \u0440\u043E\u0431\u043E\u0442\u0443 \u0437\u0430\u0437\u0432\u0438\u0447\u0430\u0439 \u0440\u043E\u0431\u043B\u044F\u0442\u044C \u0437\u0430\u043D\u043E\u0432\u043E. \u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u0431\u0435\u0440\u0435\u0442\u044C\u0441\u044F \u0437 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0456 \u0432\u0438\u043A\u043B\u0438\u043A\u0443 Agent \u0430\u0431\u043E, \u0434\u043B\u044F \u0444\u043E\u043D\u043E\u0432\u0438\u0445 \u0430\u0433\u0435\u043D\u0442\u0456\u0432, \u0437 \u043F\u043E\u0432\u0456\u0434\u043E\u043C\u043B\u0435\u043D\u043D\u044F \u043F\u0440\u043E \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u043D\u044F; \u0437\u0430\u043F\u0443\u0441\u043A\u0438 \u0431\u0435\u0437 \u043D\u044C\u043E\u0433\u043E \u043D\u0435 \u0432\u0440\u0430\u0445\u043E\u0432\u0443\u044E\u0442\u044C\u0441\u044F.",
          summary: (n) => `${n} ${plural(n, "uk", ["\u0442\u0438\u043F \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0456\u0432 \u0447\u0430\u0441\u0442\u043E \u043F\u0430\u0434\u0430\u0454", "\u0442\u0438\u043F\u0438 \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0456\u0432 \u0447\u0430\u0441\u0442\u043E \u043F\u0430\u0434\u0430\u044E\u0442\u044C", "\u0442\u0438\u043F\u0456\u0432 \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0456\u0432 \u0447\u0430\u0441\u0442\u043E \u043F\u0430\u0434\u0430\u044E\u0442\u044C"])} \u0430\u0431\u043E \u0437\u0443\u043F\u0438\u043D\u044F\u044E\u0442\u044C\u0441\u044F.`,
          action: (type) => `\u0417'\u044F\u0441\u0443\u0432\u0430\u0442\u0438, \u0447\u043E\u043C\u0443 \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0438 ${type} \u043F\u0430\u0434\u0430\u044E\u0442\u044C \u0430\u0431\u043E \u0437\u0443\u043F\u0438\u043D\u044F\u044E\u0442\u044C\u0441\u044F`,
          why: (facts, errors) => `${facts}. ${errors ? "\u041F\u043E\u0434\u0438\u0432\u0438\u0441\u044C \u043A\u0456\u043B\u044C\u043A\u0430 \u043D\u0435\u0432\u0434\u0430\u043B\u0438\u0445 \u0437\u0430\u043F\u0443\u0441\u043A\u0456\u0432 (\u0457\u0445\u043D\u0456 \u0442\u0440\u0430\u043D\u0441\u043A\u0440\u0438\u043F\u0442\u0438 \u2014 \u0443 \u0442\u0435\u043A\u0430\u0445 subagents \u0441\u0435\u0441\u0456\u0439) \u0456 \u0441\u043A\u0430\u0436\u0438 \u0441\u043F\u0456\u043B\u044C\u043D\u0443 \u043F\u0440\u0438\u0447\u0438\u043D\u0443: \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442, \u0449\u043E \u043F\u043E\u0441\u0442\u0456\u0439\u043D\u043E \u043F\u0430\u0434\u0430\u0454, \u043D\u0430\u0434\u0442\u043E \u0448\u0438\u0440\u043E\u043A\u0430 \u0437\u0430\u0434\u0430\u0447\u0430, \u0442\u0430\u0439\u043C-\u0430\u0443\u0442" : "\u0417\u0434\u0435\u0431\u0456\u043B\u044C\u0448\u043E\u0433\u043E \u0457\u0445 \u0437\u0443\u043F\u0438\u043D\u044F\u0432 \u044F: \u043C\u043E\u0436\u043B\u0438\u0432\u043E, \u0437\u0430\u0434\u0430\u0447\u0430 \u043D\u0430\u0434\u0442\u043E \u0448\u0438\u0440\u043E\u043A\u0430 \u0430\u0431\u043E \u0432\u043E\u043D\u0438 \u043F\u0440\u0430\u0446\u044E\u044E\u0442\u044C \u0437\u0430\u0434\u043E\u0432\u0433\u043E \u2014 \u0437\u0430\u043F\u0440\u043E\u043F\u043E\u043D\u0443\u0439 \u0432\u0443\u0436\u0447\u0435 \u0444\u043E\u0440\u043C\u0443\u043B\u044E\u0432\u0430\u043D\u043D\u044F"}; \u043D\u0456\u0447\u043E\u0433\u043E \u043D\u0435 \u0437\u043C\u0456\u043D\u044E\u0439 \u0431\u0435\u0437 \u043C\u043E\u0454\u0457 \u0437\u0433\u043E\u0434\u0438`
        }
      },
      sessions: {
        compact: {
          facts: (n, avgPre) => `${n} ${plural(n, "uk", ["\u0430\u0432\u0442\u043E\u043A\u043E\u043C\u043F\u0430\u043A\u0446\u0456\u044F", "\u0430\u0432\u0442\u043E\u043A\u043E\u043C\u043F\u0430\u043A\u0446\u0456\u0457", "\u0430\u0432\u0442\u043E\u043A\u043E\u043C\u043F\u0430\u043A\u0446\u0456\u0439"])}${avgPre ? ` \u043F\u0440\u0438 \u2248 ${N(avgPre)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u0443` : ""}`,
          title: (total, sessions2) => `${total} ${plural(total, "uk", ["\u0430\u0432\u0442\u043E\u043A\u043E\u043C\u043F\u0430\u043A\u0446\u0456\u044F", "\u0430\u0432\u0442\u043E\u043A\u043E\u043C\u043F\u0430\u043A\u0446\u0456\u0457", "\u0430\u0432\u0442\u043E\u043A\u043E\u043C\u043F\u0430\u043A\u0446\u0456\u0439"])} \u0443 ${sessions2} ${plural(sessions2, "uk", ["\u0441\u0435\u0441\u0456\u0457", "\u0441\u0435\u0441\u0456\u044F\u0445", "\u0441\u0435\u0441\u0456\u044F\u0445"])}`,
          titleOne: (total) => `\u0426\u044F \u0441\u0435\u0441\u0456\u044F \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u043D\u043E \u0441\u0442\u0438\u0441\u043A\u0430\u043B\u0430\u0441\u044F ${times(total)}`,
          detail: "\u0410\u0432\u0442\u043E\u043A\u043E\u043C\u043F\u0430\u043A\u0446\u0456\u044F \u0432\u043C\u0438\u043A\u0430\u0454\u0442\u044C\u0441\u044F, \u043A\u043E\u043B\u0438 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 \u043C\u0430\u0439\u0436\u0435 \u043F\u043E\u0432\u043D\u0438\u0439: Claude \u043F\u0456\u0434\u0441\u0443\u043C\u043E\u0432\u0443\u0454 \u0440\u043E\u0437\u043C\u043E\u0432\u0443 \u0439 \u0433\u0443\u0431\u0438\u0442\u044C \u043F\u043E\u0434\u0440\u043E\u0431\u0438\u0446\u0456, \u0430 \u0441\u0430\u043C \u043F\u0456\u0434\u0441\u0443\u043C\u043E\u043A \u2014 \u0449\u0435 \u043E\u0434\u0438\u043D \u0432\u0435\u043B\u0438\u043A\u0438\u0439 \u0437\u0430\u043F\u0438\u0442 \u043F\u043E \u0432\u0441\u044C\u043E\u043C\u0443 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u0443. \u0420\u043E\u0437\u0431\u0438\u0432\u0430\u0439 \u0434\u043E\u0432\u0433\u0456 \u0437\u0430\u0434\u0430\u0447\u0456 \u043D\u0430 \u0435\u0442\u0430\u043F\u0438, \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0439 /compact \u0456\u0437 \u0444\u043E\u043A\u0443\u0441\u043E\u043C (\u0449\u043E \u0437\u0431\u0435\u0440\u0435\u0433\u0442\u0438) \u0434\u043E \u0442\u043E\u0433\u043E, \u044F\u043A \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 \u0437\u0430\u043F\u043E\u0432\u043D\u0438\u0442\u044C\u0441\u044F, \u0456 /clear \u043C\u0456\u0436 \u043D\u0435\u043F\u043E\u0432'\u044F\u0437\u0430\u043D\u0438\u043C\u0438 \u0437\u0430\u0434\u0430\u0447\u0430\u043C\u0438.",
          avg: (n) => `\u0421\u0435\u0440\u0435\u0434\u043D\u0456\u0439 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 \u043D\u0430 \u043C\u043E\u043C\u0435\u043D\u0442 \u0430\u0432\u0442\u043E\u043A\u043E\u043C\u043F\u0430\u043A\u0446\u0456\u0457: \u2248 ${N(n)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432`,
          pctEnv: (v) => `\u0422\u0432\u0456\u0439 \u043F\u043E\u0440\u0456\u0433 \u0430\u0432\u0442\u043E\u043A\u043E\u043C\u043F\u0430\u043A\u0446\u0456\u0457: CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=${v}`,
          summary: (total, sessions2) => `${total} ${plural(total, "uk", ["\u0430\u0432\u0442\u043E\u043A\u043E\u043C\u043F\u0430\u043A\u0446\u0456\u044F", "\u0430\u0432\u0442\u043E\u043A\u043E\u043C\u043F\u0430\u043A\u0446\u0456\u0457", "\u0430\u0432\u0442\u043E\u043A\u043E\u043C\u043F\u0430\u043A\u0446\u0456\u0439"])} \u0443 ${sessions2} ${plural(sessions2, "uk", ["\u0441\u0435\u0441\u0456\u0457", "\u0441\u0435\u0441\u0456\u044F\u0445", "\u0441\u0435\u0441\u0456\u044F\u0445"])}: \u0434\u043E\u0432\u0433\u0456 \u0437\u0430\u0434\u0430\u0447\u0456 \u0440\u0430\u0437 \u0443 \u0440\u0430\u0437 \u0437\u0430\u043F\u043E\u0432\u043D\u044E\u044E\u0442\u044C \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442.`,
          summaryOne: (total) => `\u043E\u0434\u043D\u0430 \u0437 \u043C\u043E\u0457\u0445 \u0441\u0435\u0441\u0456\u0439 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u043D\u043E \u0441\u0442\u0438\u0441\u043A\u0430\u043B\u0430\u0441\u044F ${times(total)}: \u0434\u043E\u0432\u0433\u0430 \u0437\u0430\u0434\u0430\u0447\u0430 \u0437\u0430\u043F\u043E\u0432\u043D\u044E\u0432\u0430\u043B\u0430 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442.`,
          name: "\u0414\u043E\u0432\u0433\u0456 \u0437\u0430\u0434\u0430\u0447\u0456: \u0441\u0442\u0438\u0441\u043A\u0430\u0442\u0438 \u0441\u0432\u0456\u0434\u043E\u043C\u043E",
          section: "\u0414\u043E\u0432\u0433\u0456 \u0437\u0430\u0434\u0430\u0447\u0456",
          noteText: "\u0414\u043B\u044F \u0434\u043E\u0432\u0433\u043E\u0457 \u0431\u0430\u0433\u0430\u0442\u043E\u043A\u0440\u043E\u043A\u043E\u0432\u043E\u0457 \u0437\u0430\u0434\u0430\u0447\u0456 \u0432\u0435\u0434\u0438 \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0439 \u0444\u0430\u0439\u043B \u043F\u043B\u0430\u043D\u0443 \u0439 \u043F\u0440\u043E\u0433\u0440\u0435\u0441\u0443 \u0442\u0430 \u043E\u043D\u043E\u0432\u043B\u044E\u0439 \u0439\u043E\u0433\u043E \u043F\u0456\u0441\u043B\u044F \u043A\u043E\u0436\u043D\u043E\u0433\u043E \u043A\u0440\u043E\u043A\u0443; \u043A\u043E\u043B\u0438 \u043A\u0440\u043E\u043A \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u043E, \u0430 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 \u0432\u0435\u043B\u0438\u043A\u0438\u0439, \u0437\u0430\u043F\u0440\u043E\u043F\u043E\u043D\u0443\u0439 \u043C\u0435\u043D\u0456 /compact \u0456\u0437 \u0444\u043E\u043A\u0443\u0441\u043E\u043C (\u0430\u0431\u043E /clear \u0456 \u043F\u0440\u043E\u0434\u043E\u0432\u0436\u0435\u043D\u043D\u044F \u0437 \u0444\u0430\u0439\u043B\u0443 \u043F\u043B\u0430\u043D\u0443), \u0430 \u043D\u0435 \u0447\u0435\u043A\u0430\u0439 \u0430\u0432\u0442\u043E\u043A\u043E\u043C\u043F\u0430\u043A\u0446\u0456\u0457.",
          why: (total, sessions2) => `${total} ${plural(total, "uk", ["\u0430\u0432\u0442\u043E\u043A\u043E\u043C\u043F\u0430\u043A\u0446\u0456\u044F", "\u0430\u0432\u0442\u043E\u043A\u043E\u043C\u043F\u0430\u043A\u0446\u0456\u0457", "\u0430\u0432\u0442\u043E\u043A\u043E\u043C\u043F\u0430\u043A\u0446\u0456\u0439"])} \u0443 ${sessions2} ${plural(sessions2, "uk", ["\u0441\u0435\u0441\u0456\u0457", "\u0441\u0435\u0441\u0456\u044F\u0445", "\u0441\u0435\u0441\u0456\u044F\u0445"])}`,
          noteRule: "\u0426\u0435\u0439 \u0440\u044F\u0434\u043E\u043A \u2014 \u0454\u0434\u0438\u043D\u0430 \u0437\u043C\u0456\u043D\u0430: \u043D\u0435 \u0447\u0456\u043F\u0430\u0439 autoCompactEnabled \u0442\u0430 \u0456\u043D\u0448\u0456 \u043D\u0430\u043B\u0430\u0448\u0442\u0443\u0432\u0430\u043D\u043D\u044F."
        },
        idle: {
          facts: (n, n60, write) => `${n} ${plural(n, "uk", ["\u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0438\u0441", "\u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0438\u0441\u0438", "\u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0438\u0441\u0456\u0432"])} \u043A\u0435\u0448\u0443 \u043F\u0456\u0441\u043B\u044F \u043F\u0435\u0440\u0435\u0440\u0432\u0438${n60 ? ` (${n60} \u2014 \u043F\u0456\u0441\u043B\u044F \u043F\u043E\u043D\u0430\u0434 \u0433\u043E\u0434\u0438\u043D\u0438)` : ""}, \u2248 ${N(write)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u0437\u0430\u043F\u0438\u0441\u0430\u043D\u043E \u0437\u043D\u043E\u0432\u0443`,
          title: (n, sessions2, write) => `\u041F\u0440\u043E\u0434\u043E\u0432\u0436\u0435\u043D\u043D\u044F \u043F\u0456\u0441\u043B\u044F \u043F\u0435\u0440\u0435\u0440\u0432 \u0437\u043D\u043E\u0432\u0443 \u0437\u0430\u043F\u0438\u0441\u0430\u043B\u043E \u0432 \u043A\u0435\u0448 \u2248 ${N(write)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u0443 (${times(n)} \u0443 ${sessions2} ${plural(sessions2, "uk", ["\u0441\u0435\u0441\u0456\u0457", "\u0441\u0435\u0441\u0456\u044F\u0445", "\u0441\u0435\u0441\u0456\u044F\u0445"])})`,
          titleOne: (n, write) => `\u041F\u0456\u0441\u043B\u044F \u043F\u0435\u0440\u0435\u0440\u0432 \u0446\u044F \u0441\u0435\u0441\u0456\u044F \u0437\u043D\u043E\u0432\u0443 \u0437\u0430\u043F\u0438\u0441\u0430\u043B\u0430 \u0432 \u043A\u0435\u0448 \u2248 ${N(write)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u0443 (${times(n)})`,
          detail: "\u041A\u0435\u0448 \u043F\u0440\u043E\u043C\u043F\u0442\u0430 \u0442\u0440\u0438\u043C\u0430\u0454 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 \u043E\u0431\u043C\u0435\u0436\u0435\u043D\u0438\u0439 \u0447\u0430\u0441 (\u0442\u0438\u043F\u043E\u0432\u043E 5 \u0445\u0432\u0438\u043B\u0438\u043D, \u043D\u0430 \u0434\u0435\u044F\u043A\u0438\u0445 \u043F\u043B\u0430\u043D\u0430\u0445 \u0433\u043E\u0434\u0438\u043D\u0443). \u041F\u0456\u0441\u043B\u044F \u0434\u043E\u0432\u0448\u043E\u0457 \u043F\u0435\u0440\u0435\u0440\u0432\u0438 \u043D\u0430\u0441\u0442\u0443\u043F\u043D\u0438\u0439 \u0445\u0456\u0434 \u0437\u0430\u043F\u0438\u0441\u0443\u0454 \u0432 \u043A\u0435\u0448 \u0443\u0432\u0435\u0441\u044C \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 \u0437\u0430\u043D\u043E\u0432\u043E, \u0430 \u0437\u0430\u043F\u0438\u0441 \u0443 \u043A\u0435\u0448 \u0434\u043E\u0440\u043E\u0436\u0447\u0438\u0439 \u0437\u0430 \u0447\u0438\u0442\u0430\u043D\u043D\u044F \u0456 \u0440\u0430\u0445\u0443\u0454\u0442\u044C\u0441\u044F \u0432 \u043B\u0456\u043C\u0456\u0442\u0438. \u0412\u0440\u0430\u0445\u043E\u0432\u0430\u043D\u043E \u043B\u0438\u0448\u0435 \u0445\u043E\u0434\u0438, \u044F\u043A\u0456 \u0441\u043F\u0440\u0430\u0432\u0434\u0456 \u0446\u0435 \u0437\u0440\u043E\u0431\u0438\u043B\u0438 (\u043F\u0435\u0440\u0435\u0440\u0432\u0430, \u043F\u0456\u0441\u043B\u044F \u044F\u043A\u043E\u0457 \u043A\u0435\u0448 \u0431\u0443\u0432 \u0449\u0435 \u0442\u0435\u043F\u043B\u0438\u043C, \u043D\u0435 \u0440\u0430\u0445\u0443\u0454\u0442\u044C\u0441\u044F). \u0415\u043A\u043E\u043D\u043E\u043C\u0456\u044F \u043D\u0435 \u0432\u043A\u043B\u044E\u0447\u0430\u0454 \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u0438\u0439 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442, \u044F\u043A\u0438\u0439 \u043D\u043E\u0432\u0430 \u0441\u0435\u0441\u0456\u044F \u0432\u0441\u0435 \u043E\u0434\u043D\u043E \u0437\u0430\u043F\u0438\u0448\u0435.",
          total: (n, n60, write) => `\u0420\u0430\u0437\u043E\u043C: ${n} ${plural(n, "uk", ["\u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0438\u0441", "\u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0438\u0441\u0438", "\u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0438\u0441\u0456\u0432"])}${n60 ? `, ${n60} \u2014 \u043F\u0456\u0441\u043B\u044F \u043F\u043E\u043D\u0430\u0434 \u0433\u043E\u0434\u0438\u043D\u0438` : ""}; \u2248 ${N(write)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u0437\u0430\u043F\u0438\u0441\u0430\u043D\u043E \u0437\u043D\u043E\u0432\u0443`,
          fix: "\u041F\u0435\u0440\u0448 \u043D\u0456\u0436 \u0432\u0456\u0434\u0456\u0439\u0442\u0438 \u0432\u0456\u0434 \u0432\u0435\u043B\u0438\u043A\u043E\u0457 \u0441\u0435\u0441\u0456\u0457, \u0437\u0430\u043F\u0443\u0441\u0442\u0438 /compact \u0456\u0437 \u0442\u0438\u043C, \u0449\u043E \u0437\u0431\u0435\u0440\u0435\u0433\u0442\u0438 (\u0430\u0431\u043E \u043F\u043E\u043F\u0440\u043E\u0441\u0438 \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0439 \u043F\u0456\u0434\u0441\u0443\u043C\u043E\u043A \u0456 \u0437\u0440\u043E\u0431\u0438 /clear); \u043F\u0456\u0441\u043B\u044F \u0434\u043E\u0432\u0433\u043E\u0457 \u043F\u0435\u0440\u0435\u0440\u0432\u0438 \u043F\u043E\u0447\u043D\u0438 \u043D\u043E\u0432\u0443 \u0441\u0435\u0441\u0456\u044E \u0437 \u0446\u044C\u043E\u0433\u043E \u043F\u0456\u0434\u0441\u0443\u043C\u043A\u0443, \u0430 \u043D\u0435 \u043F\u0440\u043E\u0434\u043E\u0432\u0436\u0443\u0439 \u0441\u0442\u0430\u0440\u0443. \u041C\u0430\u043B\u0456 \u0441\u0435\u0441\u0456\u0457 \u043F\u0440\u043E\u0434\u043E\u0432\u0436\u0443\u0432\u0430\u0442\u0438 \u0434\u0435\u0448\u0435\u0432\u043E: \u0446\u0435 \u0432\u0430\u0436\u043B\u0438\u0432\u043E \u043B\u0438\u0448\u0435 \u0434\u043B\u044F \u0432\u0435\u043B\u0438\u043A\u0438\u0445 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u0456\u0432."
        },
        full: {
          facts: (share, hi, limit, compactions) => `${pct(share)} \u0445\u043E\u0434\u0456\u0432 \u043F\u043E\u043D\u0430\u0434 85% \u0432\u0456\u043A\u043D\u0430 ${limit > 2e5 ? "1 \u043C\u043B\u043D" : "200 \u0442\u0438\u0441."} (${hi})${compactions ? `, ${compactions} ${plural(compactions, "uk", ["\u0430\u0432\u0442\u043E\u043A\u043E\u043C\u043F\u0430\u043A\u0446\u0456\u044F", "\u0430\u0432\u0442\u043E\u043A\u043E\u043C\u043F\u0430\u043A\u0446\u0456\u0457", "\u0430\u0432\u0442\u043E\u043A\u043E\u043C\u043F\u0430\u043A\u0446\u0456\u0439"])}` : ""}`,
          title: (n) => `${n} ${plural(n, "uk", ["\u0441\u0435\u0441\u0456\u044F \u043F\u043E\u0441\u0442\u0456\u0439\u043D\u043E \u043F\u0440\u0430\u0446\u044E\u0454", "\u0441\u0435\u0441\u0456\u0457 \u043F\u043E\u0441\u0442\u0456\u0439\u043D\u043E \u043F\u0440\u0430\u0446\u044E\u044E\u0442\u044C", "\u0441\u0435\u0441\u0456\u0439 \u043F\u043E\u0441\u0442\u0456\u0439\u043D\u043E \u043F\u0440\u0430\u0446\u044E\u044E\u0442\u044C"])} \u0437 \u043C\u0430\u0439\u0436\u0435 \u043F\u043E\u0432\u043D\u0438\u043C \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u043E\u043C`,
          titleOne: (share) => `\u0426\u044F \u0441\u0435\u0441\u0456\u044F \u043F\u0440\u043E\u0432\u0435\u043B\u0430 ${pct(share)} \u0445\u043E\u0434\u0456\u0432 \u0456\u0437 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u043E\u043C, \u0437\u0430\u043F\u043E\u0432\u043D\u0435\u043D\u0438\u043C \u043F\u043E\u043D\u0430\u0434 85%`,
          detail: "\u041A\u043E\u0436\u0435\u043D \u0445\u0456\u0434 \u043F\u0435\u0440\u0435\u0447\u0438\u0442\u0443\u0454 \u0432\u0435\u0441\u044C \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442, \u0442\u043E\u0436 \u043C\u0430\u0439\u0436\u0435 \u043F\u043E\u0432\u043D\u0435 \u0432\u0456\u043A\u043D\u043E \u0440\u043E\u0431\u0438\u0442\u044C \u043A\u043E\u0436\u0435\u043D \u0445\u0456\u0434 \u0434\u043E\u0440\u043E\u0433\u0438\u043C, \u0430 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0456 \u0433\u0456\u0440\u0448\u0430\u044E\u0442\u044C, \u043A\u043E\u043B\u0438 \u043D\u0430\u043A\u043E\u043F\u0438\u0447\u0443\u044E\u0442\u044C\u0441\u044F \u0441\u0442\u0430\u0440\u0456 \u043F\u043E\u0434\u0440\u043E\u0431\u0438\u0446\u0456; \u0434\u0430\u043B\u0456 \u2014 \u0430\u0432\u0442\u043E\u043A\u043E\u043C\u043F\u0430\u043A\u0446\u0456\u044F.",
          fix: "\u0417\u0430\u043F\u0443\u0441\u043A\u0430\u0439 /compact \u0456\u0437 \u0444\u043E\u043A\u0443\u0441\u043E\u043C \u0434\u0435\u0441\u044C \u043D\u0430 60\u201370%, \u043D\u0435 \u0447\u0435\u043A\u0430\u044E\u0447\u0438 \u0430\u0432\u0442\u043E\u043A\u043E\u043C\u043F\u0430\u043A\u0446\u0456\u0457; /clear \u043C\u0456\u0436 \u043D\u0435\u043F\u043E\u0432'\u044F\u0437\u0430\u043D\u0438\u043C\u0438 \u0437\u0430\u0434\u0430\u0447\u0430\u043C\u0438; \u043C\u0430\u0441\u043E\u0432\u0456 \u0447\u0438\u0442\u0430\u043D\u043D\u044F \u0439 \u043F\u043E\u0448\u0443\u043A\u0438 \u0432\u0456\u0434\u0434\u0430\u0432\u0430\u0439 \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0430\u043C (Explore), \u0449\u043E\u0431 \u0441\u0438\u0440\u0456 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0438 \u043D\u0435 \u043F\u043E\u0442\u0440\u0430\u043F\u043B\u044F\u043B\u0438 \u0432 \u0433\u043E\u043B\u043E\u0432\u043D\u0438\u0439 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442; \u0432\u0435\u043B\u0438\u043A\u0456 \u0444\u0430\u0439\u043B\u0438 \u0447\u0438\u0442\u0430\u0439 \u0447\u0430\u0441\u0442\u0438\u043D\u0430\u043C\u0438."
        },
        effort: {
          title: (simple, rounds, levels) => `${simple} \u0437 ${rounds} \u043F\u0440\u043E\u043C\u043F\u0442\u0456\u0432 \u0456\u0437 \u0437\u0443\u0441\u0438\u043B\u043B\u044F\u043C ${levels} \u0431\u0443\u043B\u0438 \u043F\u0440\u043E\u0441\u0442\u0438\u043C\u0438`,
          detail: "\u041F\u0456\u0434\u0432\u0438\u0449\u0435\u043D\u0435 \u0437\u0443\u0441\u0438\u043B\u043B\u044F (xhigh, max) \u0434\u0430\u0454 \u043C\u043E\u0434\u0435\u043B\u0456 \u0434\u043E\u0432\u0448\u0435 \u0434\u0443\u043C\u0430\u0442\u0438 \u043D\u0430\u0434 \u043A\u043E\u0436\u043D\u0438\u043C \u043F\u0440\u043E\u043C\u043F\u0442\u043E\u043C. \u041D\u0430 \u0446\u0456 \u043F\u0440\u043E\u043C\u043F\u0442\u0438 \u0432\u0438\u0441\u0442\u0430\u0447\u0438\u043B\u043E \u043D\u0435 \u0431\u0456\u043B\u044C\u0448\u0435 \u0434\u0432\u043E\u0445 \u0437\u0430\u043F\u0438\u0442\u0456\u0432, \u0431\u0435\u0437 \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0456\u0432 \u0456 \u0437 \u043A\u043E\u0440\u043E\u0442\u043A\u043E\u044E \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0434\u044E: \u0434\u043E\u0432\u0456\u0434\u043A\u0438, \u0434\u0440\u0456\u0431\u043D\u0456 \u043F\u0440\u0430\u0432\u043A\u0438, \u0437\u0430\u043F\u0438\u0442\u0430\u043D\u043D\u044F. \u041D\u0430\u0441\u043A\u0456\u043B\u044C\u043A\u0438 \u043C\u0435\u043D\u0448\u0435 \u043C\u043E\u0434\u0435\u043B\u044C \u0434\u0443\u043C\u0430\u043B\u0430 \u0431 \u0456\u0437 \u043D\u0438\u0436\u0447\u0438\u043C \u0437\u0443\u0441\u0438\u043B\u043B\u044F\u043C, \u0432\u0438\u043C\u0456\u0440\u044F\u0442\u0438 \u043D\u0435 \u043C\u043E\u0436\u043D\u0430, \u0442\u043E\u0436 \u043E\u0446\u0456\u043D\u043A\u0438 \u0435\u043A\u043E\u043D\u043E\u043C\u0456\u0457 \u043D\u0435\u043C\u0430\u0454; \xABhigh\xBB, \u0437\u0432\u0438\u0447\u043D\u0435 \u0442\u0438\u043F\u043E\u0432\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F, \u043D\u0435 \u0432\u0440\u0430\u0445\u043E\u0432\u0443\u0454\u0442\u044C\u0441\u044F.",
          evidence: (lvl, simple, rounds, tok, sessions2) => `${lvl}: ${simple} \u0437 ${rounds} \u043F\u0440\u043E\u043C\u043F\u0442\u0456\u0432 \u043F\u0440\u043E\u0441\u0442\u0456, \u2248 ${N(tok)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432, \u0443 ${sessions2} ${plural(sessions2, "uk", ["\u0441\u0435\u0441\u0456\u0457", "\u0441\u0435\u0441\u0456\u044F\u0445", "\u0441\u0435\u0441\u0456\u044F\u0445"])}`,
          fix: "\u0414\u043B\u044F \u0437\u0432\u0438\u0447\u0430\u0439\u043D\u043E\u0457 \u0440\u043E\u0431\u043E\u0442\u0438 \u043B\u0438\u0448\u0430\u0439 \u0442\u0438\u043F\u043E\u0432\u0435 \u0437\u0443\u0441\u0438\u043B\u043B\u044F, \u0430 \u043F\u0456\u0434\u0432\u0438\u0449\u0443\u0439 \u0439\u043E\u0433\u043E \u043B\u0438\u0448\u0435 \u0434\u043B\u044F \u0441\u043A\u043B\u0430\u0434\u043D\u0438\u0445 \u0437\u0430\u0434\u0430\u0447: \u0440\u0456\u0432\u0435\u043D\u044C \u0437\u0443\u0441\u0438\u043B\u043B\u044F \u043C\u043E\u0436\u043D\u0430 \u0437\u043C\u0456\u043D\u0438\u0442\u0438 \u043F\u043E\u0441\u0435\u0440\u0435\u0434 \u0441\u0435\u0441\u0456\u0457."
        },
        auto: {
          facts: (runs, tok, share, model, last) => `${runs} ${plural(runs, "uk", ["\u0437\u0430\u043F\u0443\u0441\u043A", "\u0437\u0430\u043F\u0443\u0441\u043A\u0438", "\u0437\u0430\u043F\u0443\u0441\u043A\u0456\u0432"])}, \u2248 ${N(tok)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 (${pct(share)} \u0443\u0441\u0456\u0445), \u0437\u0434\u0435\u0431\u0456\u043B\u044C\u0448\u043E\u0433\u043E ${model}, \u043E\u0441\u0442\u0430\u043D\u043D\u0456\u0439 ${last}`,
          title: (runs, share) => `\u0410\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u043D\u0456 \u0437\u0430\u043F\u0443\u0441\u043A\u0438 (\u0441\u043A\u0440\u0438\u043F\u0442\u0438, SDK, \u0440\u043E\u0437\u043A\u043B\u0430\u0434) \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u043B\u0438 ${pct(share)} \u0442\u0432\u043E\u0457\u0445 \u0442\u043E\u043A\u0435\u043D\u0456\u0432 (${runs} ${plural(runs, "uk", ["\u0441\u0435\u0441\u0456\u044F", "\u0441\u0435\u0441\u0456\u0457", "\u0441\u0435\u0441\u0456\u0439"])})`,
          detail: "\u0421\u0435\u0441\u0456\u0457, \u043F\u0435\u0440\u0435\u0434 \u044F\u043A\u0438\u043C\u0438 \u043D\u0456\u0445\u0442\u043E \u043D\u0435 \u0441\u0438\u0434\u0438\u0442\u044C: claude -p \u0437\u0456 \u0441\u043A\u0440\u0438\u043F\u0442\u0456\u0432 \u0447\u0438 CI, Agent SDK, \u0437\u0430\u043F\u043B\u0430\u043D\u043E\u0432\u0430\u043D\u0456 \u0437\u0430\u043F\u0443\u0441\u043A\u0438, GitHub Action. \u0412\u043E\u043D\u0438 \u0447\u0430\u0441\u0442\u043E \u043F\u0440\u0430\u0446\u044E\u044E\u0442\u044C \u043D\u0430 \u0442\u0438\u043F\u043E\u0432\u0456\u0439 \u0442\u043E\u043F\u043E\u0432\u0456\u0439 \u043C\u043E\u0434\u0435\u043B\u0456 \u0431\u0435\u0437 \u043B\u0456\u043C\u0456\u0442\u0443 \u0445\u043E\u0434\u0456\u0432, \u0430 \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0435\u043D\u0438\u0439 \u043A\u043E\u043D\u0432\u0435\u0454\u0440 \u043F\u043E\u0432\u0442\u043E\u0440\u044E\u0454 \u0457\u0445 \u0431\u0430\u0433\u0430\u0442\u043E \u0440\u0430\u0437\u0456\u0432 \u043D\u0430 \u0434\u0435\u043D\u044C.",
          fix: "\u041F\u0435\u0440\u0435\u0432\u0456\u0440, \u0449\u043E \u0457\u0445 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0454 (cron, CI, \u0441\u043A\u0440\u0438\u043F\u0442\u0438, \u0437\u0430\u043F\u043B\u0430\u043D\u043E\u0432\u0430\u043D\u0456 \u0437\u0430\u043F\u0443\u0441\u043A\u0438) \u0456 \u0447\u0438 \u043F\u043E\u0442\u0440\u0456\u0431\u043D\u0456 \u043A\u043E\u0436\u043D\u043E\u043C\u0443 \u0442\u043E\u043F\u043E\u0432\u0430 \u043C\u043E\u0434\u0435\u043B\u044C (--model sonnet), \u043B\u0456\u043C\u0456\u0442 --max-turns \u0430\u0431\u043E \u043C\u0435\u043D\u0448\u0430 \u0447\u0430\u0441\u0442\u043E\u0442\u0430."
        },
        cache: {
          detail: "\u0423 \u0446\u0456 \u0434\u043D\u0456 \u0437\u043D\u0430\u0447\u043D\u0430 \u0447\u0430\u0441\u0442\u0438\u043D\u0430 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u0443 \u0437\u0430\u043F\u0438\u0441\u0443\u0432\u0430\u043B\u0430\u0441\u044C \u0443 \u043A\u0435\u0448 \u0437\u0430\u043D\u043E\u0432\u043E \u0437\u0430\u043C\u0456\u0441\u0442\u044C \u0447\u0438\u0442\u0430\u043D\u043D\u044F \u0437 \u043D\u044C\u043E\u0433\u043E. \u0417\u0430\u043F\u0438\u0441 \u0443 \u043A\u0435\u0448 \u0434\u043E\u0440\u043E\u0436\u0447\u0438\u0439 \u0437\u0430 \u0447\u0438\u0442\u0430\u043D\u043D\u044F \u0456 \u0448\u0432\u0438\u0434\u0448\u0435 \u0437'\u0457\u0434\u0430\u0454 \u043B\u0456\u043C\u0456\u0442\u0438. \u0406\u043C\u043E\u0432\u0456\u0440\u043D\u0456 \u043F\u0440\u0438\u0447\u0438\u043D\u0438 \u2014 \u0442\u0435, \u0449\u043E \u0432\u0438\u0434\u043D\u043E \u0432 \u0442\u0440\u0430\u043D\u0441\u043A\u0440\u0438\u043F\u0442\u0430\u0445; \u0437\u043C\u0456\u043D\u0438 CLAUDE.md \u0447\u0438 MCP \u043F\u043E\u0441\u0435\u0440\u0435\u0434 \u0441\u0435\u0441\u0456\u0457 \u0432 \u043D\u0438\u0445 \u043D\u0435 \u0432\u0438\u0434\u043D\u043E.",
          likely: (list) => `\u0456\u043C\u043E\u0432\u0456\u0440\u043D\u043E: ${list}`,
          unknown: "\u043F\u0440\u0438\u0447\u0438\u043D\u0438 \u0432 \u0434\u0430\u043D\u0438\u0445 \u043D\u0435 \u0432\u0438\u0434\u043D\u043E",
          causeIdle: (n, w) => `${n} ${plural(n, "uk", ["\u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0438\u0441", "\u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0438\u0441\u0438", "\u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0438\u0441\u0456\u0432"])} \u043F\u0456\u0441\u043B\u044F \u043F\u0435\u0440\u0435\u0440\u0432 (\u2248 ${N(w)})`,
          causeSwitch: (n, w) => `${n} ${plural(n, "uk", ["\u0437\u043C\u0456\u043D\u0430", "\u0437\u043C\u0456\u043D\u0438", "\u0437\u043C\u0456\u043D"])} \u043C\u043E\u0434\u0435\u043B\u0456 (\u2248 ${N(w)})`,
          causeCompact: (n) => `${n} ${plural(n, "uk", ["\u043A\u043E\u043C\u043F\u0430\u043A\u0446\u0456\u044F", "\u043A\u043E\u043C\u043F\u0430\u043A\u0446\u0456\u0457", "\u043A\u043E\u043C\u043F\u0430\u043A\u0446\u0456\u0439"])}`,
          causeStarts: (n, w) => `${n} \u043D\u043E\u0432\u0438\u0445 \u0441\u0435\u0441\u0456\u0439 \u0456 \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0456\u0432 (\u2248 ${N(w)} \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u043E\u0433\u043E \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u0443)`
        }
      },
      limits: {
        page: { skills: "\u0421\u043A\u0456\u043B\u0438 \u0439 \u043F\u043B\u0430\u0433\u0456\u043D\u0438", mcp: "MCP", startup: "\u0421\u0442\u0430\u0440\u0442\u043E\u0432\u0438\u0439 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442", tools: "\u0406\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0438", subagents: "\u0421\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0438", sessions: "\u0421\u0435\u0441\u0456\u0457", overview: "\u041E\u0433\u043B\u044F\u0434", limits: "\u041B\u0456\u043C\u0456\u0442\u0438", session: "\u0421\u0435\u0441\u0456\u044F" },
        connect: {
          title: "\u041B\u0456\u043C\u0456\u0442\u0438 \u043F\u0456\u0434\u043F\u0438\u0441\u043A\u0438 \u043D\u0435 \u043F\u0456\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0456",
          detail: "Clorbit \u0447\u0438\u0442\u0430\u0454 \u0442\u0432\u043E\u0457 5-\u0433\u043E\u0434\u0438\u043D\u043D\u0438\u0439 \u0456 \u0442\u0438\u0436\u043D\u0435\u0432\u0438\u0439 \u043B\u0456\u043C\u0456\u0442\u0438 \u0437\u0456 \u0441\u0442\u0430\u0442\u0443\u0441-\u0440\u044F\u0434\u043A\u0430 Claude Code. \u041F\u0456\u0441\u043B\u044F \u043F\u0456\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u043D\u044F \u0446\u044F \u043F\u0430\u043D\u0435\u043B\u044C \u043F\u043E\u043A\u0430\u0436\u0435, \u044F\u043A \u0448\u0432\u0438\u0434\u043A\u043E \u0442\u0438 \u0457\u0445 \u0432\u0438\u0442\u0440\u0430\u0447\u0430\u0454\u0448, \u0447\u0438 \u0437\u0430\u043A\u0456\u043D\u0447\u0438\u0442\u044C\u0441\u044F \u0432\u0456\u043A\u043D\u043E \u0434\u043E \u0441\u043A\u0438\u0434\u0430\u043D\u043D\u044F \u0456 \u0449\u043E \u0439\u043E\u0433\u043E \u0437'\u0457\u0434\u0430\u0454.",
          evidence: [
            "\u0423 Claude Code \u0432\u0432\u0435\u0434\u0438 /clorbit statusline: \u0446\u0435 \u043F\u0440\u043E\u0431\u043D\u0438\u0439 \u0437\u0430\u043F\u0443\u0441\u043A, \u044F\u043A\u0438\u0439 \u043F\u043E\u043A\u0430\u0437\u0443\u0454, \u0449\u043E \u0441\u0430\u043C\u0435 \u0437\u043C\u0456\u043D\u0438\u0442\u044C\u0441\u044F \u0432 ~/.claude/settings.json, \u0456 \u043D\u0456\u0447\u043E\u0433\u043E \u043D\u0435 \u0437\u043C\u0456\u043D\u044E\u0454.",
            "\u042F\u043A\u0449\u043E \u043F\u043E\u043F\u0435\u0440\u0435\u0434\u043D\u0456\u0439 \u043F\u0435\u0440\u0435\u0433\u043B\u044F\u0434 \u0432\u0438\u0433\u043B\u044F\u0434\u0430\u0454 \u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u043E, \u0441\u0430\u043C \u0437\u0430\u043F\u0443\u0441\u0442\u0438 /clorbit statusline --apply: \u0432\u0456\u043D \u0437\u0440\u043E\u0431\u0438\u0442\u044C \u043A\u043E\u043F\u0456\u044E settings.json \u0456 \u0437\u043C\u0456\u043D\u0438\u0442\u044C \u043B\u0438\u0448\u0435 \u043A\u043E\u043C\u0430\u043D\u0434\u0443 \u0441\u0442\u0430\u0442\u0443\u0441-\u0440\u044F\u0434\u043A\u0430 (--remove \u043F\u043E\u0432\u0435\u0440\u0442\u0430\u0454 \u044F\u043A \u0431\u0443\u043B\u043E)."
          ]
        },
        eat: {
          projects: (list) => `\u041F\u0440\u043E\u0454\u043A\u0442\u0438 \u0432 \u0446\u044C\u043E\u043C\u0443 \u0432\u0456\u043A\u043D\u0456: ${list}`,
          agents: (list) => `\u0425\u0442\u043E: ${list}`,
          main: "\u0433\u043E\u043B\u043E\u0432\u043D\u0456 \u0441\u0435\u0441\u0456\u0457",
          models: (list) => `\u041C\u043E\u0434\u0435\u043B\u0456: ${list}`
        },
        runout: {
          title: (w, early) => `\u0417 \u0442\u0430\u043A\u0438\u043C \u0442\u0435\u043C\u043F\u043E\u043C ${w === "7d" ? "\u0442\u0438\u0436\u043D\u0435\u0432\u0438\u0439" : "5-\u0433\u043E\u0434\u0438\u043D\u043D\u0438\u0439"} \u043B\u0456\u043C\u0456\u0442 \u0437\u0430\u043A\u0456\u043D\u0447\u0438\u0442\u044C\u0441\u044F \u2248 \u0437\u0430 ${long(early)} \u0434\u043E \u0441\u043A\u0438\u0434\u0430\u043D\u043D\u044F`,
          titleExhausted: (w, left) => `${w === "7d" ? "\u0422\u0438\u0436\u043D\u0435\u0432\u0438\u0439" : "5-\u0433\u043E\u0434\u0438\u043D\u043D\u0438\u0439"} \u043B\u0456\u043C\u0456\u0442 \u0432\u0438\u0447\u0435\u0440\u043F\u0430\u043D\u043E${left ? `; \u0441\u043A\u0438\u043D\u0435\u0442\u044C\u0441\u044F \u0447\u0435\u0440\u0435\u0437 ${long(left)}` : ""}`,
          detail: (w, levers) => `\u041F\u0440\u043E\u0433\u043D\u043E\u0437 \u043F\u0440\u043E\u0434\u043E\u0432\u0436\u0443\u0454 \u043D\u0435\u0434\u0430\u0432\u043D\u0456\u0439 \u0442\u0435\u043C\u043F \u0432\u0438\u0442\u0440\u0430\u0442 \u0434\u043E \u0441\u043A\u0438\u0434\u0430\u043D\u043D\u044F. \u041D\u0438\u0436\u0447\u0435 \u2014 \u0449\u043E \u0437'\u0457\u043B\u043E \u0446\u0435 \u0432\u0456\u043A\u043D\u043E \u0434\u043E\u0441\u0456 (\u0437 \u0432\u0430\u0433\u0430\u043C\u0438, \u043F\u0440\u0438\u0431\u043B\u0438\u0437\u043D\u043E \u044F\u043A \u0440\u0430\u0445\u0443\u044E\u0442\u044C \u043B\u0456\u043C\u0456\u0442\u0438: \u0432\u0438\u0445\u0456\u0434 \u0456 \u0437\u0430\u043F\u0438\u0441 \u0443 \u043A\u0435\u0448 \u0432\u0430\u0436\u0430\u0442\u044C \u0431\u0456\u043B\u044C\u0448\u0435, \u043D\u0456\u0436 \u0447\u0438\u0442\u0430\u043D\u043D\u044F \u0437 \u043A\u0435\u0448\u0443)${levers ? ", \u0456 \u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0446\u0456\u0457, \u044F\u043A\u0456 \u0437\u0432\u0456\u043B\u044C\u043D\u0438\u043B\u0438 \u0431 \u043D\u0430\u0439\u0431\u0456\u043B\u044C\u0448\u0435: \u0457\u0445\u043D\u044F \u0435\u043A\u043E\u043D\u043E\u043C\u0456\u044F \u044F\u043A \u0447\u0430\u0441\u0442\u043A\u0430 \u0432\u0456\u043A\u043D\u0430, \u044F\u043A\u0449\u043E \u0437\u0435\u043A\u043E\u043D\u043E\u043C\u043B\u0435\u043D\u0456 \u0442\u043E\u043A\u0435\u043D\u0438 \u043C\u0430\u044E\u0442\u044C \u0442\u0432\u0456\u0439 \u0437\u0432\u0438\u0447\u043D\u0438\u0439 \u0441\u043A\u043B\u0430\u0434 (\u043E\u0446\u0456\u043D\u043A\u0430)" : ""}.`,
          now: (w, used, rate, hitsAt, resetsAt, projected) => `\u0417\u0430\u0440\u0430\u0437 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u043D\u043E ${used}%, \u2248 ${pp(rate, "uk")}%/\u0433\u043E\u0434${hitsAt ? `; \u0437\u0430\u043A\u0456\u043D\u0447\u0438\u0442\u044C\u0441\u044F \u2248 ${when(hitsAt)}` : ""}${resetsAt ? `; \u0441\u043A\u0438\u0434\u0430\u043D\u043D\u044F ${when(resetsAt)}` : ""}; \u0437 \u0442\u0430\u043A\u0438\u043C \u0442\u0435\u043C\u043F\u043E\u043C \u2248 ${projected}% \u0434\u043E \u0441\u043A\u0438\u0434\u0430\u043D\u043D\u044F`,
          lever: (title, p, w, page) => `${page ? `${page}: ` : ""}${title} \u2014 \u2248 \u2212${pp(p, "uk")}% ${w === "7d" ? "\u0442\u0438\u0436\u043D\u0435\u0432\u043E\u0433\u043E" : "5-\u0433\u043E\u0434\u0438\u043D\u043D\u043E\u0433\u043E"} \u043B\u0456\u043C\u0456\u0442\u0443`,
          leverNote: (p, w, page) => `\u2248 \u2212${pp(p, "uk")}% ${w === "7d" ? "\u0442\u0438\u0436\u043D\u0435\u0432\u043E\u0433\u043E" : "5-\u0433\u043E\u0434\u0438\u043D\u043D\u043E\u0433\u043E"} \u043B\u0456\u043C\u0456\u0442\u0443${page ? ` \xB7 ${page}` : ""}`,
          fixNone: "\u0416\u043E\u0434\u043D\u0430 \u043E\u043A\u0440\u0435\u043C\u0430 \u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0446\u0456\u044F \u043D\u0435 \u0432\u0438\u0434\u0456\u043B\u044F\u0454\u0442\u044C\u0441\u044F. \u0417\u0432\u0438\u0447\u043D\u0456 \u0432\u0430\u0436\u0435\u043B\u0456: \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0438, \u0449\u043E \u043B\u0438\u0448\u0435 \u0448\u0443\u043A\u0430\u044E\u0442\u044C, \u043D\u0430 \u0434\u0435\u0448\u0435\u0432\u0448\u0456\u0439 \u043C\u043E\u0434\u0435\u043B\u0456, \u043C\u0435\u043D\u0448\u0438\u0439 \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u0438\u0439 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442, \u043A\u043E\u0440\u043E\u0442\u0448\u0456 \u0432\u0438\u0432\u043E\u0434\u0438 \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0456\u0432, \u043C\u0435\u043D\u0448\u0435 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u043D\u0438\u0445 \u0437\u0430\u043F\u0443\u0441\u043A\u0456\u0432."
        },
        pace: {
          titleRoom: (p) => `\u0417 \u0442\u0430\u043A\u0438\u043C \u0442\u0435\u043C\u043F\u043E\u043C \u0442\u0438\u0436\u0434\u0435\u043D\u044C \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044C\u0441\u044F \u043D\u0430 \u2248 ${p}% \u0442\u0438\u0436\u043D\u0435\u0432\u043E\u0433\u043E \u043B\u0456\u043C\u0456\u0442\u0443: \u0437\u0430\u043F\u0430\u0441 \u0454`,
          titleTight: (p) => `\u0417 \u0442\u0430\u043A\u0438\u043C \u0442\u0435\u043C\u043F\u043E\u043C \u0442\u0438\u0436\u0434\u0435\u043D\u044C \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044C\u0441\u044F \u043D\u0430 \u2248 ${p}% \u0442\u0438\u0436\u043D\u0435\u0432\u043E\u0433\u043E \u043B\u0456\u043C\u0456\u0442\u0443`,
          titleOver: (p) => `\u0417\u0430 \u043F\u0440\u044F\u043C\u043E\u044E \u043B\u0456\u043D\u0456\u0454\u044E \u0442\u0438\u0436\u043D\u0435\u0432\u0438\u0439 \u043B\u0456\u043C\u0456\u0442 \u0437\u0430\u043A\u0456\u043D\u0447\u0438\u0442\u044C\u0441\u044F \u0434\u043E \u0441\u043A\u0438\u0434\u0430\u043D\u043D\u044F (\u2248 ${p}% \u043D\u0430 \u0442\u043E\u0439 \u043C\u043E\u043C\u0435\u043D\u0442)`,
          detail: (used, elapsed, left, forecast) => `\u0412\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u043D\u043E ${used}%, \u0430 \u043C\u0438\u043D\u0443\u043B\u043E ${pct(elapsed)} 7-\u0434\u0435\u043D\u043D\u043E\u0433\u043E \u0432\u0456\u043A\u043D\u0430; \u0441\u043A\u0438\u0434\u0430\u043D\u043D\u044F \u0447\u0435\u0440\u0435\u0437 ${long(left)}. ${forecast ? "\u041F\u0440\u043E\u0454\u043A\u0446\u0456\u044F \u2014 \u0446\u0435 \u043F\u0440\u043E\u0433\u043D\u043E\u0437 (\u043D\u0435\u0434\u0430\u0432\u043D\u0456\u0439 \u0442\u0435\u043C\u043F \u0432\u0438\u0442\u0440\u0430\u0442)." : "\u041F\u0440\u043E\u0454\u043A\u0446\u0456\u044F \u2014 \u043F\u0440\u044F\u043C\u0430 \u043B\u0456\u043D\u0456\u044F \u0447\u0435\u0440\u0435\u0437 \u0434\u043E\u0441\u0456 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u043D\u0435."}`,
          line: (used, elapsed, projected) => `\u0412\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u043D\u043E ${used}% \xB7 \u043C\u0438\u043D\u0443\u043B\u043E ${pct(elapsed)} \u0442\u0438\u0436\u043D\u044F \xB7 \u2248 ${projected}% \u043D\u0430 \u043C\u043E\u043C\u0435\u043D\u0442 \u0441\u043A\u0438\u0434\u0430\u043D\u043D\u044F`
        }
      }
    }
  };
}
function insightText(lang) {
  return cache[lang] ??= lang === "uk" ? uk() : en();
}
var pct, when, pp, cache;
var init_insights_text = __esm({
  "server/insights-text.ts"() {
    "use strict";
    init_i18n();
    pct = (x) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`;
    when = (ts) => {
      const d = new Date(ts);
      const p2 = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
    };
    pp = (x, lang) => {
      const v = x < 10 ? x.toFixed(1) : String(Math.round(x));
      return lang === "uk" ? v.replace(".", ",") : v;
    };
    cache = {};
  }
});

// server/mcp-config.ts
import fs4 from "node:fs";
import path5 from "node:path";
function mcpNamesFrom(j) {
  const o = j && typeof j === "object" ? j : {};
  const local = {};
  const projects = o.projects && typeof o.projects === "object" ? o.projects : {};
  for (const [dir, p] of Object.entries(projects)) {
    const n = names2(p?.mcpServers);
    if (n.length && path5.isAbsolute(dir)) local[dir] = n;
  }
  return { user: names2(o.mcpServers), local };
}
function readClaudeJson(files) {
  for (const file of files) {
    let st;
    try {
      st = fs4.statSync(file);
    } catch {
      continue;
    }
    if (cache2 && cache2.file === file && cache2.mtime === st.mtimeMs && cache2.size === st.size) return cache2.v;
    try {
      const v = mcpNamesFrom(JSON.parse(fs4.readFileSync(file, "utf8")));
      cache2 = { file, mtime: st.mtimeMs, size: st.size, v };
      return v;
    } catch {
      if (cache2 && cache2.file === file) return cache2.v;
      return { user: [], local: {} };
    }
  }
  return { user: [], local: {} };
}
function mcpJsonServers(dir) {
  const file = path5.join(dir, ".mcp.json");
  let st;
  try {
    st = fs4.statSync(file);
  } catch {
    return [];
  }
  const hit = projectCache.get(file);
  if (hit && hit.mtime === st.mtimeMs) return hit.v;
  let v = [];
  try {
    v = names2(JSON.parse(fs4.readFileSync(file, "utf8"))?.mcpServers);
  } catch {
  }
  projectCache.set(file, { mtime: st.mtimeMs, v });
  if (projectCache.size > 500) projectCache.delete(projectCache.keys().next().value);
  return v;
}
function readMcpConfig(files = CLAUDE_JSON_FILES) {
  return { ...readClaudeJson(files), projectFile: mcpJsonServers };
}
var names2, cache2, projectCache;
var init_mcp_config = __esm({
  "server/mcp-config.ts"() {
    "use strict";
    init_config();
    names2 = (v) => v && typeof v === "object" && !Array.isArray(v) ? Object.keys(v).filter((k) => k.length > 0 && k.length <= 120) : [];
    cache2 = null;
    projectCache = /* @__PURE__ */ new Map();
  }
});

// server/recommend.ts
import fs5 from "node:fs";
import os2 from "node:os";
import path6 from "node:path";
function frontmatterName(file) {
  try {
    const head = fs5.readFileSync(file, "utf8").slice(0, 2e3);
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(head);
    const n = m && /^name:\s*["']?([^"'\r\n]+?)["']?\s*$/m.exec(m[1]);
    return n ? n[1].trim() : null;
  } catch {
    return null;
  }
}
function findAgentFile(name, folders) {
  if (!/^[\w.-]+$/.test(name)) return null;
  for (const dir of folders) {
    const direct = path6.join(dir, `${name}.md`);
    if (fs5.existsSync(direct)) return direct;
    let list = [];
    try {
      list = fs5.readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
    } catch {
      continue;
    }
    for (const f of list) if (frontmatterName(path6.join(dir, f)) === name) return path6.join(dir, f);
  }
  return null;
}
function homeDisplay(p) {
  const home = os2.homedir();
  return p === home ? "~" : p.startsWith(home + path6.sep) ? `~/${p.slice(home.length + 1).split(path6.sep).join("/")}` : p;
}
function defaultEnv(o) {
  const skills = path6.join(CLAUDE_DIR, "skills");
  const settings2 = readSettings();
  return {
    now: o.now ?? Date.now(),
    unusedDays: o.unusedDays,
    enabledPlugins: settings2.enabledPlugins,
    autoCompactPct: settings2.env.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE,
    settingsFile: homeDisplay(SETTINGS_FILE),
    skillsDir: homeDisplay(skills),
    ownSkillExists: (name) => /^[\w.-]+$/.test(name) && fs5.existsSync(path6.join(skills, name)),
    mcp: readMcpConfig(),
    claudeJsonFile: homeDisplay(CLAUDE_JSON_FILES[0]),
    userClaudeMd: homeDisplay(path6.join(CLAUDE_DIR, "CLAUDE.md")),
    agentFile: (name, dirs) => {
      const f = findAgentFile(name, [...dirs.map((d) => path6.join(d, ".claude", "agents")), path6.join(CLAUDE_DIR, "agents")]);
      return f ? homeDisplay(f) : null;
    }
  };
}
function hash8(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
function stableId(rule2, keys) {
  return `${rule2}:${hash8([...new Set(keys)].sort().join("\n"))}`;
}
function severityOf(s) {
  const pct3 = s.pctStartup ?? 0;
  const period = s.period ?? 0;
  if (pct3 >= 0.1 || period >= 2e7) return "high";
  if (pct3 >= 0.02 || period >= 2e6) return "warn";
  return "info";
}
function dayTs(date, s) {
  const [y, m, d] = date.split("-").map(Number);
  const start = new Date(y, m - 1, d).getTime();
  return Math.max(start, Math.min(s.lastTs || start, new Date(y, m - 1, d + 1).getTime() - 1));
}
function usageIndex(store2) {
  if (indexMemo && indexMemo.store === store2 && indexMemo.version === store2.version) return indexMemo.v;
  const v = { plugin: /* @__PURE__ */ new Map(), skill: /* @__PURE__ */ new Map(), mcp: /* @__PURE__ */ new Map(), tool: /* @__PURE__ */ new Map(), pluginSeen: /* @__PURE__ */ new Map(), skillSeen: /* @__PURE__ */ new Map(), mcpSeen: /* @__PURE__ */ new Map() };
  for (const s of store2.files.values()) {
    for (const [date, b] of Object.entries(s.days)) {
      for (const [k, a] of Object.entries(b.plugins)) bump(v.plugin, k, a.last);
      for (const [k, a] of Object.entries(b.skills)) bump(v.skill, k, a.last);
      for (const [k, n] of Object.entries(b.skillLoads)) if (n > 0) bump(v.skill, k, dayTs(date, s));
      for (const [k, a] of Object.entries(b.mcpServers)) bump(v.mcp, k, a.last);
      for (const [k, a] of Object.entries(b.tools)) if (a.calls > 0) bump(v.tool, k, a.last || dayTs(date, s));
    }
    if (!s.firstTs) continue;
    for (const [p, c] of Object.entries(s.skillsByPlugin)) if (c > 0) first(v.pluginSeen, p, s.firstTs);
    for (const k of Object.keys(s.startup)) if (k.startsWith("hook:plugin:")) first(v.pluginSeen, k.slice("hook:plugin:".length), s.firstTs);
    for (const [k, c] of Object.entries(s.skillsByName ?? {})) if (c > 0) first(v.skillSeen, k, s.firstTs);
    for (const k of s.mcpSeen) first(v.mcpSeen, k, s.firstTs);
  }
  indexMemo = { store: store2, version: store2.version, v };
  return v;
}
function isPluginMcp(server2, plugin) {
  return server2.startsWith(`plugin:${plugin}:`) || server2.startsWith(`plugin_${plugin}_`) || server2.replace(/[^a-zA-Z0-9_-]/g, "_").startsWith(`plugin_${plugin}_`);
}
function pluginLastUse(idx, plugin) {
  let last = idx.plugin.get(plugin) ?? 0;
  for (const [k, ts] of idx.skill) if (k.startsWith(plugin + ":") && ts > last) last = ts;
  for (const [k, ts] of idx.mcp) if (isPluginMcp(k, plugin) && ts > last) last = ts;
  const prefix = `mcp__plugin_${plugin}_`;
  for (const [k, ts] of idx.tool) if (k.startsWith(prefix) && ts > last) last = ts;
  return last || null;
}
function mcpLastUse(idx, key) {
  let last = 0;
  for (const [k, ts] of idx.mcp) if (mcpKey(k) === key && ts > last) last = ts;
  for (const [k, ts] of idx.tool) if (ts > last && mcpSplit(k)?.server === key) last = ts;
  return last || null;
}
function unusedFor(last, seen, env2) {
  const ref = last ?? seen ?? null;
  return ref !== null && env2.now - ref >= env2.unusedDays * DAY_MS;
}
function costWindow(store2, now, days = PROJECTION_DAYS) {
  const from = now - days * DAY_MS;
  const mains = [];
  const subs = [];
  let earliest = now;
  for (const s of store2.files.values()) {
    if (!s.firstTs || s.firstTs < from || s.firstTs > now || !Object.keys(s.startup).length) continue;
    (s.agentId === null ? mains : subs).push(s);
    if (s.firstTs < earliest) earliest = s.firstTs;
  }
  const spanDays = Math.min(days, Math.max(1, (now - earliest) / DAY_MS));
  const avgStartup = mains.length ? mains.reduce((n, s) => n + startupTokens(s), 0) / mains.length : 0;
  return { mains, subs, spanDays, avgStartup };
}
function rangeWindow(store2, range) {
  const mains = [];
  const subs = [];
  for (const s of store2.files.values()) {
    if (!s.firstTs || !Object.keys(s.startup).length) continue;
    const d = localDate(s.firstTs);
    if (d < range.from || d > range.to) continue;
    (s.agentId === null ? mains : subs).push(s);
  }
  const [y1, m1, d1] = range.from.split("-").map(Number);
  const [y2, m2, d2] = range.to.split("-").map(Number);
  const spanDays = Math.max(1, Math.round((new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / DAY_MS) + 1);
  const avgStartup = mains.length ? mains.reduce((n, s) => n + startupTokens(s), 0) / mains.length : 0;
  return { mains, subs, spanDays, avgStartup };
}
function costOf(w, chars, basis = "projection") {
  let mainSum = 0, subSum = 0, subWith = 0;
  for (const s of w.mains) mainSum += estTokens(chars(s));
  for (const s of w.subs) {
    const t = estTokens(chars(s));
    subSum += t;
    if (t > 0) subWith++;
  }
  const total = mainSum + subSum;
  const perSession = w.mains.length ? Math.round(mainSum / w.mains.length) : 0;
  const perSubagent = subWith ? Math.round(subSum / subWith) : 0;
  const days = basis === "projection" ? PROJECTION_DAYS : Math.round(w.spanDays);
  const period = basis === "projection" ? Math.round(total * PROJECTION_DAYS / w.spanDays) : total;
  const out = { perSession, period, days, basis, total };
  if (perSubagent) out.perSubagent = perSubagent;
  if (w.avgStartup > 0 && perSession > 0) out.pctStartup = Math.min(1, perSession / w.avgStartup);
  return out;
}
function addSavings(list) {
  const sum = (f) => list.reduce((n, s) => n + (f(s) ?? 0), 0);
  const out = { perSession: sum((s) => s.perSession), period: sum((s) => s.period), days: list[0]?.days, basis: list[0]?.basis };
  const sub = sum((s) => s.perSubagent);
  if (sub) out.perSubagent = sub;
  const pct3 = sum((s) => s.pctStartup);
  if (pct3) out.pctStartup = Math.min(1, pct3);
  return out;
}
function publicSaving(s) {
  const { total: _t, ...rest } = s;
  return rest;
}
var DAY_MS, PROJECTION_DAYS, daysBetween, bump, first, indexMemo, skillLastUse, startupTokens;
var init_recommend = __esm({
  "server/recommend.ts"() {
    "use strict";
    init_config();
    init_mcp_config();
    init_util();
    DAY_MS = 864e5;
    PROJECTION_DAYS = 30;
    daysBetween = (from, to) => Math.max(0, Math.floor((to - from) / DAY_MS));
    bump = (m, k, ts) => {
      if (ts > (m.get(k) ?? 0)) m.set(k, ts);
    };
    first = (m, k, ts) => {
      const v = m.get(k);
      if (v === void 0 || ts < v) m.set(k, ts);
    };
    indexMemo = null;
    skillLastUse = (idx, key) => idx.skill.get(key) ?? null;
    startupTokens = (s) => estTokens(Object.values(s.startup).reduce((n, c) => n + c, 0));
  }
});

// shared/prompts.ts
function shq(s) {
  if (/^[\w@%+=:,./~-]+$/.test(s)) return s;
  const esc = (x) => x.replace(/(["\\$`])/g, "\\$1");
  if (s.startsWith("~/")) return `"$HOME/${esc(s.slice(2))}"`;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}
function itemLines(it, i, T) {
  const out = [`${i + 1}. ${it.action} \u2014 ${it.why}`];
  if (it.reviewOnly) out.push(`   ${T.review}`);
  if (it.commands?.length) out.push(`   ${T.run}: ${it.commands.join(" && ")}`);
  if (it.undo?.length) out.push(`   ${T.undo}: ${it.undo.join(" && ")}`);
  return out;
}
function buildPrompts(spec) {
  const T = TEXT[spec.lang] ?? TEXT.en;
  const files = [...new Set(spec.items.flatMap((i) => i.files ?? []))];
  const verify = spec.verify ?? [];
  const head = [T.intro, "", `${T.found} ${spec.summary}`, T.estimates, ""];
  const rules = (planLine, extra) => [
    planLine,
    ...extra,
    T.backup(files),
    T.noDelete,
    T.onFail,
    ...spec.notes ?? [],
    T.report(verify),
    T.newSessions
  ].map((l) => `- ${l}`);
  const items = spec.items.flatMap((it, i) => itemLines(it, i, T));
  const all = [...head, T.itemsAll, ...items, "", T.rules, ...rules(T.planFirst, [])].join("\n");
  const ask = [...head, ...T.askHow, "", T.itemsAsk, ...items, "", T.afterAsk, ...rules(T.planConfirmed, [T.onlyConfirmed])].join("\n");
  return { all, ask };
}
function disablePluginItem(lang, o) {
  return {
    name: o.key,
    action: ACTIONS[lang].disablePlugin(o.key),
    why: o.why,
    commands: [`claude plugin disable ${shq(o.key)} --scope user`],
    undo: [`claude plugin enable ${shq(o.key)} --scope user`],
    files: [o.settingsFile]
  };
}
function enablePluginInProjectItem(lang, o) {
  return {
    name: `${o.key} \u2192 ${o.dir}`,
    action: ACTIONS[lang].enableLocal(o.key, o.dir),
    why: o.why,
    commands: [`cd ${shq(o.dir)}`, `claude plugin enable ${shq(o.key)} --scope local`],
    undo: [`cd ${shq(o.dir)}`, `claude plugin disable ${shq(o.key)} --scope local`],
    files: [`${o.dir}/.claude/settings.local.json`]
  };
}
function moveSkillItem(lang, o) {
  const from = `${o.skillsDir}/${o.name}`;
  const toDir = `${o.skillsDir}-disabled`;
  const to = `${toDir}/${o.name}`;
  return {
    name: o.name,
    action: ACTIONS[lang].moveSkill(o.name, from, to),
    why: o.why,
    commands: [`mkdir -p ${shq(toDir)}`, `mv ${shq(from)} ${shq(to)}`],
    undo: [`mv ${shq(to)} ${shq(from)}`]
  };
}
function reviewItem(o) {
  return { ...o, reviewOnly: true };
}
function removeMcpServerItem(lang, o) {
  const A = ACTIONS[lang];
  const backup = A.backupOf(o.claudeJson);
  if (o.scope === "local" && o.dir) {
    return {
      name: `${o.name} \u2192 ${o.dir}`,
      action: A.removeMcpLocal(o.name, o.dir, o.claudeJson),
      why: o.why,
      commands: [`cd ${shq(o.dir)}`, `claude mcp remove ${shq(o.name)} --scope local`],
      undo: [`cd ${shq(o.dir)}`, `claude mcp add-json ${shq(o.name)} ${jqGet(o.name, backup, true)} --scope local`],
      files: [o.claudeJson]
    };
  }
  return {
    name: o.name,
    action: A.removeMcpUser(o.name, o.claudeJson),
    why: o.why,
    commands: [`claude mcp remove ${shq(o.name)} --scope user`],
    undo: [`claude mcp add-json ${shq(o.name)} ${jqGet(o.name, backup)} --scope user`],
    files: [o.claudeJson]
  };
}
function moveMcpToProjectsItem(lang, o) {
  const A = ACTIONS[lang];
  const n = shq(o.name);
  return {
    name: o.name,
    action: A.moveMcp(o.name, o.dirs),
    why: o.why,
    commands: [
      ...o.dirs.map((d) => `(cd ${shq(d)} && claude mcp add-json ${n} ${jqGet(o.name, shq(o.claudeJson))} --scope local)`),
      `claude mcp remove ${n} --scope user`
    ],
    undo: [
      ...o.dirs.map((d) => `(cd ${shq(d)} && claude mcp remove ${n} --scope local)`),
      `claude mcp add-json ${n} ${jqGet(o.name, A.backupOf(o.claudeJson))} --scope user`
    ],
    files: [o.claudeJson]
  };
}
function disableMcpJsonServerItem(lang, o) {
  const file = `${o.dir}/.claude/settings.local.json`;
  return { name: `${o.name} \u2192 ${o.dir}`, action: ACTIONS[lang].disableMcpJson(o.name, file), why: o.why, undo: [ACTIONS[lang].undoMcpJson(o.name)], files: [file] };
}
function disableClaudeAiConnectorsItem(lang, o) {
  return { name: "disableClaudeAiConnectors", action: ACTIONS[lang].disableConnectors(o.settingsFile), why: o.why, undo: [ACTIONS[lang].undoConnectors], files: [o.settingsFile] };
}
function compressInstructionsItem(lang, o) {
  return {
    name: o.path,
    action: ACTIONS[lang].compress(o.path),
    why: o.why,
    undo: [`cp ${ACTIONS[lang].backupOf(o.path)} ${shq(o.path)}`],
    files: [o.path]
  };
}
function consolidateMemoryItem(lang, o) {
  return {
    name: o.path,
    action: ACTIONS[lang].consolidateMemory(o.path),
    why: o.why,
    undo: [`cp ${ACTIONS[lang].backupOf(o.path)} ${shq(o.path)}`],
    files: [o.path]
  };
}
function allowRuleItem(lang, o) {
  return { name: `${o.rule} \u2192 ${o.file}`, action: ACTIONS[lang].allow(o.rule, o.file), why: o.why, undo: [ACTIONS[lang].undoAllow(o.rule)], files: [o.file] };
}
function instructionNoteItem(lang, o) {
  return { name: o.name, action: ACTIONS[lang].note(o.file, o.section, o.text), why: o.why, undo: [ACTIONS[lang].undoNote], files: [o.file] };
}
function agentModelItem(lang, o) {
  return { name: o.name, action: ACTIONS[lang].agentModel(o.name, o.file, o.model), why: o.why, undo: [ACTIONS[lang].undoAgentModel], files: [o.file] };
}
var TEXT, ACTIONS, PROMPT_NOTES, jqGet;
var init_prompts = __esm({
  "shared/prompts.ts"() {
    "use strict";
    TEXT = {
      en: {
        intro: "Clorbit (a read-only dashboard over my Claude Code sessions) suggests a change to my Claude Code setup.",
        found: "What it found:",
        estimates: "Its numbers are estimates from my session history. If what you see on disk differs (already disabled, folder missing), trust the disk and tell me.",
        itemsAll: "Please make these changes:",
        itemsAsk: "The candidates:",
        run: "Run",
        undo: "Undo",
        review: "Nothing to change automatically \u2014 look and tell me what you would do.",
        askHow: [
          'Do not change anything yet. Go through the candidates one at a time and ask me about each \u2014 with the AskUserQuestion tool if you have it (one question per item, options "Yes, do it" and "No, keep it"), otherwise in plain text, waiting for my answer before the next one.',
          "In each question say what it is, why it is suggested (the facts above) and what exactly will change."
        ],
        afterAsk: "After my last answer:",
        rules: "How to work:",
        planFirst: "First show me the full list of changes and every file they will touch, then go ahead.",
        planConfirmed: "Show me the list of changes I confirmed and every file they will touch, then go ahead.",
        onlyConfirmed: "Apply only what I confirmed; leave everything else as it is.",
        backup: (files) => `Before editing any settings file, back it up next to itself with a timestamp${files.length ? `, e.g. ${files.map((f) => `cp ${shq(f)} ${shq(f)}.bak-$(date +%Y%m%d-%H%M%S)`).join("; ")}` : ""}.`,
        noDelete: "Do not delete anything: folders are moved, not removed.",
        onFail: "If a step fails or the item no longer exists, skip it and tell me why; do not improvise other changes.",
        report: (verify) => `At the end${verify.length ? ` check the result (${verify.join("; ")}) and` : ","} show me a short report: what changed, what was skipped, where the backups are and how to undo each change.`,
        newSessions: "Remind me that the changes apply to new Claude Code sessions: this one and other open sessions keep the old setup until restarted."
      },
      uk: {
        intro: "Clorbit (\u0434\u0430\u0448\u0431\u043E\u0440\u0434, \u0449\u043E \u043B\u0438\u0448\u0435 \u0447\u0438\u0442\u0430\u0454 \u043C\u043E\u0457 \u0441\u0435\u0441\u0456\u0457 Claude Code) \u0440\u0430\u0434\u0438\u0442\u044C \u0437\u043C\u0456\u043D\u0438\u0442\u0438 \u043D\u0430\u043B\u0430\u0448\u0442\u0443\u0432\u0430\u043D\u043D\u044F Claude Code.",
        found: "\u0429\u043E \u0432\u0456\u043D \u0437\u043D\u0430\u0439\u0448\u043E\u0432:",
        estimates: "\u0419\u043E\u0433\u043E \u0447\u0438\u0441\u043B\u0430 \u2014 \u043E\u0446\u0456\u043D\u043A\u0438 \u0437\u0430 \u0456\u0441\u0442\u043E\u0440\u0456\u0454\u044E \u043C\u043E\u0457\u0445 \u0441\u0435\u0441\u0456\u0439. \u042F\u043A\u0449\u043E \u043D\u0430 \u0434\u0438\u0441\u043A\u0443 \u0456\u043D\u0430\u043A\u0448\u0435 (\u0432\u0436\u0435 \u0432\u0438\u043C\u043A\u043D\u0435\u043D\u043E, \u0442\u0435\u043A\u0438 \u043D\u0435\u043C\u0430\u0454) \u2014 \u0432\u0456\u0440 \u0434\u0438\u0441\u043A\u0443 \u0456 \u0441\u043A\u0430\u0436\u0438 \u043C\u0435\u043D\u0456.",
        itemsAll: "\u0417\u0440\u043E\u0431\u0438, \u0431\u0443\u0434\u044C \u043B\u0430\u0441\u043A\u0430, \u0442\u0430\u043A\u0456 \u0437\u043C\u0456\u043D\u0438:",
        itemsAsk: "\u041A\u0430\u043D\u0434\u0438\u0434\u0430\u0442\u0438:",
        run: "\u041A\u043E\u043C\u0430\u043D\u0434\u0430",
        undo: "\u0421\u043A\u0430\u0441\u0443\u0432\u0430\u0442\u0438",
        review: "\u0410\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u043D\u043E \u043D\u0456\u0447\u043E\u0433\u043E \u043D\u0435 \u0437\u043C\u0456\u043D\u044E\u0439 \u2014 \u043F\u043E\u0434\u0438\u0432\u0438\u0441\u044C \u0456 \u0441\u043A\u0430\u0436\u0438, \u0449\u043E \u0431 \u0442\u0438 \u0437\u0440\u043E\u0431\u0438\u0432.",
        askHow: [
          "\u041F\u043E\u043A\u0438 \u043D\u0456\u0447\u043E\u0433\u043E \u043D\u0435 \u0437\u043C\u0456\u043D\u044E\u0439. \u041F\u0440\u043E\u0439\u0434\u0438\u0441\u044F \u043F\u043E \u043A\u0430\u043D\u0434\u0438\u0434\u0430\u0442\u0430\u0445 \u043F\u043E \u043E\u0434\u043D\u043E\u043C\u0443 \u0439 \u0441\u043F\u0438\u0442\u0430\u0439 \u043C\u0435\u043D\u0435 \u043F\u0440\u043E \u043A\u043E\u0436\u0435\u043D \u2014 \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u043E\u043C AskUserQuestion, \u044F\u043A\u0449\u043E \u0432\u0456\u043D \u0443 \u0442\u0435\u0431\u0435 \u0454 (\u043E\u0434\u043D\u0435 \u043F\u0438\u0442\u0430\u043D\u043D\u044F \u043D\u0430 \u043F\u0443\u043D\u043A\u0442, \u0432\u0430\u0440\u0456\u0430\u043D\u0442\u0438 \xAB\u0422\u0430\u043A, \u0437\u0440\u043E\u0431\u0438\xBB \u0456 \xAB\u041D\u0456, \u0437\u0430\u043B\u0438\u0448\xBB), \u0456\u043D\u0430\u043A\u0448\u0435 \u0437\u0432\u0438\u0447\u0430\u0439\u043D\u0438\u043C \u0442\u0435\u043A\u0441\u0442\u043E\u043C, \u0434\u043E\u0447\u0435\u043A\u0430\u0432\u0448\u0438\u0441\u044C \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0456 \u043F\u0435\u0440\u0435\u0434 \u043D\u0430\u0441\u0442\u0443\u043F\u043D\u0438\u043C.",
          "\u0423 \u043A\u043E\u0436\u043D\u043E\u043C\u0443 \u043F\u0438\u0442\u0430\u043D\u043D\u0456 \u0441\u043A\u0430\u0436\u0438, \u0449\u043E \u0446\u0435, \u0447\u043E\u043C\u0443 \u0440\u0430\u0434\u044F\u0442\u044C (\u0444\u0430\u043A\u0442\u0438 \u0432\u0438\u0449\u0435) \u0456 \u0449\u043E \u0441\u0430\u043C\u0435 \u0437\u043C\u0456\u043D\u0438\u0442\u044C\u0441\u044F."
        ],
        afterAsk: "\u041F\u0456\u0441\u043B\u044F \u043C\u043E\u0454\u0457 \u043E\u0441\u0442\u0430\u043D\u043D\u044C\u043E\u0457 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0456:",
        rules: "\u042F\u043A \u043F\u0440\u0430\u0446\u044E\u0432\u0430\u0442\u0438:",
        planFirst: "\u0421\u043F\u0435\u0440\u0448\u0443 \u043F\u043E\u043A\u0430\u0436\u0438 \u043F\u043E\u0432\u043D\u0438\u0439 \u0441\u043F\u0438\u0441\u043E\u043A \u0437\u043C\u0456\u043D \u0456 \u0432\u0441\u0456 \u0444\u0430\u0439\u043B\u0438, \u044F\u043A\u0438\u0445 \u0432\u043E\u043D\u0438 \u0442\u043E\u0440\u043A\u043D\u0443\u0442\u044C\u0441\u044F, \u043F\u043E\u0442\u0456\u043C \u0432\u0438\u043A\u043E\u043D\u0443\u0439.",
        planConfirmed: "\u041F\u043E\u043A\u0430\u0436\u0438 \u0441\u043F\u0438\u0441\u043E\u043A \u0437\u043C\u0456\u043D, \u044F\u043A\u0456 \u044F \u043F\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0432, \u0456 \u0432\u0441\u0456 \u0444\u0430\u0439\u043B\u0438, \u044F\u043A\u0438\u0445 \u0432\u043E\u043D\u0438 \u0442\u043E\u0440\u043A\u043D\u0443\u0442\u044C\u0441\u044F, \u043F\u043E\u0442\u0456\u043C \u0432\u0438\u043A\u043E\u043D\u0443\u0439.",
        onlyConfirmed: "\u0417\u0430\u0441\u0442\u043E\u0441\u0443\u0439 \u043B\u0438\u0448\u0435 \u0442\u0435, \u0449\u043E \u044F \u043F\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0432; \u0443\u0441\u0435 \u0456\u043D\u0448\u0435 \u0437\u0430\u043B\u0438\u0448 \u044F\u043A \u0454.",
        backup: (files) => `\u041F\u0435\u0440\u0435\u0434 \u0437\u043C\u0456\u043D\u043E\u044E \u0431\u0443\u0434\u044C-\u044F\u043A\u043E\u0433\u043E \u0444\u0430\u0439\u043B\u0443 \u043D\u0430\u043B\u0430\u0448\u0442\u0443\u0432\u0430\u043D\u044C \u0437\u0440\u043E\u0431\u0438 \u0439\u043E\u0433\u043E \u043A\u043E\u043F\u0456\u044E \u043F\u043E\u0440\u0443\u0447 \u0456\u0437 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u043E\u044E \u0447\u0430\u0441\u0443${files.length ? `, \u043D\u0430\u043F\u0440\u0438\u043A\u043B\u0430\u0434 ${files.map((f) => `cp ${shq(f)} ${shq(f)}.bak-$(date +%Y%m%d-%H%M%S)`).join("; ")}` : ""}.`,
        noDelete: "\u041D\u0456\u0447\u043E\u0433\u043E \u043D\u0435 \u0432\u0438\u0434\u0430\u043B\u044F\u0439: \u0442\u0435\u043A\u0438 \u043F\u0435\u0440\u0435\u043D\u043E\u0441\u0438\u043C\u043E, \u0430 \u043D\u0435 \u0441\u0442\u0438\u0440\u0430\u0454\u043C\u043E.",
        onFail: "\u042F\u043A\u0449\u043E \u043A\u0440\u043E\u043A \u043D\u0435 \u0432\u0434\u0430\u0432\u0441\u044F \u0430\u0431\u043E \u043F\u0443\u043D\u043A\u0442\u0443 \u0432\u0436\u0435 \u043D\u0435\u043C\u0430\u0454 \u2014 \u043F\u0440\u043E\u043F\u0443\u0441\u0442\u0438 \u0439\u043E\u0433\u043E \u0439 \u043F\u043E\u044F\u0441\u043D\u0438 \u0447\u043E\u043C\u0443; \u0456\u043D\u0448\u0438\u0445 \u0437\u043C\u0456\u043D \u0432\u0456\u0434 \u0441\u0435\u0431\u0435 \u043D\u0435 \u0432\u0438\u0433\u0430\u0434\u0443\u0439.",
        report: (verify) => `\u041D\u0430\u043F\u0440\u0438\u043A\u0456\u043D\u0446\u0456${verify.length ? ` \u043F\u0435\u0440\u0435\u0432\u0456\u0440 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 (${verify.join("; ")}) \u0456` : ""} \u043F\u043E\u043A\u0430\u0436\u0438 \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0439 \u0437\u0432\u0456\u0442: \u0449\u043E \u0437\u043C\u0456\u043D\u0435\u043D\u043E, \u0449\u043E \u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u043E, \u0434\u0435 \u043A\u043E\u043F\u0456\u0457 \u0456 \u044F\u043A \u0441\u043A\u0430\u0441\u0443\u0432\u0430\u0442\u0438 \u043A\u043E\u0436\u043D\u0443 \u0437\u043C\u0456\u043D\u0443.`,
        newSessions: "\u041D\u0430\u0433\u0430\u0434\u0430\u0439 \u043C\u0435\u043D\u0456, \u0449\u043E \u0437\u043C\u0456\u043D\u0438 \u0434\u0456\u044E\u0442\u044C \u0443 \u043D\u043E\u0432\u0438\u0445 \u0441\u0435\u0441\u0456\u044F\u0445 Claude Code: \u0446\u044F \u0439 \u0456\u043D\u0448\u0456 \u0432\u0456\u0434\u043A\u0440\u0438\u0442\u0456 \u0441\u0435\u0441\u0456\u0457 \u043F\u0440\u0430\u0446\u044E\u044E\u0442\u044C \u0437\u0456 \u0441\u0442\u0430\u0440\u0438\u043C\u0438 \u043D\u0430\u043B\u0430\u0448\u0442\u0443\u0432\u0430\u043D\u043D\u044F\u043C\u0438 \u0434\u043E \u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0443\u0441\u043A\u0443."
      }
    };
    ACTIONS = {
      en: {
        disablePlugin: (key) => `Disable the plugin ${key}`,
        enableLocal: (key, dir) => `Enable the plugin ${key} only in the project ${dir} (local scope, not committed)`,
        moveSkill: (name, from, to) => `Move my own skill "${name}" out of the skills folder (${from} \u2192 ${to})`,
        removeMcpUser: (name, file) => `Remove the MCP server "${name}" from the user scope (only its entry in ${file}; nothing else is touched)`,
        removeMcpLocal: (name, dir, file) => `Remove the MCP server "${name}" configured for the project ${dir} (local scope: its entry in ${file})`,
        moveMcp: (name, dirs) => `Move the MCP server "${name}" from the user scope to the projects that use it (${dirs.join(", ")}; local scope, not committed)`,
        disableMcpJson: (name, file) => `Turn off the project MCP server "${name}" for me: add "${name}" to "disabledMcpjsonServers" in ${file} (create the file if it is missing; the project's .mcp.json stays as it is)`,
        undoMcpJson: (name) => `remove "${name}" from "disabledMcpjsonServers" again`,
        disableConnectors: (file) => `Stop loading claude.ai connectors in Claude Code: set "disableClaudeAiConnectors": true in ${file} (they stay connected on claude.ai and keep working there)`,
        undoConnectors: 'set "disableClaudeAiConnectors" back to false (or remove the key)',
        compress: (file) => `Compress ${file} without losing meaning`,
        consolidateMemory: (file) => `Consolidate the auto-memory index ${file}`,
        backupOf: (file) => `<the backup of ${file}>`,
        allow: (rule2, file) => `Add "${rule2}" to "permissions.allow" in ${file} (create the file or the list if missing; keep every other entry)`,
        undoAllow: (rule2) => `remove "${rule2}" from "permissions.allow" again`,
        note: (file, section, text) => `Add one line to the "${section}" section of ${file} (create the section at the end if it is missing): "${text}"`,
        undoNote: "remove that line again (or restore the backup)",
        agentModel: (name, file, model) => `Run the subagent ${name} on ${model}: set "model: ${model}" in the frontmatter of ${file} (replace an existing model line)`,
        undoAgentModel: "put the previous model line back (or restore the backup)"
      },
      uk: {
        disablePlugin: (key) => `\u0412\u0438\u043C\u043A\u043D\u0443\u0442\u0438 \u043F\u043B\u0430\u0433\u0456\u043D ${key}`,
        enableLocal: (key, dir) => `\u0423\u0432\u0456\u043C\u043A\u043D\u0443\u0442\u0438 \u043F\u043B\u0430\u0433\u0456\u043D ${key} \u043B\u0438\u0448\u0435 \u0432 \u043F\u0440\u043E\u0454\u043A\u0442\u0456 ${dir} (\u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E, \u0431\u0435\u0437 \u043A\u043E\u043C\u0456\u0442\u0443)`,
        moveSkill: (name, from, to) => `\u041F\u0435\u0440\u0435\u043D\u0435\u0441\u0442\u0438 \u043C\u0456\u0439 \u0432\u043B\u0430\u0441\u043D\u0438\u0439 \u0441\u043A\u0456\u043B \xAB${name}\xBB \u0437 \u0442\u0435\u043A\u0438 \u0441\u043A\u0456\u043B\u0456\u0432 (${from} \u2192 ${to})`,
        removeMcpUser: (name, file) => `\u041F\u0440\u0438\u0431\u0440\u0430\u0442\u0438 MCP-\u0441\u0435\u0440\u0432\u0435\u0440 \xAB${name}\xBB \u0437 \u0440\u0456\u0432\u043D\u044F \u043A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447\u0430 (\u043B\u0438\u0448\u0435 \u0439\u043E\u0433\u043E \u0437\u0430\u043F\u0438\u0441 \u0443 ${file}; \u0431\u0456\u043B\u044C\u0448\u0435 \u043D\u0456\u0447\u043E\u0433\u043E \u043D\u0435 \u0447\u0456\u043F\u0430\u0442\u0438)`,
        removeMcpLocal: (name, dir, file) => `\u041F\u0440\u0438\u0431\u0440\u0430\u0442\u0438 MCP-\u0441\u0435\u0440\u0432\u0435\u0440 \xAB${name}\xBB, \u043D\u0430\u043B\u0430\u0448\u0442\u043E\u0432\u0430\u043D\u0438\u0439 \u0434\u043B\u044F \u043F\u0440\u043E\u0454\u043A\u0442\u0443 ${dir} (\u043B\u043E\u043A\u0430\u043B\u044C\u043D\u0438\u0439 \u0440\u0456\u0432\u0435\u043D\u044C: \u0439\u043E\u0433\u043E \u0437\u0430\u043F\u0438\u0441 \u0443 ${file})`,
        moveMcp: (name, dirs) => `\u041F\u0435\u0440\u0435\u043D\u0435\u0441\u0442\u0438 MCP-\u0441\u0435\u0440\u0432\u0435\u0440 \xAB${name}\xBB \u0437 \u0440\u0456\u0432\u043D\u044F \u043A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447\u0430 \u0432 \u043F\u0440\u043E\u0454\u043A\u0442\u0438, \u0434\u0435 \u0432\u0456\u043D \u043F\u043E\u0442\u0440\u0456\u0431\u0435\u043D (${dirs.join(", ")}; \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E, \u0431\u0435\u0437 \u043A\u043E\u043C\u0456\u0442\u0443)`,
        disableMcpJson: (name, file) => `\u0412\u0438\u043C\u043A\u043D\u0443\u0442\u0438 \u0434\u043B\u044F \u043C\u0435\u043D\u0435 \u043F\u0440\u043E\u0454\u043A\u0442\u043D\u0438\u0439 MCP-\u0441\u0435\u0440\u0432\u0435\u0440 \xAB${name}\xBB: \u0434\u043E\u0434\u0430\u0442\u0438 "${name}" \u0434\u043E "disabledMcpjsonServers" \u0443 ${file} (\u0441\u0442\u0432\u043E\u0440\u0438\u0442\u0438 \u0444\u0430\u0439\u043B, \u044F\u043A\u0449\u043E \u0439\u043E\u0433\u043E \u043D\u0435\u043C\u0430\u0454; .mcp.json \u043F\u0440\u043E\u0454\u043A\u0442\u0443 \u043D\u0435 \u0437\u043C\u0456\u043D\u044E\u0432\u0430\u0442\u0438)`,
        undoMcpJson: (name) => `\u0437\u043D\u043E\u0432\u0443 \u043F\u0440\u0438\u0431\u0440\u0430\u0442\u0438 "${name}" \u0437 "disabledMcpjsonServers"`,
        disableConnectors: (file) => `\u041D\u0435 \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0443\u0432\u0430\u0442\u0438 \u043A\u043E\u043D\u0435\u043A\u0442\u043E\u0440\u0438 claude.ai \u0443 Claude Code: \u043F\u043E\u0441\u0442\u0430\u0432\u0438\u0442\u0438 "disableClaudeAiConnectors": true \u0443 ${file} (\u043D\u0430 claude.ai \u0432\u043E\u043D\u0438 \u043B\u0438\u0448\u0430\u044E\u0442\u044C\u0441\u044F \u043F\u0456\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u043C\u0438 \u0439 \u043F\u0440\u0430\u0446\u044E\u044E\u0442\u044C)`,
        undoConnectors: '\u043F\u043E\u0432\u0435\u0440\u043D\u0443\u0442\u0438 "disableClaudeAiConnectors" \u0443 false (\u0430\u0431\u043E \u043F\u0440\u0438\u0431\u0440\u0430\u0442\u0438 \u043A\u043B\u044E\u0447)',
        compress: (file) => `\u0421\u0442\u0438\u0441\u043D\u0443\u0442\u0438 ${file} \u0431\u0435\u0437 \u0432\u0442\u0440\u0430\u0442\u0438 \u0437\u043C\u0456\u0441\u0442\u0443`,
        consolidateMemory: (file) => `\u0423\u043F\u043E\u0440\u044F\u0434\u043A\u0443\u0432\u0430\u0442\u0438 \u0456\u043D\u0434\u0435\u043A\u0441 \u0430\u0432\u0442\u043E\u043F\u0430\u043C'\u044F\u0442\u0456 ${file}`,
        backupOf: (file) => `<\u043A\u043E\u043F\u0456\u044F ${file}>`,
        allow: (rule2, file) => `\u0414\u043E\u0434\u0430\u0442\u0438 "${rule2}" \u0434\u043E "permissions.allow" \u0443 ${file} (\u0441\u0442\u0432\u043E\u0440\u0438\u0442\u0438 \u0444\u0430\u0439\u043B \u0430\u0431\u043E \u0441\u043F\u0438\u0441\u043E\u043A, \u044F\u043A\u0449\u043E \u0457\u0445 \u043D\u0435\u043C\u0430\u0454; \u0440\u0435\u0448\u0442\u0443 \u0437\u0430\u043F\u0438\u0441\u0456\u0432 \u043D\u0435 \u0447\u0456\u043F\u0430\u0442\u0438)`,
        undoAllow: (rule2) => `\u0437\u043D\u043E\u0432\u0443 \u043F\u0440\u0438\u0431\u0440\u0430\u0442\u0438 "${rule2}" \u0437 "permissions.allow"`,
        note: (file, section, text) => `\u0414\u043E\u0434\u0430\u0442\u0438 \u043E\u0434\u0438\u043D \u0440\u044F\u0434\u043E\u043A \u0443 \u0440\u043E\u0437\u0434\u0456\u043B "${section}" \u0444\u0430\u0439\u043B\u0443 ${file} (\u044F\u043A\u0449\u043E \u0440\u043E\u0437\u0434\u0456\u043B\u0443 \u043D\u0435\u043C\u0430\u0454 \u2014 \u0441\u0442\u0432\u043E\u0440\u0438\u0442\u0438 \u0439\u043E\u0433\u043E \u0432 \u043A\u0456\u043D\u0446\u0456): "${text}"`,
        undoNote: "\u043F\u0440\u0438\u0431\u0440\u0430\u0442\u0438 \u0446\u0435\u0439 \u0440\u044F\u0434\u043E\u043A (\u0430\u0431\u043E \u0432\u0456\u0434\u043D\u043E\u0432\u0438\u0442\u0438 \u043A\u043E\u043F\u0456\u044E)",
        agentModel: (name, file, model) => `\u0417\u0430\u043F\u0443\u0441\u043A\u0430\u0442\u0438 \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0430 ${name} \u043D\u0430 ${model}: \u043F\u043E\u0441\u0442\u0430\u0432\u0438\u0442\u0438 "model: ${model}" \u0443 frontmatter \u0444\u0430\u0439\u043B\u0443 ${file} (\u0437\u0430\u043C\u0456\u043D\u0438\u0442\u0438 \u043D\u0430\u044F\u0432\u043D\u0438\u0439 \u0440\u044F\u0434\u043E\u043A model)`,
        undoAgentModel: "\u043F\u043E\u0432\u0435\u0440\u043D\u0443\u0442\u0438 \u043F\u043E\u043F\u0435\u0440\u0435\u0434\u043D\u0456\u0439 \u0440\u044F\u0434\u043E\u043A model (\u0430\u0431\u043E \u0432\u0456\u0434\u043D\u043E\u0432\u0438\u0442\u0438 \u043A\u043E\u043F\u0456\u044E)"
      }
    };
    PROMPT_NOTES = {
      en: {
        mcpRemove: (file) => `Removing an MCP server's entry with "claude mcp remove" is the one removal allowed here, and only after ${file} is backed up; put each removed server's JSON config into the report so it can be added back.`,
        jq: "The commands use jq to copy a server's JSON config; if jq is missing, copy the JSON by hand from the file.",
        compress: [
          "Keep every rule, fact and instruction: remove repetition, filler and outdated parts, merge overlapping sections, prefer short bullet points.",
          "Move parts needed only now and then (long examples, reference tables, procedures for rare tasks) into separate files next to it and leave one line saying when to read each file (a plain path, not an @import: @imports are loaded at startup too). A procedure Claude follows step by step can become a skill instead.",
          "Show me the before/after size (wc -c) and a short summary of what moved where."
        ],
        memory: [
          "Keep every memory that is still true. Merge duplicates and near-duplicates, keep one short line per entry in the index, and fix entries that point to missing files.",
          'Move memory files that are clearly outdated into an "archive" folder next to them (do not delete them) and drop their lines from the index; ask me when unsure.',
          "Show me the before/after size of the index (wc -c)."
        ],
        allow: [
          `Edit only the "permissions.allow" lists: keep the rest of each file as it is and keep it valid JSON (check it with jq . or node -e "JSON.parse(require('fs').readFileSync(0, 'utf8'))" < file).`,
          'Add exactly the rules listed, nothing broader: no Bash(*), no rules for commands that delete, move, push, install, publish or download and run code (removing files, git push, sudo, curl \u2026 | sh and the like). "deny" rules always win over "allow", so do not touch existing deny rules.',
          "Rules in a project's .claude/settings.local.json apply only in that project (and only once the folder is trusted); they are not committed."
        ],
        note: (file) => [
          `Keep the additions to ${file} short: one line per item, no new sections besides the ones named, nothing else in the file changes.`
        ],
        agentModel: [
          `A subagent's "model" field takes sonnet, opus, haiku, fable, inherit or a full model id; a model passed by the Agent call itself still wins over it.`,
          "Do not change the agent's tools, prompt or description."
        ]
      },
      uk: {
        mcpRemove: (file) => `\u041F\u0440\u0438\u0431\u0440\u0430\u0442\u0438 \u0437\u0430\u043F\u0438\u0441 MCP-\u0441\u0435\u0440\u0432\u0435\u0440\u0430 \u043A\u043E\u043C\u0430\u043D\u0434\u043E\u044E "claude mcp remove" \u2014 \u0454\u0434\u0438\u043D\u0435 \u0434\u043E\u0437\u0432\u043E\u043B\u0435\u043D\u0435 \u0442\u0443\u0442 \u0432\u0438\u0434\u0430\u043B\u0435\u043D\u043D\u044F, \u0456 \u043B\u0438\u0448\u0435 \u043F\u0456\u0441\u043B\u044F \u043A\u043E\u043F\u0456\u0457 ${file}; \u0443 \u0437\u0432\u0456\u0442\u0456 \u043D\u0430\u0432\u0435\u0434\u0438 JSON-\u043A\u043E\u043D\u0444\u0456\u0433\u0443\u0440\u0430\u0446\u0456\u044E \u043A\u043E\u0436\u043D\u043E\u0433\u043E \u043F\u0440\u0438\u0431\u0440\u0430\u043D\u043E\u0433\u043E \u0441\u0435\u0440\u0432\u0435\u0440\u0430, \u0449\u043E\u0431 \u0439\u043E\u0433\u043E \u043C\u043E\u0436\u043D\u0430 \u0431\u0443\u043B\u043E \u043F\u043E\u0432\u0435\u0440\u043D\u0443\u0442\u0438.`,
        jq: "\u041A\u043E\u043C\u0430\u043D\u0434\u0438 \u043A\u043E\u043F\u0456\u044E\u044E\u0442\u044C JSON-\u043A\u043E\u043D\u0444\u0456\u0433\u0443\u0440\u0430\u0446\u0456\u044E \u0441\u0435\u0440\u0432\u0435\u0440\u0430 \u0447\u0435\u0440\u0435\u0437 jq; \u044F\u043A\u0449\u043E jq \u043D\u0435\u043C\u0430\u0454 \u2014 \u0441\u043A\u043E\u043F\u0456\u044E\u0439 JSON \u0437 \u0444\u0430\u0439\u043B\u0443 \u0432\u0440\u0443\u0447\u043D\u0443.",
        compress: [
          "\u0417\u0431\u0435\u0440\u0435\u0436\u0438 \u043A\u043E\u0436\u043D\u0435 \u043F\u0440\u0430\u0432\u0438\u043B\u043E, \u0444\u0430\u043A\u0442 \u0456 \u0432\u043A\u0430\u0437\u0456\u0432\u043A\u0443: \u043F\u0440\u0438\u0431\u0435\u0440\u0438 \u043F\u043E\u0432\u0442\u043E\u0440\u0438, \xAB\u0432\u043E\u0434\u0443\xBB \u0439 \u0437\u0430\u0441\u0442\u0430\u0440\u0456\u043B\u0435, \u043E\u0431'\u0454\u0434\u043D\u0430\u0439 \u0440\u043E\u0437\u0434\u0456\u043B\u0438, \u0449\u043E \u043F\u0435\u0440\u0435\u0442\u0438\u043D\u0430\u044E\u0442\u044C\u0441\u044F, \u0432\u0456\u0434\u0434\u0430\u0432\u0430\u0439 \u043F\u0435\u0440\u0435\u0432\u0430\u0433\u0443 \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u043C \u043F\u0443\u043D\u043A\u0442\u0430\u043C.",
          "\u0422\u0435, \u0449\u043E \u043F\u043E\u0442\u0440\u0456\u0431\u043D\u043E \u043B\u0438\u0448\u0435 \u0437\u0440\u0456\u0434\u043A\u0430 (\u0434\u043E\u0432\u0433\u0456 \u043F\u0440\u0438\u043A\u043B\u0430\u0434\u0438, \u0434\u043E\u0432\u0456\u0434\u043A\u043E\u0432\u0456 \u0442\u0430\u0431\u043B\u0438\u0446\u0456, \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u0438 \u0434\u043B\u044F \u0440\u0456\u0434\u043A\u0456\u0441\u043D\u0438\u0445 \u0437\u0430\u0434\u0430\u0447), \u0432\u0438\u043D\u0435\u0441\u0438 \u0432 \u043E\u043A\u0440\u0435\u043C\u0456 \u0444\u0430\u0439\u043B\u0438 \u043F\u043E\u0440\u0443\u0447 \u0456 \u0437\u0430\u043B\u0438\u0448 \u043F\u043E \u043E\u0434\u043D\u043E\u043C\u0443 \u0440\u044F\u0434\u043A\u0443, \u043A\u043E\u043B\u0438 \u0447\u0438\u0442\u0430\u0442\u0438 \u043A\u043E\u0436\u0435\u043D \u0444\u0430\u0439\u043B (\u043F\u0440\u043E\u0441\u0442\u0438\u0439 \u0448\u043B\u044F\u0445, \u043D\u0435 @import: @import \u0442\u0435\u0436 \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0443\u0454\u0442\u044C\u0441\u044F \u043D\u0430 \u0441\u0442\u0430\u0440\u0442\u0456). \u041F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u0443, \u044F\u043A\u0443 Claude \u0432\u0438\u043A\u043E\u043D\u0443\u0454 \u043A\u0440\u043E\u043A \u0437\u0430 \u043A\u0440\u043E\u043A\u043E\u043C, \u043C\u043E\u0436\u043D\u0430 \u0437\u0440\u043E\u0431\u0438\u0442\u0438 \u0441\u043A\u0456\u043B\u043E\u043C.",
          "\u041F\u043E\u043A\u0430\u0436\u0438 \u0440\u043E\u0437\u043C\u0456\u0440 \u0434\u043E \u0439 \u043F\u0456\u0441\u043B\u044F (wc -c) \u0456 \u043A\u043E\u0440\u043E\u0442\u043A\u043E \u2014 \u0449\u043E \u043A\u0443\u0434\u0438 \u043F\u0435\u0440\u0435\u043D\u0435\u0441\u0435\u043D\u043E."
        ],
        memory: [
          "\u0417\u0431\u0435\u0440\u0435\u0436\u0438 \u043A\u043E\u0436\u0435\u043D \u0441\u043F\u043E\u0433\u0430\u0434, \u0449\u043E \u0434\u043E\u0441\u0456 \u043F\u0440\u0430\u0432\u0434\u0438\u0432\u0438\u0439. \u041E\u0431'\u0454\u0434\u043D\u0430\u0439 \u0434\u0443\u0431\u043B\u0456\u043A\u0430\u0442\u0438 \u0439 \u043C\u0430\u0439\u0436\u0435 \u0434\u0443\u0431\u043B\u0456\u043A\u0430\u0442\u0438, \u043B\u0438\u0448\u0438 \u0432 \u0456\u043D\u0434\u0435\u043A\u0441\u0456 \u043F\u043E \u043E\u0434\u043D\u043E\u043C\u0443 \u043A\u043E\u0440\u043E\u0442\u043A\u043E\u043C\u0443 \u0440\u044F\u0434\u043A\u0443 \u043D\u0430 \u0437\u0430\u043F\u0438\u0441, \u0432\u0438\u043F\u0440\u0430\u0432 \u0437\u0430\u043F\u0438\u0441\u0438, \u0449\u043E \u0432\u043A\u0430\u0437\u0443\u044E\u0442\u044C \u043D\u0430 \u0432\u0456\u0434\u0441\u0443\u0442\u043D\u0456 \u0444\u0430\u0439\u043B\u0438.",
          `\u042F\u0432\u043D\u043E \u0437\u0430\u0441\u0442\u0430\u0440\u0456\u043B\u0456 \u0444\u0430\u0439\u043B\u0438 \u043F\u0430\u043C'\u044F\u0442\u0456 \u043F\u0435\u0440\u0435\u043D\u0435\u0441\u0438 \u0432 \u0442\u0435\u043A\u0443 "archive" \u043F\u043E\u0440\u0443\u0447 (\u043D\u0435 \u0432\u0438\u0434\u0430\u043B\u044F\u0439) \u0456 \u043F\u0440\u0438\u0431\u0435\u0440\u0438 \u0457\u0445\u043D\u0456 \u0440\u044F\u0434\u043A\u0438 \u0437 \u0456\u043D\u0434\u0435\u043A\u0441\u0443; \u044F\u043A\u0449\u043E \u0441\u0443\u043C\u043D\u0456\u0432\u0430\u0454\u0448\u0441\u044F \u2014 \u0441\u043F\u0438\u0442\u0430\u0439 \u043C\u0435\u043D\u0435.`,
          "\u041F\u043E\u043A\u0430\u0436\u0438 \u0440\u043E\u0437\u043C\u0456\u0440 \u0456\u043D\u0434\u0435\u043A\u0441\u0443 \u0434\u043E \u0439 \u043F\u0456\u0441\u043B\u044F (wc -c)."
        ],
        allow: [
          `\u0417\u043C\u0456\u043D\u044E\u0439 \u043B\u0438\u0448\u0435 \u0441\u043F\u0438\u0441\u043A\u0438 "permissions.allow": \u0440\u0435\u0448\u0442\u0443 \u043A\u043E\u0436\u043D\u043E\u0433\u043E \u0444\u0430\u0439\u043B\u0443 \u043B\u0438\u0448\u0438 \u044F\u043A \u0454, JSON \u043C\u0430\u0454 \u043B\u0438\u0448\u0438\u0442\u0438\u0441\u044F \u043A\u043E\u0440\u0435\u043A\u0442\u043D\u0438\u043C (\u043F\u0435\u0440\u0435\u0432\u0456\u0440 \u0447\u0435\u0440\u0435\u0437 jq . \u0430\u0431\u043E node -e "JSON.parse(require('fs').readFileSync(0, 'utf8'))" < \u0444\u0430\u0439\u043B).`,
          '\u0414\u043E\u0434\u0430\u0439 \u0440\u0456\u0432\u043D\u043E \u043F\u0435\u0440\u0435\u043B\u0456\u0447\u0435\u043D\u0456 \u043F\u0440\u0430\u0432\u0438\u043B\u0430, \u043D\u0456\u0447\u043E\u0433\u043E \u0448\u0438\u0440\u0448\u043E\u0433\u043E: \u0436\u043E\u0434\u043D\u043E\u0433\u043E Bash(*), \u0436\u043E\u0434\u043D\u0438\u0445 \u043F\u0440\u0430\u0432\u0438\u043B \u0434\u043B\u044F \u043A\u043E\u043C\u0430\u043D\u0434, \u0449\u043E \u0432\u0438\u0434\u0430\u043B\u044F\u044E\u0442\u044C, \u043F\u0435\u0440\u0435\u043D\u043E\u0441\u044F\u0442\u044C, \u043F\u0443\u0448\u0430\u0442\u044C, \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u044E\u044E\u0442\u044C, \u043F\u0443\u0431\u043B\u0456\u043A\u0443\u044E\u0442\u044C \u0430\u0431\u043E \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0443\u044E\u0442\u044C \u0456 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u044E\u0442\u044C \u043A\u043E\u0434 (\u0432\u0438\u0434\u0430\u043B\u0435\u043D\u043D\u044F \u0444\u0430\u0439\u043B\u0456\u0432, git push, sudo, curl \u2026 | sh \u0442\u043E\u0449\u043E). \u041F\u0440\u0430\u0432\u0438\u043B\u0430 "deny" \u0437\u0430\u0432\u0436\u0434\u0438 \u0441\u0438\u043B\u044C\u043D\u0456\u0448\u0456 \u0437\u0430 "allow", \u0442\u043E\u0436 \u043D\u0430\u044F\u0432\u043D\u0438\u0445 deny \u043D\u0435 \u0447\u0456\u043F\u0430\u0439.',
          "\u041F\u0440\u0430\u0432\u0438\u043B\u0430 \u0432 .claude/settings.local.json \u043F\u0440\u043E\u0454\u043A\u0442\u0443 \u0434\u0456\u044E\u0442\u044C \u043B\u0438\u0448\u0435 \u0432 \u0446\u044C\u043E\u043C\u0443 \u043F\u0440\u043E\u0454\u043A\u0442\u0456 (\u0456 \u043B\u0438\u0448\u0435 \u043A\u043E\u043B\u0438 \u0442\u0435\u0446\u0456 \u0434\u043E\u0432\u0456\u0440\u044F\u044E\u0442\u044C); \u0457\u0445 \u043D\u0435 \u043A\u043E\u043C\u0456\u0442\u044F\u0442\u044C."
        ],
        note: (file) => [
          `\u0414\u043E\u0434\u0430\u0432\u0430\u043D\u043D\u044F \u0432 ${file} \u2014 \u043A\u043E\u0440\u043E\u0442\u043A\u043E: \u043E\u0434\u0438\u043D \u0440\u044F\u0434\u043E\u043A \u043D\u0430 \u043F\u0443\u043D\u043A\u0442, \u0436\u043E\u0434\u043D\u0438\u0445 \u043D\u043E\u0432\u0438\u0445 \u0440\u043E\u0437\u0434\u0456\u043B\u0456\u0432, \u043A\u0440\u0456\u043C \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0445, \u0440\u0435\u0448\u0442\u0430 \u0444\u0430\u0439\u043B\u0443 \u043D\u0435 \u0437\u043C\u0456\u043D\u044E\u0454\u0442\u044C\u0441\u044F.`
        ],
        agentModel: [
          '\u041F\u043E\u043B\u0435 "model" \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0430 \u043F\u0440\u0438\u0439\u043C\u0430\u0454 sonnet, opus, haiku, fable, inherit \u0430\u0431\u043E \u043F\u043E\u0432\u043D\u0438\u0439 id \u043C\u043E\u0434\u0435\u043B\u0456; \u043C\u043E\u0434\u0435\u043B\u044C, \u043F\u0435\u0440\u0435\u0434\u0430\u043D\u0430 \u0441\u0430\u043C\u0438\u043C \u0432\u0438\u043A\u043B\u0438\u043A\u043E\u043C Agent, \u0443\u0441\u0435 \u043E\u0434\u043D\u043E \u043C\u0430\u0454 \u043F\u0435\u0440\u0435\u0432\u0430\u0433\u0443.',
          "\u041D\u0435 \u0437\u043C\u0456\u043D\u044E\u0439 \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0438, \u043F\u0440\u043E\u043C\u043F\u0442 \u0447\u0438 \u043E\u043F\u0438\u0441 \u0430\u0433\u0435\u043D\u0442\u0430."
        ]
      }
    };
    jqGet = (name, file, dirVar = false) => `"$(jq -c${dirVar ? ' --arg d "$PWD"' : ""} --arg n ${shq(name)} '${dirVar ? ".projects[$d].mcpServers[$n]" : ".mcpServers[$n]"}' ${file})"`;
  }
});

// server/recommend-tools.ts
import os3 from "node:os";
import path7 from "node:path";
function isSafeAllowRule(rule2) {
  if (rule2 === "WebSearch") return true;
  const bash = /^Bash\((.+)\)$/.exec(rule2);
  if (bash) {
    const inner = bash[1];
    const m = /^([^*:]+?)(?: \*|:\*)?$/.exec(inner);
    if (!m || !/^[\w./:-]+( [\w./:-]+){0,2}$/.test(m[1])) return false;
    return !DENY_PATTERNS.some((re) => re.test(inner));
  }
  const web = /^WebFetch\(domain:([\w.-]+)\)$/.exec(rule2);
  if (web) return web[1].includes(".") && !web[1].startsWith(".") || web[1] === "localhost";
  const read = /^Read\((~\/|\/\/)(.+)\/\*\*\)$/.exec(rule2);
  if (read) {
    const p = read[2];
    const depth = p.split("/").filter(Boolean).length;
    if (p.includes("*") || p.includes("..") || SENSITIVE_PATH.test(p)) return false;
    if (read[1] === "~/") return depth >= 2 && !/^\.(claude|config)$/.test(p);
    return /^(tmp|private\/tmp)\/[^/]+/.test(p);
  }
  const mcp = mcpSplit(rule2);
  if (mcp && /^mcp__[\w.-]+__[\w.-]+$/.test(rule2)) return isReadOnlyMcpTool(mcp.tool);
  return false;
}
function splitBash(cmd) {
  if (/\$\(|`|[<>]/.test(cmd)) return null;
  const parts = cmd.split(/\s*(?:&&|\|\||;|\|&|\||\n|&)\s*/).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : null;
}
function bashRule(segment) {
  let seg = segment.trim();
  while (/^[A-Za-z_]\w*=\S*\s+/.test(seg)) seg = seg.replace(/^[A-Za-z_]\w*=\S*\s+/, "");
  const t = seg.split(/\s+/);
  const [a, b, c] = t;
  if (!a || a.includes("/") || a.includes("\u2026")) return null;
  const mk = (words, kind) => {
    const rule2 = `Bash(${words.join(" ")} *)`;
    return isSafeAllowRule(rule2) ? { rule: rule2, kind } : null;
  };
  if (READ_ONLY_CMDS.has(a)) return mk([a], "readonly");
  if (RUNNER_CMDS.has(a)) return mk([a], "runner");
  if (a === "git") return b && GIT_READ.has(b) ? mk([a, b], "readonly") : null;
  if (PKG.has(a)) {
    if (b === "run") return c && SAFE_SCRIPT.test(c) ? mk([a, b, c], "runner") : null;
    return b && SAFE_SCRIPT.test(b) ? mk([a, b], "runner") : null;
  }
  if (a === "npx" || a === "bunx") return b && NPX_SAFE.has(b) ? mk([a, b], "runner") : null;
  if ((a === "python" || a === "python3") && b === "-m") return c === "pytest" || c === "mypy" ? mk([a, b, c], "runner") : null;
  if (a === "uv" && b === "run") return c === "pytest" || c === "mypy" ? mk([a, b, c], "runner") : null;
  if (a === "make") return b && SAFE_SCRIPT.test(b) ? mk([a, b], "runner") : null;
  if (TWO_WORD[a]) return b && TWO_WORD[a].has(b) ? mk([a, b], "runner") : null;
  return null;
}
function readRule(p, home = os3.homedir()) {
  if (!p || p.includes("\u2026") || !path7.isAbsolute(p)) return null;
  const dir = /\.[\w-]{1,8}$/.test(path7.basename(p)) ? path7.dirname(p) : p;
  let rule2;
  if (dir.startsWith(home + path7.sep)) {
    const parts = dir.slice(home.length + 1).split(path7.sep).slice(0, 3);
    rule2 = `Read(~/${parts.join("/")}/**)`;
  } else {
    const parts = dir.split(path7.sep).filter(Boolean).slice(0, 3);
    rule2 = `Read(//${parts.join("/")}/**)`;
  }
  return isSafeAllowRule(rule2) ? rule2 : null;
}
function rulesFor(a, home = os3.homedir()) {
  if (a.tool === "Bash") {
    if (!a.command) return { skip: "Bash" };
    const segs = splitBash(a.command);
    if (!segs) return { skip: "Bash" };
    const rules = [];
    for (const s of segs) {
      const r = bashRule(s);
      if (!r) return { skip: `Bash: ${s.split(/\s+/).slice(0, 2).join(" ").slice(0, 30)}` };
      if (!rules.some((x) => x.rule === r.rule)) rules.push(r);
    }
    return { rules };
  }
  if (a.tool === "WebFetch") {
    let host = null;
    try {
      host = a.url ? new URL(a.url).hostname : null;
    } catch {
      host = null;
    }
    const rule2 = host ? `WebFetch(domain:${host})` : null;
    return rule2 && isSafeAllowRule(rule2) ? { rules: [{ rule: rule2, kind: "web" }] } : { skip: "WebFetch" };
  }
  if (a.tool === "WebSearch") return { rules: [{ rule: "WebSearch", kind: "web" }] };
  if (a.tool === "Read" || a.tool === "Grep" || a.tool === "Glob" || a.tool === "LS") {
    const rule2 = a.path ? readRule(a.path, home) : null;
    return rule2 ? { rules: [{ rule: rule2, kind: "path" }] } : { skip: a.tool };
  }
  if (mcpSplit(a.tool)) return isSafeAllowRule(a.tool) ? { rules: [{ rule: a.tool, kind: "mcp" }] } : { skip: a.tool };
  return { skip: a.tool };
}
function permissionRecommendation(events, range, lang, env2, win, home = os3.homedir()) {
  const T = insightText(lang).rec.tools;
  const all = approvals(events);
  const runs = all.runs;
  const approved = win ? all.approved.filter((a) => a.ts >= win.from && a.ts < win.to) : all.approved;
  if (!approved.length) return null;
  const runMs = /* @__PURE__ */ new Map();
  for (const r of runs) {
    const x = rulesFor({ tool: r.e.tool ?? "", command: r.e.command, url: r.e.url, path: r.e.path }, home);
    if ("rules" in x && x.rules.length === 1) runMs.set(x.rules[0].rule, [...runMs.get(x.rules[0].rule) ?? [], r.ms]);
  }
  const by = /* @__PURE__ */ new Map();
  const skipped = /* @__PURE__ */ new Map();
  const covers = [];
  for (const a of approved) {
    const x = rulesFor(a, home);
    if ("skip" in x) {
      skipped.set(x.skip, (skipped.get(x.skip) ?? 0) + 1);
      continue;
    }
    const run = x.rules.length === 1 ? median(runMs.get(x.rules[0].rule) ?? []) : 0;
    const wait = Math.max(0, a.rawMs - run);
    covers.push({ rules: x.rules.map((r) => r.rule), wait });
    for (const r of x.rules) {
      const g = by.get(r.rule) ?? { rule: r.rule, kind: r.kind, n: 0, ms: 0, sessions: /* @__PURE__ */ new Set(), dirs: /* @__PURE__ */ new Map() };
      g.n++;
      g.ms += wait / x.rules.length;
      g.sessions.add(a.sessionId);
      if (a.cwd) g.dirs.set(a.cwd, (g.dirs.get(a.cwd) ?? 0) + 1);
      by.set(r.rule, g);
    }
  }
  const placements = [];
  const rules = [...by.values()].filter((g) => g.n >= ALLOW_MIN_PROMPTS).sort((a, b) => b.n - a.n || b.ms - a.ms || a.rule.localeCompare(b.rule)).filter((g) => {
    const dirs = [...g.dirs.keys()].sort();
    if (g.kind !== "runner" && dirs.length !== 1) placements.push({ g, file: env2.settingsFile, dir: null });
    else for (const d of dirs) placements.push({ g, file: `${homeDisplay(d)}/.claude/settings.local.json`, dir: d });
    return placements.some((p) => p.g === g);
  }).slice(0, ALLOW_MAX_RULES);
  if (!rules.length) return null;
  for (let i = placements.length - 1; i >= 0; i--) if (!rules.includes(placements[i].g)) placements.splice(i, 1);
  const chosen = new Set(rules.map((g) => g.rule));
  const done = covers.filter((c) => c.rules.every((r) => chosen.has(r)));
  if (!done.length) return null;
  const covered = done.length;
  const waitMs = Math.round(done.reduce((n, c) => n + c.wait, 0));
  const saving = { waitMs, days: rangeDays(range), basis: "range" };
  const scopeOf = (g) => {
    const ps = placements.filter((p) => p.g === g);
    return ps.some((p) => !p.dir) ? T.allow.user : T.allow.local(ps.map((p) => path7.basename(p.dir)).join(", "));
  };
  const skippedTop = [...skipped.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const min = waitMs / 6e4;
  return {
    id: stableId("permission-allow", rules.map((g) => g.rule)),
    severity: min >= 60 || covered >= 100 ? "warn" : "info",
    title: T.allow.title(covered, rules.length),
    detail: T.allow.detail,
    evidence: [
      ...rules.slice(0, 6).map((g) => T.allow.evidence(g.rule, g.n, g.ms, g.sessions.size)),
      ...skippedTop.length ? [T.allow.skipped(skippedTop.reduce((n, [, c]) => n + c, 0), skippedTop.map(([k]) => k).join(", "))] : []
    ],
    pages: ["tools"],
    scope: "range",
    saving,
    targets: rules.map((g) => ({ key: g.rule, label: g.rule, kind: "rule", note: `${T.allow.note(g.n, g.ms)} \xB7 ${scopeOf(g)}` })),
    prompts: buildPrompts({
      lang,
      summary: T.allow.summary(covered, rules.length),
      items: placements.map((p) => allowRuleItem(lang, { rule: p.g.rule, file: p.file, why: T.allow.why(p.g.n, p.g.ms, p.g.sessions.size) })),
      notes: PROMPT_NOTES[lang].allow
    })
  };
}
function filesActiveIn(store2, range) {
  const out = [];
  for (const s of store2.files.values()) if (Object.keys(s.days).some((d) => d >= range.from && d <= range.to)) out.push(s);
  return out;
}
function tipsFor(tool, T) {
  if (tool === "Bash") return [T.big.tipTail, T.big.tipQuiet, T.big.tipTests, T.big.tipDiff];
  if (tool === "Grep") return [T.big.tipGrep];
  if (tool === "Read") return [T.big.tipRead];
  if (tool === "WebFetch") return [T.big.tipFetch];
  if (tool === "Agent" || tool === "Task") return [T.big.tipAgent];
  if (tool === "Glob") return [T.big.tipGlob];
  return [T.big.tipGeneric(tool)];
}
function toolRecommendations(store2, range, lang, env2) {
  const TT = insightText(lang);
  const T = TT.rec.tools;
  const ctx = new Ctx(store2);
  const files = filesActiveIn(store2, range);
  const days = rangeDays(range);
  const out = [];
  {
    let allRes = 0, allN = 0;
    const readAvg = /* @__PURE__ */ new Map();
    for (const s of files) {
      let res = 0, n = 0;
      for (const b of Object.values(s.days)) {
        const r = b.tools.Read;
        if (r) {
          res += r.res;
          n += r.resN;
        }
      }
      allRes += res;
      allN += n;
      if (n) readAvg.set(s, res / n);
    }
    const avgAll = allN ? allRes / allN : 1500;
    const byFile = /* @__PURE__ */ new Map();
    for (const s of files) {
      const avg = readAvg.get(s) ?? avgAll;
      for (const [file, n] of Object.entries(s.reads)) {
        if (n < REREAD_MIN) continue;
        const a = byFile.get(file) ?? { n: 0, extra: 0, tokens: 0, sessions: /* @__PURE__ */ new Set(), cwds: /* @__PURE__ */ new Map(), top: { sid: s.sessionId, n: 0 } };
        a.n += n;
        a.extra += n - 1;
        a.tokens += (n - 1) * avg;
        a.sessions.add(s.sessionId);
        const cwd = s.cwd ?? store2.mainOf(s.sessionId)?.cwd ?? null;
        if (cwd) a.cwds.set(cwd, (a.cwds.get(cwd) ?? /* @__PURE__ */ new Set()).add(s.sessionId));
        if (n > a.top.n) a.top = { sid: s.sessionId, n };
        byFile.set(file, a);
      }
    }
    if (byFile.size) {
      const list = [...byFile.entries()].map(([file, a]) => ({ file, ...a })).sort((a, b) => b.tokens - a.tokens || a.file.localeCompare(b.file));
      const tokens = Math.round(list.reduce((n, a) => n + a.tokens, 0));
      const extra = list.reduce((n, a) => n + a.extra, 0);
      const sessions2 = new Set(list.flatMap((a) => [...a.sessions])).size;
      const where = (sid) => {
        const t = sessionTitle(store2.mainOf(sid));
        return t ? TT.quote(t) : ctx.projectOfSession.get(sid) ?? sid.slice(0, 8);
      };
      const items = [];
      for (const a of list.slice(0, REREAD_MAX_ITEMS)) {
        const show = homeDisplay(a.file);
        const [cwd, inSessions] = [...a.cwds.entries()].map(([d, set]) => [d, set.size]).sort((x, y) => y[1] - x[1])[0] ?? [null, 0];
        if (cwd && inSessions >= REREAD_NOTE_SESSIONS && a.file.startsWith(cwd + path7.sep)) {
          const rel = a.file.slice(cwd.length + 1);
          items.push(instructionNoteItem(lang, { name: show, file: `${homeDisplay(cwd)}/CLAUDE.md`, section: T.reread.section, text: T.reread.noteText(rel), why: T.reread.whyNote(a.sessions.size, a.extra) }));
        } else {
          items.push(reviewItem({ name: show, action: T.reread.action(show), why: T.reread.whyReview(a.top.n, where(a.top.sid)) }));
        }
      }
      out.push({
        id: stableId("repeated-reads", list.slice(0, REREAD_MAX_ITEMS).map((a) => a.file)),
        severity: tokens >= 2e6 ? "warn" : "info",
        title: T.reread.title(list.length, sessions2),
        detail: T.reread.detail(extra, Math.round(tokens / Math.max(1, extra))),
        evidence: list.slice(0, 6).map((a) => T.reread.evidence(path7.basename(a.file), a.top.n, where(a.top.sid), a.sessions.size)),
        estSavingTokens: tokens,
        pages: ["tools"],
        scope: "range",
        saving: { period: tokens, days, basis: "range" },
        targets: list.slice(0, REREAD_MAX_ITEMS).map((a) => ({ key: a.file, label: homeDisplay(a.file), kind: "file", note: T.reread.note(a.extra, a.sessions.size) })),
        prompts: buildPrompts({
          lang,
          summary: T.reread.summary(list.length, sessions2),
          items,
          notes: items.some((i) => !i.reviewOnly) ? [...PROMPT_NOTES[lang].note("CLAUDE.md"), T.reread.noteRule] : [T.reread.noteRule]
        })
      });
    }
  }
  {
    const big = /* @__PURE__ */ new Map();
    for (const s of files) {
      for (const r of s.bigResults) {
        if (mcpSplit(r.tool)) continue;
        const d = localDate(r.ts);
        if (d < range.from || d > range.to) continue;
        const a = big.get(r.tool) ?? { n: 0, sum: 0, max: 0, ex: [] };
        a.n++;
        a.sum += r.tokens;
        a.max = Math.max(a.max, r.tokens);
        if (a.ex.length < 3) a.ex.push(TT.bigResults.example(r.label, r.tokens, ctx.project(s)));
        big.set(r.tool, a);
      }
    }
    if (big.size) {
      const tools = [...big.entries()].sort((x, y) => y[1].sum - x[1].sum);
      const period = Math.round(tools.reduce((n, [, a]) => n + Math.max(0, a.sum - a.n * BIG_ENOUGH), 0));
      const total = tools.reduce((n, [, a]) => n + a.n, 0);
      const max = Math.max(...tools.map(([, a]) => a.max));
      const claudeMd = env2.userClaudeMd;
      const tips = [];
      for (const [tool] of tools) for (const tip of tipsFor(tool, T)) if (!tips.some((x) => x.text === tip)) tips.push({ tool, text: tip });
      out.push({
        id: stableId("big-outputs", tools.map(([t]) => t)),
        severity: period > 2e6 ? "high" : period > 3e5 ? "warn" : "info",
        title: tools.length === 1 ? T.big.titleOne(tools[0][0], total, max) : T.big.titleMany(total, tools.length, max),
        detail: T.big.detail(period + total * BIG_ENOUGH),
        evidence: tools.slice(0, 4).flatMap(([, a]) => a.ex.slice(0, 2)),
        estSavingTokens: period || void 0,
        pages: ["tools"],
        scope: "range",
        saving: { period, days, basis: "range" },
        targets: tools.map(([tool, a]) => ({ key: tool, label: tool, kind: "tool", note: T.big.note(a.n, a.max) })),
        prompts: buildPrompts({
          lang,
          summary: T.big.summary(total, tools.map(([t]) => t).join(", ")),
          items: tips.map((x) => {
            const a = big.get(x.tool);
            return instructionNoteItem(lang, { name: x.text, file: claudeMd, section: T.big.section, text: x.text, why: T.big.why(x.tool, a.n, a.max) });
          }),
          notes: PROMPT_NOTES[lang].note(claudeMd)
        })
      });
    }
  }
  {
    const agg2 = /* @__PURE__ */ new Map();
    for (const s of files) {
      for (const [d, b] of Object.entries(s.days)) {
        if (d < range.from || d > range.to) continue;
        for (const [tool, t] of Object.entries(b.tools)) {
          if (mcpSplit(tool) || tool === "Agent" || tool === "Task") continue;
          const a = agg2.get(tool) ?? { calls: 0, err: 0, kinds: {} };
          a.calls += t.calls;
          if (tool === "Bash") {
            for (const [k, n] of Object.entries(t.errKinds ?? {})) if (!NOT_TOOL_FAILURE.has(k)) {
              a.err += n;
              a.kinds[k] = (a.kinds[k] ?? 0) + n;
            }
          } else {
            a.err += t.err ?? 0;
            for (const [k, n] of Object.entries(t.errKinds ?? {})) a.kinds[k] = (a.kinds[k] ?? 0) + n;
          }
          agg2.set(tool, a);
        }
      }
    }
    const failing = [...agg2.entries()].filter(([, a]) => a.calls >= FAIL_MIN_CALLS && a.err >= FAIL_MIN_ERRORS && a.err >= a.calls * FAIL_MIN_RATE).sort((x, y) => y[1].err - x[1].err || x[0].localeCompare(y[0]));
    if (failing.length) {
      const reasons = (kinds) => Object.entries(kinds).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${T.fail.kind[k] ?? T.fail.kind.other} (${n})`).join(", ");
      const facts = (tool, a) => T.fail.facts(a.err, a.calls, reasons(a.kinds));
      out.push({
        id: stableId("failing-tools", failing.map(([t]) => t)),
        severity: failing.some(([, a]) => a.err >= a.calls * 0.3) ? "warn" : "info",
        title: failing.length === 1 ? T.fail.titleOne(failing[0][0], failing[0][1].err / failing[0][1].calls) : T.fail.titleMany(failing.length),
        detail: T.fail.detail,
        evidence: failing.map(([tool, a]) => `${tool}: ${facts(tool, a)}`),
        pages: ["tools"],
        scope: "range",
        targets: failing.map(([tool, a]) => ({ key: tool, label: tool, kind: "tool", note: facts(tool, a) })),
        prompts: buildPrompts({
          lang,
          summary: T.fail.summary(failing.length),
          items: failing.map(([tool, a]) => reviewItem({ name: tool, action: T.fail.action(tool), why: T.fail.why(facts(tool, a), Object.keys(a.kinds).sort((x, y) => a.kinds[y] - a.kinds[x])[0] ?? "other") }))
        })
      });
    }
  }
  return out;
}
var ALLOW_MIN_PROMPTS, ALLOW_MAX_RULES, READ_ONLY_CMDS, RUNNER_CMDS, GIT_READ, PKG, NPX_SAFE, SAFE_SCRIPT, TWO_WORD, DENY_PATTERNS, SENSITIVE_PATH, MCP_WRITE, MCP_READ, isReadOnlyMcpTool, median, REREAD_MIN, REREAD_NOTE_SESSIONS, REREAD_MAX_ITEMS, BIG_ENOUGH, FAIL_MIN_CALLS, FAIL_MIN_ERRORS, FAIL_MIN_RATE, NOT_TOOL_FAILURE, rangeDays;
var init_recommend_tools = __esm({
  "server/recommend-tools.ts"() {
    "use strict";
    init_prompts();
    init_analytics();
    init_hook_log();
    init_insights_text();
    init_recommend();
    init_util();
    init_titles();
    ALLOW_MIN_PROMPTS = 2;
    ALLOW_MAX_RULES = 12;
    READ_ONLY_CMDS = /* @__PURE__ */ new Set([
      "ls",
      "pwd",
      "cat",
      "head",
      "tail",
      "wc",
      "rg",
      "grep",
      "tree",
      "du",
      "df",
      "stat",
      "file",
      "which",
      "diff",
      "jq",
      "cd",
      "basename",
      "dirname",
      "realpath",
      "date",
      "whoami",
      "uname"
    ]);
    RUNNER_CMDS = /* @__PURE__ */ new Set(["tsc", "vitest", "jest", "eslint", "pytest", "mypy"]);
    GIT_READ = /* @__PURE__ */ new Set(["status", "diff", "log", "show", "rev-parse", "ls-files", "blame", "describe", "shortlog", "grep"]);
    PKG = /* @__PURE__ */ new Set(["npm", "pnpm", "yarn", "bun"]);
    NPX_SAFE = /* @__PURE__ */ new Set(["tsc", "vitest", "jest", "eslint"]);
    SAFE_SCRIPT = /^(test|tests|lint|typecheck|type-check|tsc|check|build|verify|ci|format:check|fmt:check)(:[\w-]+)?$/;
    TWO_WORD = {
      go: /* @__PURE__ */ new Set(["test", "build", "vet"]),
      cargo: /* @__PURE__ */ new Set(["test", "build", "check", "clippy"]),
      swift: /* @__PURE__ */ new Set(["build", "test"]),
      dotnet: /* @__PURE__ */ new Set(["build", "test"]),
      deno: /* @__PURE__ */ new Set(["test", "check", "lint"]),
      mvn: /* @__PURE__ */ new Set(["test"]),
      ruff: /* @__PURE__ */ new Set(["check"])
    };
    DENY_PATTERNS = [
      /(^|[\s(/])(rm|rmdir|unlink|sudo|su|doas|chmod|chown|chgrp|dd|mkfs\S*|shred|truncate|kill|pkill|killall|curl|wget|ssh|scp|sftp|rsync|nc|ncat|telnet|ftp|eval|exec|source|sh|bash|zsh|fish|xargs|env|osascript|launchctl|crontab|mv|cp|ln|tee|open|npx\s+-y|bunx\s+--bun)(\s|:|$)/i,
      /\bgit\s+(push|reset|clean|checkout|switch|restore|rebase|rm|mv|commit|merge|pull|stash|branch|tag|filter-branch|update-ref|gc|reflog|worktree|submodule|apply|am|cherry-pick|revert|config)\b/i,
      /\b(publish|unpublish|deploy|release|install|uninstall|i|add|remove|upgrade|update|link|unlink|prune|delete|destroy|drop|dlx|create|init|login|logout|token|secret)\b/i,
      // Commands whose arguments can delete files or run any code: find (-delete, -exec), sed -i, awk, interpreters.
      /(^|\s)(find|sed|awk|perl|ruby|node|deno|osascript)(\s|:|$)/i,
      /(^|\s)python\d?(\s|:|$)(?!-m (pytest|mypy)\b)/i,
      /--force\b|--hard\b|--delete\b|-delete\b|--exec\b|-exec\b|--no-verify\b/i,
      /[;&|`<>$]/
    ];
    SENSITIVE_PATH = /(^|\/)(\.ssh|\.aws|\.gnupg|\.kube|\.docker|\.netrc|\.npmrc|\.pypirc|\.env[^/]*|\.config\/gcloud|\.claude\.json|\.credentials[^/]*|keychains?|secrets?|credentials?|tokens?)(\/|$)/i;
    MCP_WRITE = /delete|remove|drop|destroy|write|create|update|insert|upsert|send|post|push|exec|run|deploy|publish|merge|pay|transfer|purchase|upload|move|rename|edit|modify|patch|set|kill|cancel|approve|submit|commit|apply|install|navigate|click|type|fill|press|close|open|computer|javascript|eval|form|input/i;
    MCP_READ = /^(get|list|read|search|find|fetch|query|describe|view|show|lookup|retrieve|count|inspect|browse|preview|whoami|status)(_|-|[A-Z]|$)|_(get|list|search|read)_/i;
    isReadOnlyMcpTool = (tool) => !MCP_WRITE.test(tool) && MCP_READ.test(tool);
    median = (xs) => {
      if (!xs.length) return 0;
      const s = [...xs].sort((a, b) => a - b);
      return s[Math.floor(s.length / 2)];
    };
    REREAD_MIN = 3;
    REREAD_NOTE_SESSIONS = 3;
    REREAD_MAX_ITEMS = 6;
    BIG_ENOUGH = 5e3;
    FAIL_MIN_CALLS = 20;
    FAIL_MIN_ERRORS = 5;
    FAIL_MIN_RATE = 0.15;
    NOT_TOOL_FAILURE = /* @__PURE__ */ new Set(["exit", "timeout"]);
    rangeDays = (range) => Math.max(1, Math.round(((/* @__PURE__ */ new Date(`${range.to}T00:00:00`)).getTime() - (/* @__PURE__ */ new Date(`${range.from}T00:00:00`)).getTime()) / 864e5) + 1);
  }
});

// server/recommend-agents.ts
function modelPrice(model) {
  const m = model.toLowerCase();
  if (/fable-5-2|mythos-5-2/.test(m)) return 8;
  if (/fable|mythos/.test(m)) return 10;
  if (/opus-5-5/.test(m)) return 4;
  if (/opus-(5|4-[5-9])/.test(m)) return 5;
  if (/opus/.test(m)) return 15;
  if (/sonnet-5/.test(m)) return 2;
  if (/sonnet/.test(m)) return 3;
  if (/haiku-5/.test(m)) return 0.1;
  if (/haiku-4/.test(m)) return 1;
  if (/haiku/.test(m)) return 0.8;
  return null;
}
function agentRecommendations(store2, range, lang, env2) {
  const TT = insightText(lang);
  const T = TT.rec.agents;
  const ctx = new Ctx(store2);
  const days = rangeDays2(range);
  const subs = [];
  for (const s of store2.files.values()) if (s.agentId !== null && Object.keys(s.days).some((d) => d >= range.from && d <= range.to)) subs.push(s);
  if (!subs.length) return [];
  const typeOf = (s) => s.meta?.agentType ?? "general-purpose";
  const out = [];
  {
    const by = /* @__PURE__ */ new Map();
    for (const s of subs) {
      const type = typeOf(s);
      if (SKIP_TYPES.has(type)) continue;
      const a = by.get(type) ?? { runs: 0, models: /* @__PURE__ */ new Map(), tools: /* @__PURE__ */ new Map(), dirs: /* @__PURE__ */ new Map(), builtIn: false, launch: /* @__PURE__ */ new Map() };
      a.runs++;
      if (s.meta?.builtIn) a.builtIn = true;
      if (s.meta?.launchModel) a.launch.set(s.meta.launchModel, (a.launch.get(s.meta.launchModel) ?? 0) + 1);
      if (s.cwd) a.dirs.set(s.cwd, (a.dirs.get(s.cwd) ?? 0) + 1);
      for (const [d, b] of Object.entries(s.days)) {
        if (d < range.from || d > range.to) continue;
        for (const [m, u] of Object.entries(b.models)) a.models.set(m, (a.models.get(m) ?? 0) + sumT4(u.t));
        for (const [t, x] of Object.entries(b.tools)) a.tools.set(t, (a.tools.get(t) ?? 0) + x.calls);
      }
      by.set(type, a);
    }
    const rows = [];
    for (const [type, a] of by) {
      if (a.runs < MODEL_MIN_RUNS) continue;
      let edits = 0, reads = 0, bash = 0, consider = 0;
      for (const [t, n] of a.tools) {
        if (NEUTRAL_TOOLS.has(t)) continue;
        consider += n;
        if (EDIT_TOOLS.has(t)) edits += n;
        else if (READ_TOOLS.has(t) || mcpSplit(t) && isReadOnlyMcpTool(mcpSplit(t).tool)) reads += n;
        else if (t === "Bash") bash += n;
      }
      const readShare = consider ? reads / consider : 0;
      const bashShare = consider ? bash / consider : 0;
      const readOnly = edits === 0 && consider > 0 && (readShare >= 0.6 || NAME_HINT.test(type) && readShare + bashShare >= 0.9 && bashShare <= 0.6);
      if (!readOnly) continue;
      let total = 0, top = 0, cost = 0, save = 0, saveCost = 0;
      let topModel = "";
      let topModelTok = 0;
      for (const [m, tok] of a.models) {
        total += tok;
        const p = modelPrice(m);
        if (p !== null) cost += tok * p;
        if (!isTopTier(m) || p === null) continue;
        top += tok;
        save += tok * (1 - SONNET_PRICE / p);
        saveCost += tok * (p - SONNET_PRICE);
        if (tok > topModelTok) {
          topModelTok = tok;
          topModel = m;
        }
      }
      if (!total || top < total * MODEL_MIN_TOP_SHARE || save < MODEL_MIN_SAVING) continue;
      const mix = [...a.tools.entries()].filter(([t]) => !NEUTRAL_TOOLS.has(t)).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([t, n]) => `${mcpSplit(t)?.tool ?? t} ${pct2(n / consider)}`).join(", ");
      const custom = !a.builtIn && !type.includes(":");
      rows.push({ type, a, total, saving: Math.round(save), share: cost ? saveCost / cost : 0, top: shortModel(topModel), readShare, mix, file: custom ? env2.agentFile(type, [...a.dirs.keys()]) : null });
    }
    if (rows.length) {
      rows.sort((x, y) => y.saving - x.saving || x.type.localeCompare(y.type));
      const period = rows.reduce((n, r) => n + r.saving, 0);
      const allTok = rows.reduce((n, r) => n + r.total, 0);
      const saving = { period, days, basis: "range", costShare: rows.reduce((n, r) => n + r.share * r.total, 0) / allTok };
      const facts = (r) => T.model.facts(r.top, r.a.runs, Math.round(r.total / r.a.runs), r.mix);
      const launched = (r) => [...r.a.launch.entries()].sort((x, y) => y[1] - x[1]).map(([m, n]) => `${m} \xD7${n}`).join(", ");
      const items = rows.map((r) => {
        const why = T.model.why(facts(r), r.share, r.saving);
        if (r.file) return agentModelItem(lang, { name: r.type, file: r.file, model: "sonnet", why });
        if (r.a.builtIn) {
          return instructionNoteItem(lang, {
            name: r.type,
            file: env2.userClaudeMd,
            section: T.model.section,
            text: T.model.noteText(r.type),
            why: `${why}. ${T.model.builtInWhy(r.type, launched(r))}`
          });
        }
        if (r.type.includes(":")) return reviewItem({ name: r.type, action: T.model.pluginAction(r.type), why: `${why}. ${T.model.pluginWhy(r.type)}` });
        return reviewItem({ name: r.type, action: T.model.findAction(r.type), why: `${why}. ${T.model.findWhy(r.type, [...r.a.dirs.keys()].map(homeDisplay))}` });
      });
      out.push({
        id: stableId("agent-model", rows.map((r) => r.type)),
        severity: period >= 2e7 ? "high" : period >= 2e6 ? "warn" : "info",
        title: rows.length === 1 ? T.model.titleOne(rows[0].type, rows[0].top) : T.model.titleMany(rows.length),
        detail: T.model.detail(Math.round((1 - SONNET_PRICE / 4) * 100)),
        evidence: rows.map((r) => `${r.type}: ${facts(r)}`),
        estSavingTokens: period,
        pages: ["subagents"],
        scope: "range",
        saving,
        targets: rows.map((r) => ({ key: r.type, label: r.type, kind: "agent", note: `${facts(r)} \xB7 ${T.model.where(r.file, r.a.builtIn, r.type.includes(":"))}` })),
        prompts: buildPrompts({
          lang,
          summary: T.model.summary(rows.length),
          items,
          notes: [...PROMPT_NOTES[lang].agentModel, ...items.some((i) => i.files?.includes(env2.userClaudeMd)) ? PROMPT_NOTES[lang].note(env2.userClaudeMd) : []]
        })
      });
    }
  }
  {
    const withStart = subs.filter((s) => Object.keys(s.startup).length && sumT4(s.total) > 0);
    const short = [];
    for (const s of withStart) {
      if (s.turns > SHORT_TURNS) continue;
      const start = estTokens(Object.values(s.startup).reduce((n, c) => n + c, 0));
      const total = sumT4(s.total);
      const share = Math.min(1, start * Math.max(1, s.turns) / total);
      if (share >= SHORT_SHARE) short.push({ s, start, share });
    }
    if (short.length >= STARTUP_MIN && short.length >= withStart.length * STARTUP_MIN_FRACTION) {
      const startSum = short.reduce((n, x) => n + x.start, 0);
      const per = Math.round(startSum / short.length);
      const byType = /* @__PURE__ */ new Map();
      for (const x of short) {
        const t = typeOf(x.s);
        const a = byType.get(t) ?? { n: 0, start: 0, share: 0 };
        a.n++;
        a.start += x.start;
        a.share += x.share;
        byType.set(t, a);
      }
      const types = [...byType.entries()].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0])).slice(0, 4);
      const avgShare = short.reduce((n, x) => n + x.share, 0) / short.length;
      const period = Math.round(startSum * BATCH_RATIO);
      out.push({
        id: stableId("agent-startup", types.map(([t]) => t)),
        severity: period >= 2e6 ? "warn" : "info",
        title: T.startup.title(short.length, withStart.length),
        detail: T.startup.detail(SHORT_TURNS, avgShare, Math.round(BATCH_RATIO * 100)),
        evidence: types.map(([t, a]) => T.startup.evidence(t, a.n, Math.round(a.start / a.n), a.share / a.n)),
        estSavingTokens: period,
        pages: ["subagents"],
        scope: "range",
        saving: { perSubagent: per, period, days, basis: "range" },
        targets: types.map(([t, a]) => ({ key: t, label: t, kind: "agent", note: T.startup.note(a.n, Math.round(a.start / a.n)) })),
        prompts: buildPrompts({
          lang,
          summary: T.startup.summary(short.length),
          items: [instructionNoteItem(lang, { name: T.startup.name, file: env2.userClaudeMd, section: T.model.section, text: T.startup.noteText, why: T.startup.why(short.length, per) })],
          notes: PROMPT_NOTES[lang].note(env2.userClaudeMd)
        }),
        seeAlso: "startup"
      });
    }
  }
  {
    const bySession = /* @__PURE__ */ new Map();
    for (const s of subs) bySession.set(s.sessionId, [...bySession.get(s.sessionId) ?? [], s]);
    const flagged = [];
    for (const [sid, list] of bySession) {
      const depth = Math.max(...list.map((s) => s.meta?.spawnDepth ?? 1));
      const starts = list.filter((s) => !s.meta?.workflow && typeOf(s) !== "workflow-subagent" && s.firstTs).map((s) => s.firstTs).sort((a, b) => a - b);
      let burst = 0, at = starts[0] ?? list[0].firstTs;
      for (let i = 0, j = 0; i < starts.length; i++) {
        while (starts[i] - starts[j] > BURST_WINDOW_MS) j++;
        if (i - j + 1 > burst) {
          burst = i - j + 1;
          at = starts[j];
        }
      }
      if (depth >= DEEP_DEPTH || burst >= BURST_N) flagged.push({ sid, depth, burst, total: list.length, at });
    }
    if (flagged.length) {
      flagged.sort((a, b) => b.burst - a.burst || b.depth - a.depth || a.sid.localeCompare(b.sid));
      const top = flagged.slice(0, NEST_MAX);
      const name = (sid) => {
        const t = sessionTitle(store2.mainOf(sid));
        return t ? TT.quote(t) : sid.slice(0, 8);
      };
      const facts = (f) => T.nest.facts(f.total, f.burst, f.depth, ctx.projectOfSession.get(f.sid) ?? "", localDate(f.at));
      out.push({
        id: stableId("agent-nesting", top.map((f) => f.sid)),
        severity: flagged.some((f) => f.burst >= BURST_N * 2 || f.depth > DEEP_DEPTH) ? "warn" : "info",
        title: T.nest.title(flagged.length),
        detail: T.nest.detail(BURST_N, Math.round(BURST_WINDOW_MS / 6e4), DEEP_DEPTH),
        evidence: top.map((f) => `${name(f.sid)}: ${facts(f)}`),
        pages: ["subagents"],
        scope: "range",
        targets: top.map((f) => ({ key: f.sid, label: sessionTitle(store2.mainOf(f.sid)) ?? f.sid.slice(0, 8), kind: "session", note: facts(f) })),
        prompts: buildPrompts({
          lang,
          summary: T.nest.summary(flagged.length),
          items: top.map((f) => reviewItem({ name: name(f.sid), action: T.nest.action(name(f.sid)), why: T.nest.why(facts(f), f.sid) }))
        })
      });
    }
  }
  {
    const sessions2 = new Set(subs.map((s) => s.sessionId));
    const ends = /* @__PURE__ */ new Map();
    for (const s of store2.files.values()) {
      if (!sessions2.has(s.sessionId)) continue;
      const m = ends.get(s.sessionId) ?? /* @__PURE__ */ new Map();
      for (const [id, sp] of Object.entries(s.spawns)) if (sp.res) m.set(`t:${id}`, sp.res);
      for (const [id, r] of Object.entries(s.taskEnds ?? {})) m.set(`a:${id}`, r);
      ends.set(s.sessionId, m);
    }
    const by = /* @__PURE__ */ new Map();
    for (const s of subs) {
      const m = ends.get(s.sessionId);
      const res = m?.get(`a:${s.agentId}`) ?? (s.meta?.toolUseId ? m?.get(`t:${s.meta.toolUseId}`) : void 0);
      if (!res) continue;
      const a = by.get(typeOf(s)) ?? { known: 0, error: 0, stopped: 0 };
      a.known++;
      if (res === "error") a.error++;
      if (res === "stopped") a.stopped++;
      by.set(typeOf(s), a);
    }
    const bad = [...by.entries()].filter(([, a]) => a.known >= FAIL_MIN_KNOWN && a.error + a.stopped >= FAIL_MIN_BAD && a.error + a.stopped >= a.known * FAIL_MIN_SHARE).sort((x, y) => y[1].error + y[1].stopped - (x[1].error + x[1].stopped) || x[0].localeCompare(y[0]));
    if (bad.length) {
      const facts = (a) => T.fail.facts(a.known, a.error, a.stopped);
      out.push({
        id: stableId("agent-failing", bad.map(([t]) => t)),
        severity: bad.some(([, a]) => a.error + a.stopped >= a.known * 0.5) ? "warn" : "info",
        title: bad.length === 1 ? T.fail.titleOne(bad[0][0], (bad[0][1].error + bad[0][1].stopped) / bad[0][1].known) : T.fail.titleMany(bad.length),
        detail: T.fail.detail,
        evidence: bad.map(([t, a]) => `${t}: ${facts(a)}`),
        pages: ["subagents"],
        scope: "range",
        targets: bad.map(([t, a]) => ({ key: t, label: t, kind: "agent", note: facts(a) })),
        prompts: buildPrompts({
          lang,
          summary: T.fail.summary(bad.length),
          items: bad.map(([t, a]) => reviewItem({ name: t, action: T.fail.action(t), why: T.fail.why(facts(a), a.error >= a.stopped) }))
        })
      });
    }
  }
  return out;
}
var SONNET_PRICE, isTopTier, MODEL_MIN_RUNS, MODEL_MIN_SAVING, MODEL_MIN_TOP_SHARE, NEUTRAL_TOOLS, READ_TOOLS, EDIT_TOOLS, NAME_HINT, SKIP_TYPES, SHORT_TURNS, SHORT_SHARE, STARTUP_MIN, STARTUP_MIN_FRACTION, BATCH_RATIO, DEEP_DEPTH, BURST_N, BURST_WINDOW_MS, NEST_MAX, FAIL_MIN_KNOWN, FAIL_MIN_BAD, FAIL_MIN_SHARE, rangeDays2, pct2, shortModel;
var init_recommend_agents = __esm({
  "server/recommend-agents.ts"() {
    "use strict";
    init_prompts();
    init_analytics();
    init_insights_text();
    init_recommend();
    init_recommend_tools();
    init_util();
    init_titles();
    SONNET_PRICE = 2;
    isTopTier = (model) => /opus|fable|mythos/i.test(model) && (modelPrice(model) ?? 0) > SONNET_PRICE;
    MODEL_MIN_RUNS = 3;
    MODEL_MIN_SAVING = 3e5;
    MODEL_MIN_TOP_SHARE = 0.5;
    NEUTRAL_TOOLS = /* @__PURE__ */ new Set(["SubagentHandback", "TodoWrite", "ToolSearch", "Skill", "SendMessage", "TaskStop", "TaskOutput", "Monitor", "StructuredOutput"]);
    READ_TOOLS = /* @__PURE__ */ new Set(["Read", "Grep", "Glob", "LS", "WebFetch", "WebSearch", "NotebookRead"]);
    EDIT_TOOLS = /* @__PURE__ */ new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
    NAME_HINT = /explore|search|research|look-?up|fetch|find|docs?\b|scout|reader|review|web|guide|analy|investigat|audit/i;
    SKIP_TYPES = /* @__PURE__ */ new Set(["fork", "workflow-subagent"]);
    SHORT_TURNS = 6;
    SHORT_SHARE = 0.5;
    STARTUP_MIN = 20;
    STARTUP_MIN_FRACTION = 0.25;
    BATCH_RATIO = 0.5;
    DEEP_DEPTH = 3;
    BURST_N = 30;
    BURST_WINDOW_MS = 10 * 6e4;
    NEST_MAX = 5;
    FAIL_MIN_KNOWN = 5;
    FAIL_MIN_BAD = 3;
    FAIL_MIN_SHARE = 0.3;
    rangeDays2 = (range) => Math.max(1, Math.round(((/* @__PURE__ */ new Date(`${range.to}T00:00:00`)).getTime() - (/* @__PURE__ */ new Date(`${range.from}T00:00:00`)).getTime()) / 864e5) + 1);
    pct2 = (x) => `${Math.round(x * 100)}%`;
    shortModel = (m) => m.replace(/^claude-/, "").replace(/-(\d+)-(\d+)$/, " $1.$2").replace(/-(\d+)$/, " $1").replace(/^\w/, (c) => c.toUpperCase());
  }
});

// server/recommend-mcp.ts
import path8 from "node:path";
function mcpParts(s) {
  let m = partsMemo.get(s);
  if (m) return m;
  m = /* @__PURE__ */ new Map();
  const at = (k) => {
    let p = m.get(k);
    if (!p) m.set(k, p = { instr: 0, defs: 0, names: 0 });
    return p;
  };
  for (const [n, c] of Object.entries(s.mcpBlocks)) at(mcpKey(n)).instr += c;
  for (const [k, c] of Object.entries(s.mcpToolDefs ?? {})) at(k).defs += c;
  for (const [k, c] of Object.entries(s.mcpToolNames ?? {})) at(k).names += c;
  partsMemo.set(s, m);
  return m;
}
function upwards(dir) {
  const out = [];
  for (let d = dir, i = 0; i < 12; i++) {
    out.push(d);
    const up = path8.dirname(d);
    if (up === d) break;
    d = up;
  }
  return out;
}
function mcpSource(key, display, env2, cwds) {
  if (display?.startsWith("plugin:")) return { kind: "plugin", plugin: display.split(":")[1] };
  if (key.startsWith("plugin_")) {
    const names3 = Object.keys(env2.enabledPlugins).map((k) => k.split("@")[0]).sort((a, b) => b.length - a.length);
    const p = names3.find((n) => key.startsWith(`plugin_${mcpKey(n)}_`));
    return { kind: "plugin", plugin: p ?? key.slice("plugin_".length).split("_")[0] };
  }
  if (display?.startsWith("claude.ai ") || key.startsWith("claude_ai_")) return { kind: "claudeai" };
  const match = (list) => list.find((n) => mcpKey(n) === key);
  const user = match(env2.mcp.user);
  if (user) return { kind: "user", name: user };
  const local = [];
  let localName;
  for (const [dir, list] of Object.entries(env2.mcp.local)) {
    const n = match(list);
    if (n) {
      local.push(dir);
      localName = n;
    }
  }
  if (localName) return { kind: "local", name: localName, dirs: local.sort() };
  const project = /* @__PURE__ */ new Set();
  let projectName;
  for (const cwd of cwds) {
    for (const d of upwards(cwd)) {
      const n = match(env2.mcp.projectFile(d));
      if (n) {
        project.add(d);
        projectName = n;
        break;
      }
    }
  }
  if (projectName) return { kind: "project", name: projectName, dirs: [...project].sort() };
  return { kind: "unknown" };
}
function mcpRecommendations(store2, range, lang, env2, covered) {
  const TT = insightText(lang);
  const T = TT.rec;
  const idx = usageIndex(store2);
  const w = costWindow(store2, env2.now);
  const ctx = new Ctx(store2);
  const out = [];
  const days = env2.unusedDays;
  const lastText = (last, seen) => last ? T.lastUsed(daysBetween(last, env2.now)) : T.never(seen ? localDate(seen) : null);
  const keyOfPlugin = (p) => Object.keys(env2.enabledPlugins).find((k) => k.split("@")[0] === p && env2.enabledPlugins[k]) ?? null;
  const disp = /* @__PURE__ */ new Map();
  for (const s of store2.files.values()) {
    for (const k of Object.keys(s.mcpBlocks)) disp.set(mcpKey(k), k);
    for (const k of Object.keys(s.mcpIssues ?? {})) disp.set(mcpKey(k), k);
    for (const b of Object.values(s.days)) for (const k of Object.keys(b.mcpServers)) disp.set(mcpKey(k), k);
  }
  const from = env2.now - PROJECTION_DAYS * DAY_MS;
  const recent2 = [...store2.files.values()].filter((s) => s.firstTs >= from && s.firstTs <= env2.now);
  const cwdsOf = /* @__PURE__ */ new Map();
  for (const s of recent2) {
    const cwd = s.cwd ?? store2.mainOf(s.sessionId)?.cwd ?? null;
    for (const k of s.mcpSeen) {
      const set = cwdsOf.get(k) ?? /* @__PURE__ */ new Set();
      if (cwd) set.add(cwd);
      cwdsOf.set(k, set);
    }
  }
  const sources = /* @__PURE__ */ new Map();
  const sourceOf = (key) => {
    let v = sources.get(key);
    if (!v) sources.set(key, v = mcpSource(key, disp.get(key), env2, [...cwdsOf.get(key) ?? []].sort()));
    return v;
  };
  const sourceLabel = (src) => {
    switch (src.kind) {
      case "user":
        return T.mcpSource.user(env2.claudeJsonFile);
      case "local":
        return T.mcpSource.local(src.dirs.map(homeDisplay));
      case "project":
        return T.mcpSource.project(src.dirs.map(homeDisplay));
      case "plugin":
        return T.mcpSource.plugin(src.plugin);
      case "claudeai":
        return T.mcpSource.claudeai;
      default:
        return T.mcpSource.unknown;
    }
  };
  const fails = /* @__PURE__ */ new Map();
  const inRange2 = (ts) => {
    const d = localDate(ts);
    return d >= range.from && d <= range.to;
  };
  for (const s of store2.files.values()) {
    if (!s.firstTs || !inRange2(s.firstTs)) continue;
    for (const k of s.mcpSeen) {
      const f = fails.get(k) ?? { failed: 0, auth: 0, seen: /* @__PURE__ */ new Set(), err: null, errLast: 0 };
      f.seen.add(s.sessionId);
      fails.set(k, f);
    }
    for (const [name, it] of Object.entries(s.mcpIssues ?? {})) {
      const k = mcpKey(name);
      const f = fails.get(k) ?? { failed: 0, auth: 0, seen: /* @__PURE__ */ new Set(), err: null, errLast: 0 };
      f.seen.add(s.sessionId);
      if (it.failed) f.failed++;
      if (it.auth) f.auth++;
      if (it.error && it.last >= f.errLast) {
        f.err = it.error;
        f.errLast = it.last;
      }
      fails.set(k, f);
    }
  }
  const toolErr = /* @__PURE__ */ new Map();
  for (const { b } of ctx.days(range)) {
    for (const [name, t] of Object.entries(b.tools)) {
      const m = mcpSplit(name);
      if (!m) continue;
      const a = toolErr.get(m.server) ?? { calls: 0, err: 0 };
      a.calls += t.calls;
      a.err += t.err ?? 0;
      toolErr.set(m.server, a);
    }
  }
  const inA = /* @__PURE__ */ new Set();
  {
    const rows = [];
    for (const key of [...cwdsOf.keys()].sort()) {
      const last = mcpLastUse(idx, key);
      const seen = idx.mcpSeen.get(key) ?? null;
      if (!unusedFor(last, seen, env2)) continue;
      const src = sourceOf(key);
      if (src.kind === "plugin" && covered.plugins.has(src.plugin)) continue;
      const saving = costOf(w, (s) => charsOf(s, key));
      const part = (f) => costOf(w, (s) => {
        const p = mcpParts(s).get(key);
        return p ? f(p) : 0;
      }).perSession ?? 0;
      rows.push({ key, label: labelOf(key, disp.get(key)), src, last, lt: lastText(last, seen), saving, parts: { instr: part((p) => p.instr), defs: part((p) => p.defs), names: part((p) => p.names) } });
    }
    if (rows.length) {
      rows.sort((a, b) => (b.saving.period ?? 0) - (a.saving.period ?? 0) || a.label.localeCompare(b.label));
      const items = [];
      let removes = false;
      let plugins = false;
      const connectors = rows.filter((r) => r.src.kind === "claudeai");
      const allConnectorsIdle = connectors.length > 0 && [...cwdsOf.keys()].filter((k) => sourceOf(k).kind === "claudeai").every((k) => connectors.some((r) => r.key === k));
      for (const r of rows) {
        const per = r.saving.perSession ?? 0;
        const why = T.unusedMcp.why(r.lt, per);
        const src = r.src;
        if (src.kind === "user") {
          removes = true;
          items.push(removeMcpServerItem(lang, { name: src.name, scope: "user", claudeJson: env2.claudeJsonFile, why }));
        } else if (src.kind === "local") {
          removes = true;
          for (const d of src.dirs) items.push(removeMcpServerItem(lang, { name: src.name, scope: "local", dir: homeDisplay(d), claudeJson: env2.claudeJsonFile, why }));
        } else if (src.kind === "project") for (const d of src.dirs) items.push(disableMcpJsonServerItem(lang, { name: src.name, dir: homeDisplay(d), why }));
        else if (src.kind === "plugin") {
          const pk = keyOfPlugin(src.plugin);
          const pLast = pluginLastUse(idx, src.plugin);
          if (pk && unusedFor(pLast, idx.pluginSeen.get(src.plugin) ?? idx.mcpSeen.get(r.key), env2)) {
            plugins = true;
            items.push(disablePluginItem(lang, { key: pk, why: T.unusedMcp.pluginUnusedWhy(r.label, lastText(pLast, idx.pluginSeen.get(src.plugin) ?? idx.mcpSeen.get(r.key))), settingsFile: env2.settingsFile }));
          } else items.push(reviewItem({ name: r.label, action: T.unusedMcp.pluginAction(r.label, src.plugin), why: T.unusedMcp.pluginWhy(r.lt, pk ?? `${src.plugin}@\u2026`) }));
        } else if (src.kind === "claudeai") {
          if (!allConnectorsIdle) items.push(reviewItem({ name: r.label, action: T.unusedMcp.connectorAction(r.label.replace(/^claude\.ai /, "")), why: T.unusedMcp.connectorWhy(r.lt) }));
        } else items.push(reviewItem({ name: r.label, action: T.unusedMcp.unknownAction(r.label), why: T.unusedMcp.unknownWhy(r.lt) }));
      }
      if (allConnectorsIdle) items.push(disableClaudeAiConnectorsItem(lang, { settingsFile: env2.settingsFile, why: T.unusedMcp.connectorsAllWhy(connectors.length, days) }));
      for (const r of rows) inA.add(r.key);
      const saving = publicSaving(addSavings(rows.map((r) => r.saving)));
      const one = rows.length === 1 ? rows[0] : null;
      const notes = removes ? [PROMPT_NOTES[lang].mcpRemove(env2.claudeJsonFile), PROMPT_NOTES[lang].jq] : [];
      out.push({
        id: stableId("unused-mcp", rows.map((r) => r.key)),
        severity: saving.period ? severityOf(saving) : "info",
        title: one ? T.unusedMcp.titleOne(one.label, one.lt) : T.unusedMcp.titleMany(rows.length, days),
        detail: T.unusedMcp.detail(days),
        evidence: rows.map((r) => T.unusedMcp.evidence(r.label, sourceLabel(r.src), r.lt, r.saving.perSession ?? 0, T.mcpParts(r.parts) || T.unusedMcp.noSize)),
        estSavingTokens: saving.period || void 0,
        pages: ["mcp", "startup"],
        scope: "history",
        saving: saving.perSession || saving.perSubagent ? saving : void 0,
        targets: rows.map((r) => {
          const f = fails.get(r.key);
          const failedN = f ? f.failed + f.auth : 0;
          return {
            key: r.key,
            label: r.label,
            kind: "mcp",
            lastUsed: r.last,
            tokensPerSession: r.saving.perSession,
            note: [sourceLabel(r.src), failedN ? T.unusedMcp.alsoFailed(failedN) : ""].filter(Boolean).join(" \xB7 ")
          };
        }),
        prompts: buildPrompts({ lang, summary: T.unusedMcp.summary(rows.length, days), items, verify: ["claude mcp list", ...plugins ? ["claude plugin list"] : []], notes })
      });
    }
  }
  {
    const rows = [];
    for (const key of /* @__PURE__ */ new Set([...fails.keys(), ...toolErr.keys()])) {
      if (inA.has(key)) continue;
      const f = fails.get(key);
      const e = toolErr.get(key);
      const bad = f ? f.failed + f.auth : 0;
      const total = f?.seen.size ?? 0;
      const failing = !!f && bad >= FAIL_MIN_SESSIONS && bad >= total * FAIL_MIN_SHARE2;
      const erroring = !!e && e.calls >= ERR_MIN_CALLS && e.err >= e.calls * ERR_MIN_SHARE;
      if (!failing && !erroring) continue;
      const facts = [
        failing && f.failed ? T.mcpFailing.failed(f.failed, total, f.err) : "",
        failing && f.auth ? T.mcpFailing.auth(f.auth) : "",
        erroring ? T.mcpFailing.errors(e.err, e.calls) : ""
      ].filter(Boolean).join("; ");
      const share = Math.max(failing ? bad / Math.max(1, total) : 0, erroring ? e.err / e.calls : 0);
      rows.push({ key, label: labelOf(key, disp.get(key)), facts, auth: failing && f.auth >= f.failed, share });
    }
    if (rows.length) {
      rows.sort((a, b) => b.share - a.share || a.label.localeCompare(b.label));
      const name = (r) => {
        const s = sourceOf(r.key);
        return "name" in s ? s.name : r.label;
      };
      const items = rows.map((r) => r.auth ? reviewItem({ name: r.label, action: T.mcpFailing.authAction(r.label), why: T.mcpFailing.authWhy(r.facts, sourceOf(r.key).kind === "claudeai", name(r)) }) : reviewItem({ name: r.label, action: T.mcpFailing.fixAction(r.label), why: T.mcpFailing.fixWhy(r.facts, name(r)) }));
      out.push({
        id: stableId("mcp-failing", rows.map((r) => r.key)),
        severity: rows.some((r) => r.share >= 0.5) ? "warn" : "info",
        title: rows.length === 1 ? T.mcpFailing.titleOne(rows[0].label) : T.mcpFailing.titleMany(rows.length),
        detail: T.mcpFailing.detail,
        evidence: rows.map((r) => T.mcpFailing.evidence(r.label, r.facts)),
        pages: ["mcp"],
        scope: "range",
        targets: rows.map((r) => ({ key: r.key, label: r.label, kind: "mcp", note: r.facts })),
        prompts: buildPrompts({ lang, summary: T.mcpFailing.summary(rows.length), items, verify: ["claude mcp list"] })
      });
    }
  }
  {
    const heavy = /* @__PURE__ */ new Map();
    for (const s of store2.files.values()) {
      for (const r of s.bigResults) {
        const m = mcpSplit(r.tool);
        if (!m || !inRange2(r.ts)) continue;
        const a = heavy.get(m.server) ?? { n: 0, sum: 0, max: 0, tools: /* @__PURE__ */ new Map(), ex: [] };
        a.n++;
        a.sum += r.tokens;
        a.max = Math.max(a.max, r.tokens);
        a.tools.set(m.tool, (a.tools.get(m.tool) ?? 0) + 1);
        if (a.ex.length < 4) a.ex.push(TT.bigResults.example(r.label, r.tokens, ctx.project(s)));
        heavy.set(m.server, a);
      }
    }
    const rangeDays4 = Math.max(1, Math.round(((/* @__PURE__ */ new Date(`${range.to}T00:00:00`)).getTime() - (/* @__PURE__ */ new Date(`${range.from}T00:00:00`)).getTime()) / DAY_MS) + 1);
    for (const [key, a] of [...heavy.entries()].sort((x, y) => y[1].sum - x[1].sum).slice(0, HEAVY_MAX)) {
      const label = labelOf(key, disp.get(key));
      const tools = [...a.tools.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
      const tip = /chrome|browser|playwright|puppeteer/i.test(key) ? T.mcpHeavy.tipBrowser : /github/i.test(key) ? T.mcpHeavy.tipGithub : /figma/i.test(key) ? T.mcpHeavy.tipFigma : T.mcpHeavy.tipGeneric(label);
      const period = Math.max(0, Math.round(a.sum - a.n * HEAVY_ENOUGH));
      out.push({
        id: `big-results-mcp:${key}`,
        severity: a.sum > 2e6 ? "high" : a.sum > 3e5 ? "warn" : "info",
        title: T.mcpHeavy.title(label, a.n, a.max),
        detail: `${T.mcpHeavy.detail(a.sum)} ${tip}`,
        evidence: a.ex,
        estSavingTokens: period || void 0,
        pages: ["mcp", "tools"],
        scope: "range",
        saving: period ? { period, days: rangeDays4, basis: "range" } : void 0,
        targets: tools.map(([t, n]) => ({ key: `mcp__${key}__${t}`, label: t, kind: "mcp", note: `${n}\xD7 > 20K` })),
        prompts: buildPrompts({
          lang,
          summary: T.mcpHeavy.summary(label, a.n),
          items: [reviewItem({ name: label, action: T.mcpHeavy.action(label, tools.slice(0, 3).map(([t]) => t).join(", ")), why: T.mcpHeavy.why(a.n, a.max, tip) })]
        })
      });
    }
  }
  {
    const cards = [];
    for (const key of [...cwdsOf.keys()].sort()) {
      if (inA.has(key)) continue;
      const src = sourceOf(key);
      if (src.kind !== "user") continue;
      const used = /* @__PURE__ */ new Map();
      for (const s of store2.files.values()) {
        let last = 0;
        for (const b of Object.values(s.days)) {
          for (const [k, a] of Object.entries(b.mcpServers)) if (mcpKey(k) === key && a.last > last) last = a.last;
          for (const [k, t] of Object.entries(b.tools)) if (t.calls > 0 && mcpSplit(k)?.server === key) last = Math.max(last, t.last || s.lastTs);
        }
        if (!last) continue;
        const p = ctx.project(s);
        const cwd = store2.mainOf(s.sessionId)?.cwd ?? s.cwd;
        const u = used.get(p) ?? { cwd: null, last: 0 };
        if (!u.cwd && cwd) u.cwd = cwd;
        u.last = Math.max(u.last, last);
        used.set(p, u);
      }
      const loaded = /* @__PURE__ */ new Map();
      for (const s of w.mains) if (s.mcpSeen.includes(key) || charsOf(s, key) > 0) loaded.set(ctx.project(s), (loaded.get(ctx.project(s)) ?? 0) + 1);
      const idle = [...loaded.keys()].filter((p) => !used.has(p));
      const usedLoaded = [...loaded.keys()].filter((p) => used.has(p));
      if (!usedLoaded.length || !idle.length) continue;
      const total = costOf(w, (s) => charsOf(s, key));
      if ((total.perSession ?? 0) < PROJECTS_MIN_TOKENS) continue;
      const avoid = costOf(w, (s) => used.has(ctx.project(s)) ? 0 : charsOf(s, key));
      if (!total.total || avoid.total < total.total * PROJECTS_MIN_AVOIDABLE) continue;
      const label = labelOf(key, disp.get(key));
      const usedProjects = [...used.keys()].sort();
      const usedText = usedProjects.map((p) => `${p} (${lastText(used.get(p).last, null)})`).join(", ");
      const dirs = usedProjects.map((p) => used.get(p).cwd).filter((d) => !!d).slice(0, MAX_PROJECTS).map(homeDisplay);
      const saving = publicSaving({ ...avoid, perSession: total.perSession, perSubagent: total.perSubagent, pctStartup: total.pctStartup });
      const idleSessions = w.mains.filter((s) => !used.has(ctx.project(s)) && loaded.has(ctx.project(s))).length;
      cards.push({
        id: stableId(`mcp-projects:${key}`, usedProjects),
        severity: severityOf(saving),
        title: T.mcpProjects.title(label, usedLoaded.length, loaded.size),
        detail: T.mcpProjects.detail(label, usedProjects),
        evidence: [T.mcpProjects.perSession(total.perSession ?? 0), T.mcpProjects.usedIn(usedText), T.mcpProjects.idle(idle.length, idleSessions)],
        estSavingTokens: saving.period,
        pages: ["mcp", "startup"],
        scope: "history",
        saving,
        targets: [{ key, label, kind: "mcp", lastUsed: mcpLastUse(idx, key), tokensPerSession: total.perSession, note: sourceLabel(src) }],
        prompts: dirs.length ? buildPrompts({
          lang,
          summary: T.mcpProjects.summary(label),
          items: [moveMcpToProjectsItem(lang, { name: src.name, dirs, claudeJson: env2.claudeJsonFile, why: T.mcpProjects.why(total.perSession ?? 0, usedProjects.join(", ")) })],
          verify: ["claude mcp list"],
          notes: [PROMPT_NOTES[lang].mcpRemove(env2.claudeJsonFile), PROMPT_NOTES[lang].jq]
        }) : void 0
      });
    }
    out.push(...cards.sort((a, b) => (b.estSavingTokens ?? 0) - (a.estSavingTokens ?? 0)).slice(0, PROJECTS_MAX_CARDS));
  }
  return out;
}
var FAIL_MIN_SESSIONS, FAIL_MIN_SHARE2, ERR_MIN_CALLS, ERR_MIN_SHARE, HEAVY_MAX, HEAVY_ENOUGH, PROJECTS_MIN_TOKENS, PROJECTS_MIN_AVOIDABLE, PROJECTS_MAX_CARDS, MAX_PROJECTS, partsMemo, charsOf, labelOf;
var init_recommend_mcp = __esm({
  "server/recommend-mcp.ts"() {
    "use strict";
    init_prompts();
    init_analytics();
    init_insights_text();
    init_recommend();
    init_util();
    FAIL_MIN_SESSIONS = 3;
    FAIL_MIN_SHARE2 = 0.25;
    ERR_MIN_CALLS = 10;
    ERR_MIN_SHARE = 0.3;
    HEAVY_MAX = 3;
    HEAVY_ENOUGH = 5e3;
    PROJECTS_MIN_TOKENS = 150;
    PROJECTS_MIN_AVOIDABLE = 0.3;
    PROJECTS_MAX_CARDS = 3;
    MAX_PROJECTS = 6;
    partsMemo = /* @__PURE__ */ new WeakMap();
    charsOf = (s, key) => {
      const p = mcpParts(s).get(key);
      return p ? p.instr + p.defs + p.names : 0;
    };
    labelOf = (key, display) => display ?? (key.startsWith("claude_ai_") ? `claude.ai ${key.slice(10).replace(/_/g, " ")}` : key);
  }
});

// server/recommend-skills.ts
function usedInBucket(b, plugin) {
  if (b.plugins[plugin]) return true;
  const pre = plugin + ":";
  for (const k of Object.keys(b.skills)) if (k.startsWith(pre)) return true;
  for (const k of Object.keys(b.skillLoads)) if (k.startsWith(pre)) return true;
  for (const k of Object.keys(b.mcpServers)) if (isPluginMcp(k, plugin)) return true;
  const tp = `mcp__plugin_${plugin}_`;
  for (const [k, a] of Object.entries(b.tools)) if (k.startsWith(tp) && a.calls > 0) return true;
  return false;
}
function skillRecommendations(store2, range, lang, env2) {
  const T = insightText(lang).rec;
  const idx = usageIndex(store2);
  const w = costWindow(store2, env2.now);
  const out = [];
  const keyOf2 = /* @__PURE__ */ new Map();
  for (const [k, on] of Object.entries(env2.enabledPlugins)) if (on) keyOf2.set(k.split("@")[0], k);
  const lastText = (last, seen) => last ? T.lastUsed(daysBetween(last, env2.now)) : T.never(seen ? localDate(seen) : null);
  const days = env2.unusedDays;
  const unusedPlugins = /* @__PURE__ */ new Set();
  const pluginCost = (name) => costOf(w, (s) => (s.skillsByPlugin[name] ?? 0) + (s.startup[hookPluginKey(name)] ?? 0) + mcpChars(s, name));
  {
    const rows = [];
    for (const [name, key] of keyOf2) {
      const cost = pluginCost(name);
      if (!cost.perSession && !cost.perSubagent) continue;
      const last = pluginLastUse(idx, name);
      const seen = idx.pluginSeen.get(name) ?? null;
      if (!unusedFor(last, seen, env2)) continue;
      unusedPlugins.add(name);
      const lt = lastText(last, seen);
      const parts = T.parts({
        skills: costOf(w, (s) => s.skillsByPlugin[name] ?? 0).perSession ?? 0,
        hook: costOf(w, (s) => s.startup[hookPluginKey(name)] ?? 0).perSession ?? 0,
        mcp: costOf(w, (s) => mcpChars(s, name)).perSession ?? 0
      });
      rows.push({
        target: { key, label: name, kind: "plugin", lastUsed: last, tokensPerSession: cost.perSession },
        saving: cost,
        ev: T.unusedPlugins.evidence(name, lt, cost.perSession ?? 0, parts),
        item: disablePluginItem(lang, { key, why: T.unusedPlugins.why(lt, cost.perSession ?? 0), settingsFile: env2.settingsFile })
      });
    }
    if (rows.length) {
      rows.sort((a, b) => (b.saving.period ?? 0) - (a.saving.period ?? 0));
      const saving = addSavings(rows.map((r) => r.saving));
      const one = rows.length === 1 ? rows[0] : null;
      out.push({
        id: stableId("unused-plugins", rows.map((r) => r.target.key)),
        severity: severityOf(saving),
        title: one ? T.unusedPlugins.titleOne(one.target.label, lastText(one.target.lastUsed ?? null, idx.pluginSeen.get(one.target.label))) : T.unusedPlugins.titleMany(rows.length, days),
        detail: T.unusedPlugins.detail(days),
        evidence: rows.map((r) => r.ev),
        estSavingTokens: saving.period,
        pages: ["skills", "startup"],
        scope: "history",
        saving,
        targets: rows.map((r) => r.target),
        prompts: buildPrompts({ lang, summary: T.unusedPlugins.summary(rows.length, days), items: rows.map((r) => r.item), verify: ["claude plugin list"] })
      });
    }
  }
  const listed = /* @__PURE__ */ new Set();
  for (const s of w.mains) for (const k of Object.keys(s.skillsByName ?? {})) listed.add(k);
  for (const s of w.subs) for (const k of Object.keys(s.skillsByName ?? {})) listed.add(k);
  const skillCost = /* @__PURE__ */ new Map();
  const perSkill = (k) => {
    let v = skillCost.get(k);
    if (v === void 0) skillCost.set(k, v = costOf(w, (s) => s.skillsByName?.[k] ?? 0).perSession ?? 0);
    return v;
  };
  const skillUnused = (k) => unusedFor(skillLastUse(idx, k), idx.skillSeen.get(k), env2);
  const groups = /* @__PURE__ */ new Map();
  for (const k of listed) {
    const i = k.indexOf(":");
    if (i >= 0 && unusedPlugins.has(k.slice(0, i))) continue;
    const name = i < 0 ? k : k.slice(i + 1);
    groups.set(name, [...groups.get(name) ?? [], k]);
  }
  const dup = [...groups.entries()].filter(([, ks]) => ks.length > 1).sort((a, b) => a[0].localeCompare(b[0]));
  const inDup = new Set(dup.flatMap(([, ks]) => ks));
  const byPlugin = /* @__PURE__ */ new Map();
  const own = [];
  for (const k of [...listed].sort()) {
    const i = k.indexOf(":");
    if (i < 0) own.push(k);
    else byPlugin.set(k.slice(0, i), [...byPlugin.get(k.slice(0, i)) ?? [], k]);
  }
  const hookCards = /* @__PURE__ */ new Set();
  {
    const rw = rangeWindow(store2, range);
    const ctx = new Ctx(store2);
    const hookPlugins = /* @__PURE__ */ new Set();
    for (const s of rw.mains) for (const k of Object.keys(s.startup)) if (k.startsWith("hook:plugin:")) hookPlugins.add(k.slice("hook:plugin:".length));
    const cwdOf = /* @__PURE__ */ new Map();
    for (const name of [...hookPlugins].sort()) {
      if (unusedPlugins.has(name)) continue;
      const hk = hookPluginKey(name);
      const withHook = rw.mains.filter((s) => (s.startup[hk] ?? 0) > 0);
      if (!withHook.length) continue;
      const per = Math.round(withHook.reduce((n, s) => n + estTokens(s.startup[hk]), 0) / withHook.length);
      if (per < HOOK_MIN_TOKENS) continue;
      const usedSids = /* @__PURE__ */ new Set();
      const usedProjects = /* @__PURE__ */ new Set();
      for (const { s, b } of ctx.days(range)) {
        if (!usedInBucket(b, name)) continue;
        usedSids.add(s.sessionId);
        const p = ctx.project(s);
        usedProjects.add(p);
        const main = store2.mainOf(s.sessionId);
        if (main?.cwd && !cwdOf.has(p)) cwdOf.set(p, main.cwd);
      }
      const total = costOf(rw, (s) => s.startup[hk] ?? 0, "range");
      const avoid = costOf(rw, (s) => usedProjects.has(ctx.project(s)) ? 0 : s.startup[hk] ?? 0, "range");
      if (!total.total || avoid.total < total.total * HOOK_MIN_AVOIDABLE) continue;
      const usedIn = withHook.filter((s) => usedSids.has(s.sessionId)).length;
      hookCards.add(name);
      const pluginSkills = byPlugin.get(name) ?? [];
      const unusedSkills = pluginSkills.filter(skillUnused).length;
      const projects = [...usedProjects].sort();
      const saving = publicSaving({ ...avoid, perSession: per, pctStartup: rw.avgStartup ? Math.min(1, per / rw.avgStartup) : void 0 });
      const key = keyOf2.get(name);
      const items = key ? [
        disablePluginItem(lang, { key, why: T.hookContext.why(per, usedIn, withHook.length), settingsFile: env2.settingsFile }),
        ...projects.filter((p) => cwdOf.has(p)).slice(0, MAX_PROJECTS2).map((p) => enablePluginInProjectItem(lang, { key, dir: homeDisplay(cwdOf.get(p)), why: T.hookContext.whyEnable(p) }))
      ] : [];
      out.push({
        id: `hook-context:${name}`,
        severity: severityOf(saving),
        title: T.hookContext.title(name, per),
        detail: T.hookContext.detail(name, usedIn, withHook.length, projects),
        evidence: [
          T.hookContext.perSession(per),
          T.hookContext.sessions(usedIn, withHook.length),
          ...unusedSkills ? [T.hookContext.skillsUnused(unusedSkills, pluginSkills.length, days)] : []
        ],
        fix: key ? void 0 : T.hookContext.fix(name, `${name}@\u2026`),
        estSavingTokens: saving.period,
        pages: ["skills", "startup"],
        scope: "range",
        saving,
        targets: [{ key: key ?? name, label: name, kind: "plugin", lastUsed: pluginLastUse(idx, name), tokensPerSession: per }],
        prompts: items.length ? buildPrompts({ lang, summary: T.hookContext.summary(name, per), items, verify: ["claude plugin list"] }) : void 0
      });
    }
  }
  for (const [plugin, keys] of byPlugin) {
    if (unusedPlugins.has(plugin) || hookCards.has(plugin) || plugin === OWN_SKILLS) continue;
    const key = keyOf2.get(plugin);
    if (!key) continue;
    const unused = keys.filter(skillUnused);
    if (unused.length < 2 || unused.length * 2 <= keys.length) continue;
    const used = keys.filter((k) => !unused.includes(k));
    const short = (k) => k.slice(plugin.length + 1);
    const usedText = used.map((k) => `${short(k)} (${lastText(skillLastUse(idx, k), idx.skillSeen.get(k))})`).join(", ");
    const cost = pluginCost(plugin);
    const saving = publicSaving(cost);
    const unusedTok = unused.reduce((n, k) => n + perSkill(k), 0);
    const listTok = keys.reduce((n, k) => n + perSkill(k), 0);
    const mcpLast = (() => {
      let last = 0;
      for (const [k, ts] of idx.mcp) if (isPluginMcp(k, plugin) && ts > last) last = ts;
      for (const [k, ts] of idx.tool) if (k.startsWith(`mcp__plugin_${plugin}_`) && ts > last) last = ts;
      return last || null;
    })();
    const targets = unused.map((k) => ({ key: k, label: short(k), kind: "skill", lastUsed: skillLastUse(idx, k), tokensPerSession: perSkill(k) })).sort((a, b) => (b.tokensPerSession ?? 0) - (a.tokensPerSession ?? 0));
    out.push({
      id: stableId(`unused-skills:${plugin}`, unused),
      severity: severityOf(saving),
      title: T.unusedSkills.title(plugin, unused.length, keys.length, days),
      detail: T.unusedSkills.detail(plugin, unusedTok, listTok),
      evidence: [
        used.length ? T.unusedSkills.stillUsed(usedText) : T.unusedSkills.noneUsed,
        ...mcpLast ? [T.unusedSkills.mcpUsed(lastText(mcpLast, null))] : []
      ],
      estSavingTokens: saving.period,
      pages: ["skills"],
      scope: "history",
      saving,
      targets,
      prompts: buildPrompts({
        lang,
        summary: T.unusedSkills.summary(plugin, unused.length, keys.length, days),
        items: [disablePluginItem(lang, { key, why: T.unusedSkills.why(unused.length, keys.length, usedText), settingsFile: env2.settingsFile })],
        verify: ["claude plugin list"]
      })
    });
  }
  {
    const unusedOwn = own.filter((k) => !inDup.has(k) && skillUnused(k) && env2.ownSkillExists(k));
    if (unusedOwn.length) {
      const rows = unusedOwn.map((k) => {
        const last = skillLastUse(idx, k);
        const lt = lastText(last, idx.skillSeen.get(k));
        return { k, last, lt, per: perSkill(k) };
      }).sort((a, b) => b.per - a.per);
      const set = new Set(unusedOwn);
      const saving = publicSaving(costOf(w, (s) => {
        let n = 0;
        for (const [k, c] of Object.entries(s.skillsByName ?? {})) if (set.has(k)) n += c;
        return n;
      }));
      out.push({
        id: stableId("unused-own-skills", unusedOwn),
        severity: severityOf(saving),
        title: T.unusedOwn.title(unusedOwn.length, days),
        detail: T.unusedOwn.detail(env2.skillsDir),
        evidence: rows.map((r) => T.unusedOwn.evidence(r.k, r.lt, r.per)),
        estSavingTokens: saving.period,
        pages: ["skills"],
        scope: "history",
        saving,
        targets: rows.map((r) => ({ key: r.k, label: r.k, kind: "ownSkill", lastUsed: r.last, tokensPerSession: r.per })),
        prompts: buildPrompts({
          lang,
          summary: T.unusedOwn.summary(unusedOwn.length, days),
          items: rows.map((r) => moveSkillItem(lang, { name: r.k, skillsDir: env2.skillsDir, why: T.unusedOwn.why(r.lt, r.per) })),
          verify: [`ls ${env2.skillsDir}`]
        })
      });
    }
  }
  {
    if (dup.length) {
      const label = (k) => k.includes(":") ? k.split(":")[0] : T.duplicates.own;
      const items = [];
      const targets = [];
      const movable = /* @__PURE__ */ new Set();
      const evidence = [];
      for (const [name, ks] of dup) {
        const ranked = [...ks].sort((a, b) => (skillLastUse(idx, b) ?? 0) - (skillLastUse(idx, a) ?? 0) || Number(!b.includes(":")) - Number(!a.includes(":")) || a.localeCompare(b));
        const keep = ranked[0];
        const keepLast = lastText(skillLastUse(idx, keep), idx.skillSeen.get(keep));
        evidence.push(T.duplicates.evidence(name, ks.map((k) => T.duplicates.copy(label(k), lastText(skillLastUse(idx, k), idx.skillSeen.get(k)))).join("; ")));
        for (const k of ranked.slice(1)) {
          const isOwn = !k.includes(":");
          targets.push({ key: k, label: `${name} \xB7 ${label(k)}`, kind: isOwn ? "ownSkill" : "skill", lastUsed: skillLastUse(idx, k), tokensPerSession: perSkill(k), note: `${label(keep)}: ${keepLast}` });
          if (isOwn && env2.ownSkillExists(k)) {
            movable.add(k);
            items.push(moveSkillItem(lang, { name: k, skillsDir: env2.skillsDir, why: T.duplicates.whyMove(label(keep), keepLast) }));
          } else {
            items.push(reviewItem({ name: k, action: T.duplicates.reviewAction(k, keep), why: T.duplicates.whyReview(isOwn ? label(keep) : label(k)) }));
          }
        }
      }
      const saving = publicSaving(costOf(w, (s) => {
        let n = 0;
        for (const k of movable) n += s.skillsByName?.[k] ?? 0;
        return n;
      }));
      out.push({
        id: stableId("duplicate-skills", dup.flatMap(([, ks]) => ks)),
        severity: saving.period ? severityOf(saving) : "info",
        title: T.duplicates.title(dup.length),
        detail: T.duplicates.detail,
        evidence,
        estSavingTokens: saving.period || void 0,
        pages: ["skills"],
        scope: "history",
        saving: saving.perSession ? saving : void 0,
        targets,
        prompts: buildPrompts({ lang, summary: T.duplicates.summary(dup.length), items })
      });
    }
  }
  return out;
}
var HOOK_MIN_TOKENS, HOOK_MIN_AVOIDABLE, MAX_PROJECTS2, mcpChars;
var init_recommend_skills = __esm({
  "server/recommend-skills.ts"() {
    "use strict";
    init_prompts();
    init_analytics();
    init_i18n();
    init_insights_text();
    init_recommend();
    init_util();
    HOOK_MIN_TOKENS = 300;
    HOOK_MIN_AVOIDABLE = 0.2;
    MAX_PROJECTS2 = 6;
    mcpChars = (s, plugin) => {
      let n = 0;
      for (const [k, c] of Object.entries(s.mcpBlocks)) if (isPluginMcp(k, plugin)) n += c;
      return n;
    };
  }
});

// server/recommend-startup.ts
function fileKind(p, type) {
  const t = type.toLowerCase();
  if (t === "automem" || t === "memory") return "memory";
  if (t === "managed") return "managed";
  if (/[\\/]rules[\\/][^\\/]+\.md$/i.test(p)) return "rules";
  if (t === "local" || /CLAUDE\.local\.md$/i.test(p)) return "local";
  if (t === "user") return "user";
  return "project";
}
function startupRecommendations(store2, range, lang, env2, o) {
  const TT = insightText(lang);
  const T = TT.rec;
  const w = costWindow(store2, env2.now);
  const out = [];
  const pct3 = Math.round(COMPRESS_RATIO * 100);
  {
    const files = /* @__PURE__ */ new Map();
    for (const s of [...w.mains, ...w.subs]) {
      for (const [p, f] of Object.entries(s.memoryFiles ?? {})) {
        const kind = fileKind(p, f.type);
        const cur = files.get(p) ?? { kind, chars: f.chars, at: s.firstTs, sessions: 0, project: projectOf(s.cwd, s.projectDir) };
        if (s.firstTs >= cur.at) {
          cur.chars = f.chars;
          cur.at = s.firstTs;
          cur.kind = kind;
          cur.project = projectOf(s.cwd, s.projectDir);
        }
        if (s.agentId === null) cur.sessions++;
        files.set(p, cur);
      }
    }
    const big = (want, min) => [...files.entries()].filter(([, f]) => want(f.kind) && estTokens(f.chars) > min).map(([p, f]) => ({ p, show: homeDisplay(p), ...f, tok: estTokens(f.chars), saving: scale(publicSaving(costOf(w, (s) => s.memoryFiles?.[p]?.chars ?? 0)), COMPRESS_RATIO) })).sort((a, b) => b.tok - a.tok || a.p.localeCompare(b.p));
    const kindLabel = (k) => T.fileKind[k] ?? T.fileKind.project;
    const instr = big((k) => k !== "memory" && k !== "managed", FILE_MIN_TOKENS);
    if (instr.length) {
      const saving = addSavings(instr.map((f) => f.saving));
      const one = instr.length === 1 ? instr[0] : null;
      out.push({
        id: stableId("big-instructions", instr.map((f) => f.p)),
        severity: severityOf(saving),
        title: one ? T.bigInstructions.titleOne(one.show, one.tok) : T.bigInstructions.titleMany(instr.length, FILE_MIN_TOKENS),
        detail: T.bigInstructions.detail(pct3),
        evidence: instr.map((f) => T.bigInstructions.evidence(f.show, kindLabel(f.kind), f.tok, f.sessions)),
        estSavingTokens: saving.period || void 0,
        pages: ["startup"],
        scope: "history",
        saving,
        targets: instr.map((f) => ({ key: f.p, label: f.show, kind: "file", tokensPerSession: f.tok, note: kindLabel(f.kind) })),
        prompts: buildPrompts({
          lang,
          summary: T.bigInstructions.summary(instr.length),
          items: instr.map((f) => compressInstructionsItem(lang, { path: f.show, why: T.bigInstructions.why(kindLabel(f.kind), f.tok) })),
          verify: [`wc -c ${instr.map((f) => shq(f.show)).join(" ")}`],
          notes: PROMPT_NOTES[lang].compress
        })
      });
    }
    const mem = big((k) => k === "memory", MEMORY_MIN_TOKENS);
    if (mem.length) {
      const saving = addSavings(mem.map((f) => f.saving));
      const tok = Math.max(...mem.map((f) => f.tok));
      out.push({
        id: stableId("big-memory", mem.map((f) => f.p)),
        severity: severityOf(saving),
        title: T.bigMemory.title(tok),
        detail: T.bigMemory.detail(pct3),
        evidence: mem.map((f) => T.bigMemory.evidence(f.show, f.tok, f.sessions)),
        estSavingTokens: saving.period || void 0,
        pages: ["startup"],
        scope: "history",
        saving,
        targets: mem.map((f) => ({ key: f.p, label: f.show, kind: "file", tokensPerSession: f.tok, note: f.project })),
        prompts: buildPrompts({
          lang,
          summary: T.bigMemory.summary(mem.length),
          items: mem.map((f) => consolidateMemoryItem(lang, { path: f.show, why: T.bigMemory.why(f.tok) })),
          verify: [`wc -c ${mem.map((f) => shq(f.show)).join(" ")}`],
          notes: PROMPT_NOTES[lang].memory
        })
      });
    }
  }
  {
    const keys = /* @__PURE__ */ new Set();
    for (const s of [...w.mains, ...w.subs]) for (const k of Object.keys(s.startup)) if (k.startsWith("hook:event:")) keys.add(k);
    const rows2 = [];
    for (const key of [...keys].sort()) {
      const withIt = w.mains.filter((s) => (s.startup[key] ?? 0) > 0);
      const subsWith = w.subs.filter((s) => (s.startup[key] ?? 0) > 0);
      const pool = withIt.length ? withIt : subsWith;
      if (!pool.length) continue;
      const per = Math.round(pool.reduce((n, s) => n + estTokens(s.startup[key]), 0) / pool.length);
      if (per < HOOK_MIN_TOKENS2) continue;
      rows2.push({ key, name: key.slice("hook:event:".length) || T.hookEvent.unnamed, per, sessions: withIt.length, saving: costOf(w, (s) => s.startup[key] ?? 0) });
    }
    if (rows2.length) {
      rows2.sort((a, b) => b.per - a.per);
      const saving = publicSaving(addSavings(rows2.map((r) => r.saving)));
      const per = rows2.reduce((n, r) => n + r.per, 0);
      out.push({
        id: stableId("hook-event-context", rows2.map((r) => r.key)),
        severity: severityOf(saving),
        title: rows2.length === 1 ? T.hookEvent.titleOne(rows2[0].name, rows2[0].per) : T.hookEvent.titleMany(rows2.length, per),
        detail: T.hookEvent.detail,
        evidence: rows2.map((r) => T.hookEvent.evidence(r.name, r.per, r.sessions)),
        estSavingTokens: saving.period || void 0,
        pages: ["startup"],
        scope: "history",
        saving,
        targets: rows2.map((r) => ({ key: r.key, label: r.name, kind: "hook", tokensPerSession: r.per })),
        prompts: buildPrompts({
          lang,
          summary: T.hookEvent.summary(rows2.length),
          items: rows2.map((r) => reviewItem({ name: r.name, action: T.hookEvent.action(r.name), why: T.hookEvent.why(r.per, env2.settingsFile) }))
        })
      });
    }
  }
  const rows = o.attr.startupContext;
  const skillRow = rows.find((r) => r.key === STARTUP.skills);
  if (skillRow && skillRow.total > 0) {
    const rw = rangeWindow(store2, range);
    const byPlugin = /* @__PURE__ */ new Map();
    for (const s of [...rw.mains, ...rw.subs]) for (const [p, c] of Object.entries(s.skillsByPlugin)) byPlugin.set(p, (byPlugin.get(p) ?? 0) + c);
    const top = [...byPlugin.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const per = Number(skillRow.extra?.perSession ?? 0);
    const perSub = Number(skillRow.extra?.perSubagent ?? 0);
    const listing = o.skillCards.filter((c) => /^(unused-plugins|unused-skills|unused-own-skills):/.test(c.id) && c.saving?.basis === "projection");
    const actionable = listing.length ? addSavings(listing.map((c) => c.saving)) : null;
    out.push({
      id: "startup-skill-listing",
      pages: ["startup"],
      severity: skillRow.total > 5e6 ? "high" : "warn",
      title: TT.skillListing.title(per, perSub),
      detail: TT.skillListing.detail(perSub > 0, skillRow.total),
      evidence: [
        ...actionable?.perSession ? [T.skillListing.actionable(actionable.perSession)] : [],
        ...top.map(([p, c]) => TT.skillListing.evidence(skillGroupLabel(p, lang), estTokens(c)))
      ],
      fix: TT.skillListing.fix,
      scope: "range",
      saving: actionable?.perSession ? actionable : void 0,
      seeAlso: "skills"
    });
  }
  {
    const perMain = rows.reduce((n, r) => n + Number(r.extra?.perSession ?? 0), 0);
    const perSub = rows.reduce((n, r) => n + Number(r.extra?.perSubagent ?? 0), 0);
    const startupTotal = rows.reduce((n, r) => n + r.total, 0);
    if (perMain > 0) {
      const rw = rangeWindow(store2, range);
      const subTotal = rows.reduce((n, r) => n + Number(r.extra?.subagentTokens ?? 0), 0);
      const mainTotal = startupTotal - subTotal;
      const subs = rw.subs.length;
      const heavySubs = subs >= SUBS_MIN && subTotal > mainTotal;
      const top = [...rows].sort((a, b) => Number(b.extra?.perSession ?? 0) - Number(a.extra?.perSession ?? 0)).slice(0, 5);
      out.push({
        id: "startup-total",
        pages: ["startup"],
        severity: heavySubs ? "warn" : "info",
        title: heavySubs ? T.startupTotal.titleSubs(subs, subTotal) : TT.startupTotal.title(perMain, perSub),
        detail: TT.startupTotal.detail(startupTotal),
        evidence: [
          ...heavySubs ? [TT.startupTotal.title(perMain, perSub)] : [],
          ...subs && perSub ? [T.startupTotal.subagents(subs, perSub, subTotal)] : [],
          ...top.map((r) => TT.startupTotal.evidence(r.label, Number(r.extra?.perSession ?? 0), Number(r.extra?.perSubagent ?? 0)))
        ],
        fix: TT.startupTotal.fix,
        scope: "range"
      });
    }
  }
  return out;
}
var FILE_MIN_TOKENS, MEMORY_MIN_TOKENS, COMPRESS_RATIO, HOOK_MIN_TOKENS2, SUBS_MIN, scale;
var init_recommend_startup = __esm({
  "server/recommend-startup.ts"() {
    "use strict";
    init_prompts();
    init_i18n();
    init_insights_text();
    init_recommend();
    init_util();
    FILE_MIN_TOKENS = 2e3;
    MEMORY_MIN_TOKENS = 1e3;
    COMPRESS_RATIO = 0.4;
    HOOK_MIN_TOKENS2 = 300;
    SUBS_MIN = 20;
    scale = (s, f) => {
      const r = (n) => n ? Math.round(n * f) : void 0;
      const out = { ...s, perSession: r(s.perSession), perSubagent: r(s.perSubagent), period: r(s.period), pctStartup: s.pctStartup ? s.pctStartup * f : void 0 };
      for (const k of Object.keys(out)) if (out[k] === void 0) delete out[k];
      return out;
    };
  }
});

// shared/forecast.ts
function windowSeries(points, w) {
  const out = [];
  for (const p of points) {
    const pct3 = w === "5h" ? p.fiveHourPct : p.sevenDayPct;
    if (pct3 == null || !Number.isFinite(pct3)) continue;
    const r = w === "5h" ? p.fiveHourResetsAt : p.sevenDayResetsAt;
    out.push({ ts: p.ts, pct: pct3, resetsAt: r ?? null });
  }
  return out.sort((a, b) => a.ts - b.ts);
}
function isNewWindow(a, b, w) {
  if (a.resetsAt != null && b.resetsAt != null && Math.abs(b.resetsAt - a.resetsAt) > FORECAST_TUNING[w].resetTolerance) return true;
  if (a.resetsAt != null && b.ts >= a.resetsAt && b.resetsAt == null) return true;
  return b.pct < a.pct - 0.5;
}
function splitWindows(series, w) {
  const out = [];
  let cur = [];
  for (const p of series) {
    if (cur.length && isNewWindow(cur[cur.length - 1], p, w)) {
      out.push(cur);
      cur = [];
    }
    cur.push(p);
  }
  if (cur.length) out.push(cur);
  return out;
}
function linearFit(pts) {
  let sw = 0, sx = 0, sy = 0;
  for (const p of pts) {
    sw += p.w;
    sx += p.w * p.x;
    sy += p.w * p.y;
  }
  if (pts.length < 2 || !(sw > 0)) return null;
  const mx = sx / sw, my = sy / sw;
  let sxx = 0, sxy = 0, syy = 0;
  for (const p of pts) {
    const dx = p.x - mx, dy = p.y - my;
    sxx += p.w * dx * dx;
    sxy += p.w * dx * dy;
    syy += p.w * dy * dy;
  }
  if (!(sxx > 0)) return null;
  const slope = sxy / sxx;
  const r2 = syy > 0 ? Math.min(1, sxy * sxy / (sxx * syy)) : 1;
  return { slope, intercept: my - slope * mx, r2 };
}
function tokensBetween(usage, a, b) {
  if (!(b > a)) return 0;
  let sum = 0;
  for (const u of usage) {
    const len = u.end - u.start;
    if (len <= 0 || u.end <= a || u.start >= b) continue;
    sum += u.tokens * ((Math.min(b, u.end) - Math.max(a, u.start)) / len);
  }
  return sum;
}
function forecastWindow(inp) {
  const { window: w, now } = inp;
  const cfg = FORECAST_TUNING[w];
  const cur = inp.current;
  if (!cur || cur.pct == null || !Number.isFinite(cur.pct)) return none(w, null, null);
  const curTs = Math.min(Number.isFinite(cur.ts) ? cur.ts : now, now);
  const pctNow = Math.max(0, cur.pct);
  const resetsAt = cur.resetsAt != null && Number.isFinite(cur.resetsAt) ? cur.resetsAt : null;
  if (resetsAt != null && now >= resetsAt) return { ...none(w, 0, null), reset: true };
  const series = inp.history.filter((p) => Number.isFinite(p.ts) && Number.isFinite(p.pct)).map((p) => ({ ...p, ts: Math.min(p.ts, now) }));
  series.sort((a, b) => a.ts - b.ts);
  const last = series[series.length - 1];
  const latest = { ts: curTs, pct: pctNow, resetsAt };
  if (!last || last.ts < curTs || last.pct !== pctNow || last.resetsAt !== resetsAt) {
    if (last && last.ts >= curTs) latest.ts = last.ts;
    series.push(latest);
  }
  const wins = splitWindows(series, w);
  let seg = wins[wins.length - 1];
  if (resetsAt != null) seg = seg.filter((p) => p.ts >= resetsAt - WINDOW_MS[w] - cfg.resetTolerance);
  if (!seg.length) seg = [latest];
  const n = seg.length;
  const anchor = seg[n - 1];
  const span = anchor.ts - seg[0].ts;
  if (anchor.pct >= 100) {
    const first2 = seg.find((p) => p.pct >= 100) ?? anchor;
    return { window: w, pct: anchor.pct, resetsAt, ratePerHour: 0, hitsAt: Math.min(first2.ts, now), pctAtReset: 100, confidence: "high", basis: "limits", points: n, exhausted: true };
  }
  let rate = 0;
  let basis = "none";
  let confidence = "low";
  const fit = linearFit(seg.map((p) => ({ x: (p.ts - anchor.ts) / H, y: p.pct, w: Math.pow(0.5, (anchor.ts - p.ts) / cfg.halfLife) })));
  const rise = anchor.pct - seg[0].pct;
  const limitsOk = !!fit && (n >= 3 && span >= cfg.minSpan || n === 2 && span >= 3 * cfg.minSpan);
  if (limitsOk && fit) {
    basis = "limits";
    rate = Math.max(0, fit.slope);
    confidence = n >= 6 && span >= cfg.goodSpan && (fit.r2 >= 0.5 || rise <= 2) ? "high" : n >= 3 && span >= 1.5 * cfg.minSpan ? "medium" : "low";
  } else if (n >= 2) {
    const spent = inp.usage ? tokensBetween(inp.usage, seg[0].ts, anchor.ts) : 0;
    const recentFrom = now - cfg.recent;
    const recent2 = inp.usage ? tokensBetween(inp.usage, recentFrom, now) : 0;
    if (rise > 0 && spent > 0) {
      basis = "tokens";
      rate = rise / spent * (recent2 / (cfg.recent / H));
      confidence = rise >= 3 && span >= cfg.minSpan ? "medium" : "low";
    } else if (fit) {
      basis = "limits";
      rate = Math.max(0, fit.slope);
      confidence = "low";
    }
  }
  if (basis === "none") return none(w, anchor.pct, resetsAt, n);
  if (!Number.isFinite(rate) || rate < 0) rate = 0;
  let from = anchor.ts;
  if (now - anchor.ts > cfg.stale) {
    from = now;
    if (basis === "limits") confidence = LOWER[confidence];
  }
  const at = (t) => Math.min(100, anchor.pct + rate * Math.max(0, t - from) / H);
  let hitsAt = null;
  if (rate > 1e-9) {
    hitsAt = Math.max(now, from + (100 - anchor.pct) / rate * H);
    const horizon = resetsAt ?? now + WINDOW_MS[w];
    if (hitsAt >= horizon) hitsAt = null;
  }
  return {
    window: w,
    pct: anchor.pct,
    resetsAt,
    ratePerHour: round2(rate),
    hitsAt: hitsAt == null ? null : Math.round(hitsAt),
    pctAtReset: resetsAt == null ? null : round2(at(resetsAt)),
    confidence,
    basis,
    points: n
  };
}
function forecastLimits({ now, limits, history, usage }) {
  const has = !!limits && (limits.fiveHourPct != null || limits.sevenDayPct != null);
  const cur = (w) => has && limits ? {
    pct: w === "5h" ? limits.fiveHourPct : limits.sevenDayPct,
    resetsAt: w === "5h" ? limits.fiveHourResetsAt : limits.sevenDayResetsAt,
    ts: limits.updatedAt || now
  } : null;
  const no5h = has && limits?.fiveHourWindow === "none";
  return {
    source: has ? "statusline" : "none",
    now,
    updatedAt: has && limits ? limits.updatedAt : null,
    fiveHour: no5h ? { ...none("5h", null, null), noWindow: true } : forecastWindow({ window: "5h", now, current: cur("5h"), history: windowSeries(history, "5h"), usage }),
    sevenDay: forecastWindow({ window: "7d", now, current: cur("7d"), history: windowSeries(history, "7d"), usage })
  };
}
function forecastWarns(f, margin = FORECAST_MARGIN_MS) {
  return !!f && !f.noWindow && !f.exhausted && f.hitsAt != null && f.resetsAt != null && f.resetsAt - f.hitsAt > margin && f.confidence !== "low";
}
var H, MIN, WINDOW_MS, FORECAST_TUNING, TOKEN_WEIGHTS, none, LOWER, round2, FORECAST_MARGIN_MS;
var init_forecast = __esm({
  "shared/forecast.ts"() {
    "use strict";
    H = 36e5;
    MIN = 6e4;
    WINDOW_MS = { "5h": 5 * H, "7d": 7 * 24 * H };
    FORECAST_TUNING = {
      "5h": { halfLife: 30 * MIN, minSpan: 10 * MIN, goodSpan: 45 * MIN, stale: 20 * MIN, resetTolerance: 10 * MIN, recent: 30 * MIN },
      "7d": { halfLife: 48 * H, minSpan: 2 * H, goodSpan: 12 * H, stale: 6 * H, resetTolerance: H, recent: 3 * H }
    };
    TOKEN_WEIGHTS = { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 };
    none = (window, pct3, resetsAt, points = 0) => ({
      window,
      pct: pct3,
      resetsAt,
      ratePerHour: 0,
      hitsAt: null,
      pctAtReset: null,
      confidence: "low",
      basis: "none",
      points
    });
    LOWER = { high: "medium", medium: "low", low: "low" };
    round2 = (n) => Math.round(n * 100) / 100;
    FORECAST_MARGIN_MS = 20 * MIN;
  }
});

// server/recommend-limits.ts
function windowUsage(store2, from, now) {
  const ctx = new Ctx(store2);
  const fromDate = localDate(from);
  const proj = /* @__PURE__ */ new Map(), agent = /* @__PURE__ */ new Map(), model = /* @__PURE__ */ new Map();
  let total = 0, modelTotal = 0, raw = 0;
  const add = (m, k, v) => m.set(k, (m.get(k) ?? 0) + v);
  for (const s of store2.files.values()) {
    if (s.lastTs < from) continue;
    let w = 0;
    for (const [date, b] of Object.entries(s.days)) {
      if (date < fromDate) continue;
      const [y, mo, d] = date.split("-").map(Number);
      for (const [h, t] of Object.entries(b.hours)) {
        const start = new Date(y, mo - 1, d, Number(h)).getTime();
        if (start + H2 <= from || start > now) continue;
        w += weight(t);
        raw += t[0] + t[1] + t[2] + t[3];
      }
      for (const [m, u] of Object.entries(b.models)) {
        const v = weight(u.t);
        add(model, m, v);
        modelTotal += v;
      }
    }
    if (!w) continue;
    total += w;
    add(proj, ctx.project(s), w);
    add(agent, s.agentId === null ? "" : s.meta?.agentType ?? "general-purpose", w);
  }
  const top = (m, of) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([k, v]) => ({ key: k, share: of ? v / of : 0 }));
  return { total, mix: raw ? total / raw : 1, projects: top(proj, total), agents: top(agent, total), models: top(model, modelTotal) };
}
function uncapped(w, now) {
  if (w.pct == null || w.resetsAt == null) return null;
  return w.pct + w.ratePerHour * Math.max(0, w.resetsAt - now) / H2;
}
function limitRecommendations(store2, f, lang, leversFor) {
  const TT = insightText(lang);
  const T = TT.rec.limits;
  const now = f.now;
  if (f.source !== "statusline") {
    return [{
      id: "limits-connect",
      severity: "info",
      title: T.connect.title,
      detail: T.connect.detail,
      evidence: T.connect.evidence,
      fix: "/clorbit statusline",
      pages: ["limits"]
    }];
  }
  const startOf = (w2) => Math.min(now, w2.window === "7d" && w2.resetsAt != null ? w2.resetsAt - WINDOW_MS["7d"] : now - WINDOW_MS[w2.window]);
  const consumers = (w2) => {
    const u = windowUsage(store2, startOf(w2), now);
    if (!u.total) return [];
    const pct3 = (x) => `${Math.round(x * 100)}%`;
    return [
      T.eat.projects(u.projects.map((p) => `${p.key} ${pct3(p.share)}`).join(", ")),
      T.eat.agents(u.agents.map((a) => `${a.key ? a.key : T.eat.main} ${pct3(a.share)}`).join(", ")),
      ...u.models.length ? [T.eat.models(u.models.map((m) => `${shortModel2(m.key)} ${pct3(m.share)}`).join(", "))] : []
    ];
  };
  const out = [];
  const w = runsOut(f.sevenDay) ? f.sevenDay : runsOut(f.fiveHour) ? f.fiveHour : null;
  if (w) {
    const total = uncapped(w, now) ?? 100;
    const leverRows = [];
    const levers = leversFor(startOf(w));
    const use = windowUsage(store2, startOf(w), now);
    if (levers && use.total > 0) {
      const spanDays = Math.max(1, Math.round(((/* @__PURE__ */ new Date(`${levers.range.to}T00:00:00`)).getTime() - (/* @__PURE__ */ new Date(`${levers.range.from}T00:00:00`)).getTime()) / 864e5) + 1);
      for (const ins of levers.cards) {
        const est = ins.estSavingTokens ?? 0;
        if (est <= 0 || ins.pages?.includes("limits")) continue;
        const tokens = ins.saving?.basis === "projection" ? est * spanDays / (ins.saving.days ?? 30) : est;
        const weighted = tokens * (ins.saving?.costShare ? use.mix : TOKEN_WEIGHTS.cacheWrite);
        const share = Math.min(1, weighted / use.total);
        if (share >= 2e-3) leverRows.push({ ins, page: homePage(ins), pct: share * total });
      }
    }
    leverRows.sort((a, b) => b.pct - a.pct || a.ins.id.localeCompare(b.ins.id));
    const shown = leverRows.slice(0, LEVERS_MAX);
    const leverPct = Math.min(total * LEVERS_CAP, shown.reduce((n, r) => n + r.pct, 0));
    const early = w.exhausted ? null : (w.resetsAt ?? now) - (w.hitsAt ?? now);
    const pageName = (p) => p ? T.page[p] : "";
    out.push({
      id: stableId("limits-runout", [w.window, String(w.resetsAt ? Math.round(w.resetsAt / H2) : 0)]),
      severity: w.exhausted || w.window === "7d" && (early ?? 0) >= 24 * H2 ? "high" : "warn",
      title: w.exhausted ? T.runout.titleExhausted(w.window, w.resetsAt ? w.resetsAt - now : null) : T.runout.title(w.window, early ?? 0),
      detail: T.runout.detail(w.window, shown.length > 0),
      evidence: [
        T.runout.now(w.window, Math.round(w.pct ?? 0), w.ratePerHour, w.hitsAt, w.resetsAt, Math.round(total)),
        ...consumers(w),
        ...shown.map((r) => T.runout.lever(r.ins.title, r.pct, w.window, pageName(r.page)))
      ],
      fix: shown.length ? void 0 : T.runout.fixNone,
      pages: ["limits"],
      ...leverPct >= 0.5 ? { saving: { windowPct: Math.round(leverPct * 10) / 10, window: w.window } } : {},
      targets: shown.length ? shown.map((r) => ({ key: r.ins.id, label: r.ins.title, kind: "other", note: T.runout.leverNote(r.pct, w.window, pageName(r.page)) })) : void 0,
      ...shown[0]?.page ? { seeAlso: shown[0].page } : {}
    });
    return out;
  }
  const s = f.sevenDay;
  if (!s.noWindow && s.pct != null && s.resetsAt != null && !s.reset) {
    const elapsed = Math.min(1, Math.max(0, 1 - (s.resetsAt - now) / WINDOW_MS["7d"]));
    if (elapsed >= PACE_MIN_ELAPSED) {
      const line = s.pct / elapsed;
      const projected = s.pctAtReset ?? Math.min(100, line);
      const room = projected < 80;
      out.push({
        id: stableId("limits-pace", [String(Math.round(s.resetsAt / H2))]),
        severity: room ? "info" : "warn",
        title: room ? T.pace.titleRoom(Math.round(projected)) : s.pctAtReset == null && line >= 100 ? T.pace.titleOver(Math.round(line)) : T.pace.titleTight(Math.round(projected)),
        detail: T.pace.detail(Math.round(s.pct), elapsed, s.resetsAt - now, s.pctAtReset != null),
        evidence: [T.pace.line(Math.round(s.pct), elapsed, Math.round(projected)), ...consumers(s)],
        pages: ["limits"]
      });
    }
  }
  return out;
}
var H2, LEVERS_MAX, LEVERS_CAP, PACE_MIN_ELAPSED, weight, shortModel2, runsOut;
var init_recommend_limits = __esm({
  "server/recommend-limits.ts"() {
    "use strict";
    init_forecast();
    init_insights();
    init_analytics();
    init_insights_text();
    init_recommend();
    init_util();
    H2 = 36e5;
    LEVERS_MAX = 4;
    LEVERS_CAP = 0.9;
    PACE_MIN_ELAPSED = 0.05;
    weight = (t) => t[0] * TOKEN_WEIGHTS.input + t[1] * TOKEN_WEIGHTS.output + t[2] * TOKEN_WEIGHTS.cacheRead + t[3] * TOKEN_WEIGHTS.cacheWrite;
    shortModel2 = (m) => m.replace(/^claude-/, "").replace(/-(\d+)-(\d+)(\[1m\])?$/, " $1.$2").replace(/-(\d+)$/, " $1").replace(/^\w/, (c) => c.toUpperCase());
    runsOut = (w) => !w.noWindow && w.pct != null && (!!w.exhausted || w.hitsAt != null && w.resetsAt != null && w.hitsAt < w.resetsAt);
  }
});

// shared/automation.ts
function isAutomatedEntrypoint(ep) {
  if (!ep) return false;
  return ep.startsWith("sdk-") || AUTOMATED_ENTRYPOINTS.has(ep);
}
function sessionKind(s) {
  if (s.pidKind && AUTOMATED_PID_KINDS.has(s.pidKind)) return "automated";
  if (isAutomatedEntrypoint(s.pidEntrypoint) || isAutomatedEntrypoint(s.entrypoint)) return "automated";
  if (s.entrypoint === "cli" || s.pidEntrypoint === "cli") return "interactive";
  if (s.promptOrigin && AUTOMATED_ORIGINS.has(s.promptOrigin)) return "automated";
  return "interactive";
}
var AUTOMATED_ENTRYPOINTS, AUTOMATED_PID_KINDS, AUTOMATED_ORIGINS;
var init_automation = __esm({
  "shared/automation.ts"() {
    "use strict";
    AUTOMATED_ENTRYPOINTS = /* @__PURE__ */ new Set(["claude-code-github-action", "github-action", "mcp", "remote_trigger"]);
    AUTOMATED_PID_KINDS = /* @__PURE__ */ new Set(["daemon", "daemon-worker"]);
    AUTOMATED_ORIGINS = /* @__PURE__ */ new Set(["sdk", "scheduled"]);
  }
});

// server/lines.ts
import fs6 from "node:fs/promises";
function classifyPrefix(head) {
  if (head[0] !== 123 || head[1] !== 34) return null;
  const p = head.subarray(0, 24).toString("latin1");
  if (p.startsWith('{"type":"api-request') || p.startsWith('{"type":"file-history-')) return "skip";
  return null;
}
async function readLines(file, start, sink, maxBytes = Infinity) {
  const fh = await fs6.open(file, "r");
  try {
    const buf = Buffer.allocUnsafe(CHUNK);
    let pos = start;
    let consumed = start;
    let carry = [];
    let carryLen = 0;
    let skipping = null;
    let skipLen = 0;
    let decided = false;
    const limit = start + maxBytes;
    while (pos < limit) {
      const { bytesRead: n } = await fh.read(buf, 0, Math.min(CHUNK, limit - pos), pos);
      if (n === 0) break;
      const view = buf.subarray(0, n);
      let i = 0;
      while (i < n) {
        const nl = view.indexOf(10, i);
        if (skipping) {
          if (nl === -1) {
            skipLen += n - i;
            i = n;
            break;
          }
          skipLen += nl - i;
          sink.skipped(skipping, skipLen);
          skipping = null;
          skipLen = 0;
          i = nl + 1;
          consumed = pos + i;
          continue;
        }
        if (nl === -1) {
          const piece = Buffer.from(view.subarray(i, n));
          carry.push(piece);
          carryLen += piece.length;
          if (!decided && carryLen >= HEAD) {
            decided = true;
            const head = carry.length === 1 ? carry[0] : Buffer.concat(carry);
            const k2 = classifyPrefix(head);
            if (k2) {
              skipping = k2;
              skipLen = carryLen;
              carry = [];
              carryLen = 0;
              decided = false;
            }
          }
          i = n;
          break;
        }
        let line;
        if (carry.length) {
          carry.push(view.subarray(i, nl));
          line = Buffer.concat(carry);
          carry = [];
          carryLen = 0;
          decided = false;
        } else {
          line = view.subarray(i, nl);
        }
        i = nl + 1;
        consumed = pos + i;
        if (line.length === 0) continue;
        const k = classifyPrefix(line);
        if (k) sink.skipped(k, line.length);
        else sink.line(line);
      }
      pos += n;
    }
    return consumed;
  } finally {
    await fh.close();
  }
}
function parseLine(line) {
  const cut = line.length > 4096 ? line.indexOf(TUR) : -1;
  if (cut > 0) {
    try {
      const o = JSON.parse(line.toString("utf8", 0, cut) + "}");
      if (o && o.message) return o;
    } catch {
    }
  }
  try {
    return JSON.parse(line.toString("utf8"));
  } catch {
    return null;
  }
}
var HEAD, CHUNK, TUR;
var init_lines = __esm({
  "server/lines.ts"() {
    "use strict";
    HEAD = 240;
    CHUNK = 4 * 1024 * 1024;
    TUR = Buffer.from(',"toolUseResult":');
  }
});

// server/scanner.ts
import fs7 from "node:fs";
import path9 from "node:path";
function emptyCarry() {
  return {
    recentReq: [],
    pending: {},
    toolNames: {},
    lastStop: null,
    lastTool: null,
    lastToolName: null,
    lastToolTs: 0,
    lastText: null,
    lastTextTs: 0,
    lastCtx: 0,
    maxCtx: 0,
    lastPromptTs: 0,
    sessionStartPlugin: null,
    startupDone: false
  };
}
function emptyDay() {
  return {
    t: zeroT4(),
    turns: 0,
    unattributed: 0,
    models: {},
    skills: {},
    plugins: {},
    mcpServers: {},
    mcpTools: {},
    tools: {},
    skillLoads: {},
    hours: {},
    toolCalls: 0,
    compactions: 0,
    autoCompactions: 0,
    hooks: {}
  };
}
function identify(projectsDir, file) {
  let rel = path9.relative(projectsDir, file).split(path9.sep);
  if (rel[0] === "..") {
    const i = file.lastIndexOf(PROJECTS_MARK);
    if (i < 0) return null;
    rel = file.slice(i + PROJECTS_MARK.length).split(path9.sep);
  }
  if (rel.length < 2 || rel[0] === ".." || !file.endsWith(".jsonl")) return null;
  const projectDir = rel[0];
  if (rel.length === 2) return { sessionId: path9.basename(rel[1], ".jsonl"), agentId: null, projectDir };
  const base = path9.basename(file, ".jsonl");
  if (rel[2] !== "subagents" || !base.startsWith("agent-")) return null;
  return { sessionId: rel[1], agentId: base.slice(6), projectDir };
}
function newSummary(file, id) {
  return {
    v: SUMMARY_VERSION,
    path: file,
    size: 0,
    mtimeMs: 0,
    offset: 0,
    sessionId: id.sessionId,
    agentId: id.agentId,
    projectDir: id.projectDir,
    meta: null,
    cwd: null,
    gitBranch: null,
    title: null,
    permissionMode: null,
    model: null,
    requestedModel: null,
    effort: null,
    entrypoint: null,
    promptOrigin: null,
    firstTs: 0,
    lastTs: 0,
    lastAssistantTs: 0,
    total: zeroT4(),
    turns: 0,
    toolCalls: 0,
    compactions: 0,
    autoCompactions: 0,
    turnDurMs: 0,
    days: {},
    minutes: {},
    startup: {},
    skillsByPlugin: {},
    skillsByName: {},
    mcpBlocks: {},
    mcpSeen: [],
    spawns: {},
    reads: {},
    bigResults: [],
    carry: emptyCarry()
  };
}
function readMeta(file) {
  const metaPath = file.replace(/\.jsonl$/, ".meta.json");
  try {
    const m = JSON.parse(fs7.readFileSync(metaPath, "utf8"));
    const wf = path9.basename(path9.dirname(file));
    return {
      agentType: m.agentType || "general-purpose",
      description: m.description ?? null,
      spawnDepth: typeof m.spawnDepth === "number" ? m.spawnDepth : 1,
      toolUseId: m.toolUseId ?? null,
      finished: typeof m.finished === "boolean" ? m.finished : null,
      workflow: wf.startsWith("wf_") ? wf : null,
      worktreePath: m.worktreePath ?? null,
      builtIn: typeof m.isBuiltIn === "boolean" ? m.isBuiltIn : null,
      launchModel: typeof m.model === "string" && m.model ? m.model.slice(0, 64) : null
    };
  } catch {
    return null;
  }
}
function agg(map, key, t, ts) {
  let a = map[key];
  if (!a) a = map[key] = { t: zeroT4(), turns: 0, last: 0 };
  addT4(a.t, t);
  a.turns++;
  if (ts > a.last) a.last = ts;
}
function detectPlugin(texts, known2) {
  for (const t of texts) {
    if (!t) continue;
    const m = /plugins\/(?:cache|marketplaces)\/[^/\s"]+\/([^/\s"]+)\//.exec(t);
    if (m) return m[1];
  }
  let best = null;
  let bestN = 0;
  for (const p of known2) {
    let n = 0;
    for (const t of texts) {
      if (!t) continue;
      let i = t.indexOf(p);
      while (i >= 0 && n < 50) {
        n++;
        i = t.indexOf(p, i + p.length);
      }
    }
    if (n > bestN) {
      best = p;
      bestN = n;
    }
  }
  return best;
}
function declined(content) {
  return /doesn't want to proceed|user rejected|was rejected|permission to use .* (has been|was) denied|interrupted by user|\[Request interrupted/i.test(textOf(content).slice(0, 400));
}
function errorKind(tool, content) {
  const text = textOf(content).slice(0, 400);
  if (tool === "Bash") return /<tool_use_error>/.test(text) ? errKindOf(text) : /timed? ?out/i.test(text.slice(0, 120)) ? "timeout" : "exit";
  return errKindOf(text);
}
function errKindOf(text) {
  for (const [k, re] of ERROR_KINDS) if (re.test(text)) return k;
  return "other";
}
function taskNotification(text) {
  if (!text.includes("<task-notification>")) return null;
  const st = /<status>\s*([\w-]+)\s*<\/status>/.exec(text)?.[1].toLowerCase();
  const res = st === "completed" ? "ok" : st === "failed" ? "error" : st === "stopped" || st === "killed" ? "stopped" : null;
  if (!res) return null;
  const taskId = /<task-id>\s*([\w.-]{1,80})\s*<\/task-id>/.exec(text)?.[1] ?? null;
  const toolUseId = /<tool-use-id>\s*([\w.-]{1,80})\s*<\/tool-use-id>/.exec(text)?.[1] ?? null;
  return taskId || toolUseId ? { taskId, toolUseId, res } : null;
}
async function scanFile(projectsDir, file, prev, opts, onEvent) {
  let st;
  try {
    st = fs7.statSync(file);
  } catch {
    return null;
  }
  const id = identify(projectsDir, file);
  if (!id) return null;
  const meta = id.agentId ? readMeta(file) : null;
  if (prev && prev.v === SUMMARY_VERSION && prev.size === st.size && prev.mtimeMs === st.mtimeMs) {
    const metaChanged = JSON.stringify(prev.meta) !== JSON.stringify(meta);
    if (metaChanged) prev.meta = meta;
    return { summary: prev, changed: metaChanged, resumed: false, bytes: 0 };
  }
  let s;
  let resumed = false;
  if (prev && prev.v === SUMMARY_VERSION && st.size >= prev.offset) {
    s = structuredClone(prev);
    resumed = true;
  } else {
    s = newSummary(file, id);
  }
  s.meta = meta;
  const start = s.offset;
  const sc = new FileScanner(s, opts, onEvent);
  s.offset = await readLines(file, start, sc);
  sc.finish();
  s.size = st.size;
  s.mtimeMs = st.mtimeMs;
  return { summary: s, changed: true, resumed, bytes: s.offset - start };
}
var RECENT_REQ, MAX_PENDING, MAX_TOOLNAMES, BIG_RESULT, MAX_BIG, REBUILD_MIN_CTX, REBUILD_SHARE, IDLE_GAP_MS, IDLE_LONG_MS, CTX_HI, SIMPLE_MAX_REQS, SIMPLE_MAX_OUT, LABELS, ENV_TYPES, PROJECTS_MARK, textOf, ERROR_KINDS, MAX_TASK_ENDS, FileScanner;
var init_scanner = __esm({
  "server/scanner.ts"() {
    "use strict";
    init_lines();
    init_types();
    init_util();
    init_i18n();
    RECENT_REQ = 64;
    MAX_PENDING = 300;
    MAX_TOOLNAMES = 400;
    BIG_RESULT = 2e4;
    MAX_BIG = 30;
    REBUILD_MIN_CTX = 2e4;
    REBUILD_SHARE = 0.5;
    IDLE_GAP_MS = 5 * 6e4;
    IDLE_LONG_MS = 60 * 6e4;
    CTX_HI = [17e4, 85e4];
    SIMPLE_MAX_REQS = 2;
    SIMPLE_MAX_OUT = 1e3;
    LABELS = STARTUP;
    ENV_TYPES = /* @__PURE__ */ new Set([
      "environment",
      "model",
      "date",
      "session_context",
      "auto_mode",
      "credential_org",
      "remote_session_change",
      "command_permissions",
      "silent_turn_reminder",
      "plan_mode",
      "output_style",
      "todo_reminder"
    ]);
    PROJECTS_MARK = `${path9.sep}.claude${path9.sep}projects${path9.sep}`;
    textOf = (content) => typeof content === "string" ? content : Array.isArray(content) ? content.map((b) => typeof b?.text === "string" ? b.text : "").join(" ") : "";
    ERROR_KINDS = [
      ["hook", /hook (?:error|blocked|denied)|blocked by (?:a |the )?hook|PreToolUse:|PostToolUse:/i],
      ["notRead", /has not been read yet|read it first|must (?:first )?read/i],
      ["modified", /modified since (?:it was )?(?:last )?read|has been (?:modified|changed) since/i],
      ["notFound", /string to replace not found|old_string\b.*\bnot found|not found in (?:the )?file/i],
      ["multiple", /found \d+ matches|more than one (?:match|occurrence)|not unique/i],
      ["noFile", /does not exist|no such file|ENOENT|file not found|path not found/i],
      ["tooLarge", /exceeds (?:the )?max|too large|too long|token limit/i],
      ["timeout", /timed? ?out|timeout/i],
      ["denied", /permission denied|EACCES|operation not permitted|not allowed|blocked/i],
      ["input", /InputValidationError|invalid (?:tool )?(?:input|param)|validation (?:error|failed)|required parameter|unexpected parameter/i],
      ["network", /ECONNREFUSED|ENOTFOUND|ECONNRESET|network error|fetch failed|status code [45]\d\d|HTTP [45]\d\d|\b(?:403|404|429|500|502|503) (?:Forbidden|Not Found|Too Many|Internal|Bad Gateway|Service)/i],
      ["exit", /exit(?:ed with)? code [1-9]\d*/i]
    ];
    MAX_TASK_ENDS = 500;
    FileScanner = class {
      s;
      opts;
      onEvent;
      isMain;
      lastTs = 0;
      constructor(s, opts, onEvent) {
        this.s = s;
        this.opts = opts;
        this.onEvent = onEvent;
        this.isMain = s.agentId === null;
        this.lastTs = s.lastTs;
      }
      day(ts) {
        const { date, hour } = localDateHour(ts);
        let b = this.s.days[date];
        if (!b) b = this.s.days[date] = emptyDay();
        return { b, hour };
      }
      touch(ts) {
        if (!this.s.firstTs || ts < this.s.firstTs) this.s.firstTs = ts;
        if (ts > this.s.lastTs) this.s.lastTs = ts;
        this.lastTs = ts;
      }
      addStartup(label, chars) {
        if (this.s.carry.startupDone || chars <= 0) return;
        this.s.startup[label] = (this.s.startup[label] ?? 0) + chars;
      }
      skipped(kind, bytes) {
        if (kind === "snapshot" && bytes > (this.s.startup[LABELS.system] ?? 0)) this.s.startup[LABELS.system] = bytes;
      }
      line(buf) {
        const d = parseLine(buf);
        if (!d || typeof d !== "object") return;
        this.record(d, buf.length);
      }
      record(d, lineLen) {
        const s = this.s;
        const ts = parseTs(d.timestamp) ?? this.lastTs;
        if (s.entrypoint == null && typeof d.entrypoint === "string" && d.entrypoint) s.entrypoint = d.entrypoint;
        switch (d.type) {
          case "assistant":
            return this.assistant(d, ts || Date.now());
          case "user":
            return this.user(d, ts);
          case "attachment":
            return this.attachment(d, ts, lineLen);
          case "system":
            return this.system(d, ts);
          case "ai-title":
            if (d.aiTitle) s.title = String(d.aiTitle);
            return;
          case "custom-title":
            s.customTitle = typeof d.customTitle === "string" && d.customTitle.trim() ? d.customTitle.trim().slice(0, 200) : null;
            return;
          case "permission-mode":
            if (d.permissionMode) s.permissionMode = String(d.permissionMode);
            return;
          default:
            return;
        }
      }
      meta(d) {
        const s = this.s;
        if (d.cwd && !s.cwd) s.cwd = d.cwd;
        if (d.gitBranch) s.gitBranch = d.gitBranch;
      }
      assistant(d, ts) {
        const s = this.s;
        const c = s.carry;
        const msg = d.message;
        if (!msg || typeof msg !== "object") return;
        this.meta(d);
        const model = msg.model;
        if (model === "<synthetic>") return;
        this.touch(ts);
        s.lastAssistantTs = ts;
        if (!c.startupDone) c.startupDone = true;
        const sidechain = d.isSidechain === true && this.isMain;
        const reqKey = d.requestId || msg.id;
        const u = msg.usage;
        if (reqKey && u && !c.recentReq.includes(reqKey)) {
          c.recentReq.push(reqKey);
          if (c.recentReq.length > RECENT_REQ) c.recentReq.splice(0, c.recentReq.length - RECENT_REQ);
          const t = [u.input_tokens || 0, u.output_tokens || 0, u.cache_read_input_tokens || 0, u.cache_creation_input_tokens || 0];
          const total = sumT4(t);
          const { b, hour } = this.day(ts);
          addT4(b.t, t);
          b.turns++;
          addT4(s.total, t);
          s.turns++;
          const hk = String(hour);
          addT4(b.hours[hk] ?? (b.hours[hk] = zeroT4()), t);
          const mk = String(Math.floor(ts / 6e4));
          s.minutes[mk] = (s.minutes[mk] ?? 0) + total;
          if (model) agg(b.models, model, t, ts);
          let attributed = false;
          if (d.attributionSkill) {
            agg(b.skills, String(d.attributionSkill), t, ts);
            attributed = true;
          }
          if (d.attributionPlugin) {
            agg(b.plugins, String(d.attributionPlugin), t, ts);
            attributed = true;
          }
          if (d.attributionMcpServer) {
            agg(b.mcpServers, String(d.attributionMcpServer), t, ts);
            attributed = true;
            if (d.attributionMcpTool) agg(b.mcpTools, `${d.attributionMcpServer}${d.attributionMcpTool}`, t, ts);
          }
          if (!attributed) b.unattributed += total;
          if (!sidechain) {
            const ctx = t[0] + t[2] + t[3];
            if (this.isMain) this.cacheFacts(b, ts, t, ctx, model ?? null);
            c.lastCtx = ctx;
            if (c.lastCtx > c.maxCtx) c.maxCtx = c.lastCtx;
          }
          if (this.isMain && !sidechain && c.round) {
            const r = c.round;
            r.reqs++;
            r.out += t[1];
            r.tok += total;
            const eff = d.perTurnEffort ?? d.effort;
            if (eff) r.effort = String(eff).slice(0, 16);
          }
        }
        if (!sidechain) {
          if (model) s.model = model;
          if (d.requestedModel) s.requestedModel = String(d.requestedModel);
          const eff = d.perTurnEffort ?? d.effort;
          if (eff) s.effort = String(eff);
          if (msg.stop_reason) c.lastStop = msg.stop_reason;
        }
        const content = Array.isArray(msg.content) ? msg.content : [];
        for (const blk of content) {
          if (!blk || typeof blk !== "object") continue;
          if (blk.type === "tool_use") {
            this.toolUse(blk, ts, sidechain);
            if (this.isMain && !sidechain && c.round) c.round.tools++;
          } else if (blk.type === "text" && typeof blk.text === "string" && blk.text.trim() && !sidechain) {
            c.lastText = trimText(blk.text, 240);
            c.lastTextTs = ts;
            this.onEvent?.({ kind: "text", ts, text: c.lastText });
          }
        }
        if (!sidechain && msg.stop_reason === "end_turn") {
          if (this.isMain) this.closeRound(ts);
          this.onEvent?.({ kind: "end", ts });
        }
      }
      /**
       * Cache facts of one main-chain request (v9): a turn that writes most of the previous context to the cache again
       * after an idle gap (the prompt cache expired) or right after a model switch (the cache is per model), and turns
       * with a nearly full context. Measured, not inferred: a gap whose next turn reads the cache is not counted.
       */
      cacheFacts(b, ts, t, ctx, model) {
        const c = this.s.carry;
        const prevCtx = c.lastCtx;
        const prevTs = c.lastTurnTs ?? 0;
        const rebuilt = prevTs > 0 && prevCtx >= REBUILD_MIN_CTX && t[3] >= prevCtx * REBUILD_SHARE;
        if (rebuilt && ts - prevTs > IDLE_GAP_MS) {
          const r = b.rebuilds ??= { n: 0, n60: 0, write: 0 };
          r.n++;
          r.write += t[3];
          if (ts - prevTs > IDLE_LONG_MS) r.n60++;
        } else if (rebuilt && model && c.lastModel && model !== c.lastModel) {
          const w = b.switches ??= { n: 0, write: 0 };
          w.n++;
          w.write += t[3];
        }
        if (ctx >= CTX_HI[0]) {
          const h = b.ctxHi ??= [0, 0];
          h[0]++;
          if (ctx >= CTX_HI[1]) h[1]++;
        }
        if (ts > prevTs) c.lastTurnTs = ts;
        if (model) c.lastModel = model;
      }
      /** Ends the open prompt round (at the main agent's end_turn) and counts it by effort level (v9). */
      closeRound(ts) {
        const c = this.s.carry;
        const r = c.round;
        if (!r || !r.reqs) return;
        c.round = null;
        const { b } = this.day(ts);
        const k = r.effort ?? "default";
        const e = (b.effort ??= {})[k] ??= { rounds: 0, simple: 0, tok: 0 };
        e.rounds++;
        if (r.reqs <= SIMPLE_MAX_REQS && r.tools === 0 && r.out <= SIMPLE_MAX_OUT) {
          e.simple++;
          e.tok += r.tok;
        }
      }
      toolUse(blk, ts, sidechain) {
        const s = this.s;
        const c = s.carry;
        const name = String(blk.name || "unknown");
        const input = blk.input ?? {};
        const label = toolLabel(name, input);
        const { b } = this.day(ts);
        const ta = b.tools[name] ?? (b.tools[name] = { calls: 0, res: 0, resN: 0, max: 0, last: 0 });
        ta.calls++;
        if (ts > ta.last) ta.last = ts;
        b.toolCalls++;
        s.toolCalls++;
        if (blk.id) {
          c.pending[blk.id] = { name, label, ts };
          c.toolNames[blk.id] = name;
          const pk = Object.keys(c.pending);
          if (pk.length > MAX_PENDING) for (const k of pk.slice(0, pk.length - MAX_PENDING)) delete c.pending[k];
          const nk = Object.keys(c.toolNames);
          if (nk.length > MAX_TOOLNAMES) for (const k of nk.slice(0, nk.length - MAX_TOOLNAMES)) delete c.toolNames[k];
        }
        if (!sidechain) {
          c.lastTool = label;
          c.lastToolName = name;
          c.lastToolTs = ts;
        }
        if (name === "Skill" && input.skill) b.skillLoads[String(input.skill)] = (b.skillLoads[String(input.skill)] ?? 0) + 1;
        if ((name === "Agent" || name === "Task") && blk.id) {
          s.spawns[blk.id] = { ts, type: String(input.subagent_type || "general-purpose"), desc: input.description ? String(input.description) : null };
        }
        if (name === "Read" && typeof input.file_path === "string") s.reads[input.file_path] = (s.reads[input.file_path] ?? 0) + 1;
        const m = mcpSplit(name);
        if (m && !s.mcpSeen.includes(m.server)) s.mcpSeen.push(m.server);
        if (!sidechain) this.onEvent?.({ kind: "tool", ts, name, label });
      }
      user(d, ts) {
        const s = this.s;
        const c = s.carry;
        const msg = d.message;
        if (!msg) return;
        if (ts) this.touch(ts);
        this.meta(d);
        const content = msg.content;
        const sidechain = d.isSidechain === true && this.isMain;
        let hasResult = false;
        if (Array.isArray(content)) {
          for (const blk of content) {
            if (!blk || blk.type !== "tool_result") continue;
            hasResult = true;
            const id = blk.tool_use_id;
            const p = id ? c.pending[id] : void 0;
            const name = p?.name ?? (id ? c.toolNames[id] : void 0) ?? "unknown";
            const tokens = estTokens(resultChars(blk.content));
            const { b } = this.day(ts || p?.ts || Date.now());
            const ta = b.tools[name] ?? (b.tools[name] = { calls: 0, res: 0, resN: 0, max: 0, last: 0 });
            ta.res += tokens;
            ta.resN++;
            if (tokens > ta.max) ta.max = tokens;
            const isDeclined = blk.is_error === true && declined(blk.content);
            if (blk.is_error === true && !isDeclined) {
              ta.err = (ta.err ?? 0) + 1;
              const k = errorKind(name, blk.content);
              const kinds = ta.errKinds ??= {};
              kinds[k] = (kinds[k] ?? 0) + 1;
            }
            const sp = id ? s.spawns[id] : void 0;
            if (sp && !/async agent launched|running in the background/i.test(textOf(blk.content).slice(0, 200))) {
              sp.res = isDeclined ? "stopped" : blk.is_error === true ? "error" : "ok";
            }
            if (tokens > BIG_RESULT) {
              s.bigResults.push({ tool: name, label: p?.label ?? name, tokens, ts });
              if (s.bigResults.length > MAX_BIG) {
                s.bigResults.sort((a, b2) => b2.tokens - a.tokens);
                s.bigResults.length = MAX_BIG;
              }
            }
            if (id) {
              delete c.pending[id];
              delete c.toolNames[id];
            }
          }
        }
        if (!hasResult) {
          const n = taskNotification(typeof content === "string" ? content : Array.isArray(content) ? textOf(content) : "");
          if (n) {
            const sp = n.toolUseId ? s.spawns[n.toolUseId] : void 0;
            if (sp) sp.res = n.res;
            if (n.taskId) {
              const ends = s.taskEnds ??= {};
              delete ends[n.taskId];
              ends[n.taskId] = n.res;
              const keys = Object.keys(ends);
              if (keys.length > MAX_TASK_ENDS) for (const k of keys.slice(0, keys.length - MAX_TASK_ENDS)) delete ends[k];
            }
          }
        }
        if (!hasResult && !d.isMeta && !sidechain && d.type === "user" && !d.sourceToolUseID) {
          const isText = typeof content === "string" || Array.isArray(content) && content.some((x) => x?.type === "text");
          if (isText) {
            if (s.promptOrigin === null) {
              const o = d.turnOrigin ?? d.promptSource;
              s.promptOrigin = typeof o === "string" && o ? o : "";
            }
            c.lastPromptTs = ts;
            c.lastStop = null;
            if (this.isMain) c.round = { reqs: 0, out: 0, tools: 0, tok: 0, effort: null };
            this.onEvent?.({ kind: "prompt", ts });
          }
        }
      }
      system(d, ts) {
        const s = this.s;
        if (ts) this.touch(ts);
        if (d.subtype === "turn_duration" && typeof d.durationMs === "number") s.turnDurMs += d.durationMs;
        else if (d.subtype === "compact_boundary") {
          const auto = d.compactMetadata?.trigger === "auto";
          s.compactions++;
          if (auto) s.autoCompactions++;
          const { b } = this.day(ts || Date.now());
          b.compactions++;
          if (auto) b.autoCompactions++;
          const pre = d.compactMetadata?.preTokens;
          if (auto && typeof pre === "number" && pre > 0) b.compactPre = (b.compactPre ?? 0) + pre;
          if (this.isMain) s.carry.lastTurnTs = 0;
          this.onEvent?.({ kind: "compact", ts });
        }
      }
      attachment(d, ts, lineLen) {
        const s = this.s;
        const c = s.carry;
        const a = d.attachment;
        if (!a || typeof a !== "object") return;
        const rendered = Array.isArray(d.rendered) ? d.rendered.reduce((n, r) => n + (typeof r?.content === "string" ? r.content.length : 0), 0) : 0;
        const size = rendered || lineLen;
        switch (a.type) {
          case "hook_success":
          case "hook_error":
          case "hook_non_blocking_error":
          case "hook_blocking_error": {
            if (ts) {
              const plugin = detectPlugin([a.command, a.stderr], []) ?? (a.hookEvent === "SessionStart" ? detectPlugin([a.stdout], this.opts.knownPlugins) : null);
              const key = `${plugin ?? ""}|${a.hookName ?? a.hookEvent ?? "?"}`;
              const { b } = this.day(ts);
              const h = b.hooks[key] ?? (b.hooks[key] = { n: 0, ms: 0, err: 0 });
              h.n++;
              h.ms += typeof a.durationMs === "number" ? a.durationMs : 0;
              if (a.type !== "hook_success" || typeof a.exitCode === "number" && a.exitCode !== 0 || a.stderr && String(a.stderr).trim()) h.err++;
              if (a.hookEvent === "SessionStart" && plugin && typeof a.stdout === "string" && a.stdout.includes("additionalContext")) c.sessionStartPlugin = plugin;
            }
            return;
          }
          case "hook_additional_context": {
            const txt = Array.isArray(a.content) ? a.content.join("\n") : String(a.content ?? "");
            let plugin = null;
            if (a.hookName === "SessionStart" || a.hookEvent === "SessionStart") plugin = c.sessionStartPlugin ?? detectPlugin([txt], this.opts.knownPlugins);
            const label = plugin ? hookPluginKey(plugin) : hookEventKey(String(a.hookName ?? a.hookEvent ?? ""));
            this.addStartup(label, rendered || txt.length);
            return;
          }
          case "skill_listing": {
            this.addStartup(LABELS.skills, size);
            if (!c.startupDone && typeof a.content === "string") {
              const byName = s.skillsByName ??= {};
              let plugin = OWN_SKILLS;
              let name = null;
              for (const ln of a.content.split("\n")) {
                const m = /^- ([^:\s]+)(?::([^:\s]+))?:/.exec(ln);
                if (m) {
                  plugin = m[2] ? m[1] : OWN_SKILLS;
                  name = m[2] ? `${m[1]}:${m[2]}` : m[1];
                }
                const n = ln.length + 1;
                s.skillsByPlugin[plugin] = (s.skillsByPlugin[plugin] ?? 0) + n;
                if (name) byName[name] = (byName[name] ?? 0) + n;
              }
            }
            return;
          }
          case "mcp_instructions_delta": {
            this.addStartup(LABELS.mcp, size);
            const names3 = Array.isArray(a.addedNames) ? a.addedNames : [];
            const blocks = Array.isArray(a.addedBlocks) ? a.addedBlocks : [];
            names3.forEach((n, i) => {
              const k = mcpKey(String(n));
              if (!s.mcpSeen.includes(k)) s.mcpSeen.push(k);
              if (!c.startupDone) s.mcpBlocks[String(n)] = (s.mcpBlocks[String(n)] ?? 0) + (typeof blocks[i] === "string" ? blocks[i].length : 0);
            });
            return;
          }
          case "deferred_tools_record":
          case "deferred_tools_delta": {
            this.addStartup(LABELS.deferred, size);
            const names3 = Array.isArray(a.addedNames) ? a.addedNames : Array.isArray(a.entries) ? a.entries.map((e) => e?.name).filter(Boolean) : [];
            const lines = Array.isArray(a.addedLines) ? a.addedLines.filter((x) => typeof x === "string") : [];
            for (const n of names3) {
              const m = mcpSplit(String(n));
              if (!m) continue;
              if (!s.mcpSeen.includes(m.server)) s.mcpSeen.push(m.server);
              if (!c.startupDone) {
                const ln = lines.find((l) => l === n || l.startsWith(`${n}:`) || l.startsWith(`${n} `));
                const per = s.mcpToolNames ??= {};
                per[m.server] = (per[m.server] ?? 0) + (ln ?? String(n)).length + 1;
              }
            }
            this.mcpIssues(a, ts);
            return;
          }
          case "agent_listing_delta":
            this.addStartup(LABELS.agents, size);
            return;
          case "instructions":
          case "nested_memory": {
            this.addStartup(LABELS.claudeMd, size);
            if (c.startupDone) return;
            const files = a.type === "instructions" ? Array.isArray(a.files) ? a.files : [] : [a.content && typeof a.content === "object" ? { path: a.path, ...a.content } : a];
            for (const f of files) {
              if (!f || typeof f !== "object" || typeof f.path !== "string" || typeof f.content !== "string" || !f.content) continue;
              const mf = s.memoryFiles ??= {};
              mf[f.path] = { type: String(f.type ?? f.kind ?? ""), chars: Math.max(mf[f.path]?.chars ?? 0, f.content.length) };
            }
            return;
          }
          case "prompt_snapshot": {
            const sp = Array.isArray(a.systemPrompt) ? a.systemPrompt : [];
            const chars = sp.reduce((n, x) => n + (typeof x === "string" ? x.length : 0), 0) || lineLen;
            if (chars > (s.startup[LABELS.system] ?? 0)) s.startup[LABELS.system] = chars;
            if (Array.isArray(a.tools) && a.tools.length) {
              const tc = JSON.stringify(a.tools).length;
              if (tc > (s.startup[LABELS.toolDefs] ?? 0)) s.startup[LABELS.toolDefs] = tc;
              if (!c.startupDone) {
                const per = {};
                for (const t of a.tools) {
                  const m = t && typeof t.name === "string" ? mcpSplit(t.name) : null;
                  if (m) per[m.server] = (per[m.server] ?? 0) + JSON.stringify(t).length;
                }
                const defs = s.mcpToolDefs ??= {};
                for (const [k, n] of Object.entries(per)) if (n > (defs[k] ?? 0)) defs[k] = n;
              }
            }
            return;
          }
          default:
            if (ENV_TYPES.has(a.type)) this.addStartup(LABELS.env, rendered);
            else if (rendered) this.addStartup(LABELS.other, rendered);
        }
      }
      /** `failedMcpServers` ({ name, error?, errorCode? }) and `needsAuthMcpServers` (names) of a deferred tools attachment. */
      mcpIssues(a, ts) {
        const failed = Array.isArray(a.failedMcpServers) ? a.failedMcpServers : [];
        const auth = Array.isArray(a.needsAuthMcpServers) ? a.needsAuthMcpServers : [];
        if (!failed.length && !auth.length) return;
        const issues = this.s.mcpIssues ??= {};
        const at = (name) => issues[name] ??= { failed: 0, auth: 0, last: 0 };
        for (const f of failed) {
          const name = typeof f === "string" ? f : typeof f?.name === "string" ? f.name : null;
          if (!name) continue;
          const it = at(name);
          it.failed++;
          it.last = Math.max(it.last, ts);
          const err = typeof f?.error === "string" ? f.error : typeof f?.errorCode === "string" ? f.errorCode : null;
          if (err) it.error = trimText(err, 80);
        }
        for (const n of auth) {
          if (typeof n !== "string" || !n) continue;
          const it = at(n);
          it.auth++;
          it.last = Math.max(it.last, ts);
        }
      }
      /** Trims per-minute buckets to the last hour of activity. */
      finish() {
        const s = this.s;
        const minKeep = Math.floor(s.lastTs / 6e4) - 60;
        for (const k of Object.keys(s.minutes)) if (Number(k) < minKeep) delete s.minutes[k];
      }
    };
  }
});

// server/store.ts
import { EventEmitter } from "node:events";
import fs8 from "node:fs";
import os4 from "node:os";
import path10 from "node:path";
import { Worker } from "node:worker_threads";
function listTranscripts(projectsDir) {
  const out = [];
  let dirs = [];
  try {
    dirs = fs8.readdirSync(projectsDir);
  } catch {
    return out;
  }
  for (const d of dirs) {
    const pd = path10.join(projectsDir, d);
    let entries;
    try {
      entries = fs8.readdirSync(pd, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (e.isFile() && e.name.endsWith(".jsonl")) out.push(path10.join(pd, e.name));
      else if (e.isDirectory()) {
        const sub = path10.join(pd, e.name, "subagents");
        let se;
        try {
          se = fs8.readdirSync(sub, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const x of se) {
          if (x.isFile() && x.name.startsWith("agent-") && x.name.endsWith(".jsonl")) out.push(path10.join(sub, x.name));
          else if (x.isDirectory() && x.name === "workflows") {
            let wfs = [];
            try {
              wfs = fs8.readdirSync(path10.join(sub, "workflows"));
            } catch {
              continue;
            }
            for (const wf of wfs) {
              let af = [];
              try {
                af = fs8.readdirSync(path10.join(sub, "workflows", wf));
              } catch {
                continue;
              }
              for (const f of af) if (f.startsWith("agent-") && f.endsWith(".jsonl")) out.push(path10.join(sub, "workflows", wf, f));
            }
          }
        }
      }
    }
  }
  return out;
}
var Pool, Store;
var init_store = __esm({
  "server/store.ts"() {
    "use strict";
    init_config();
    init_cowork();
    init_scanner();
    init_types();
    init_i18n();
    Pool = class {
      workers = [];
      queue = [];
      cbs = /* @__PURE__ */ new Map();
      seq = 0;
      constructor(n) {
        for (let i = 0; i < n; i++) {
          const w = new Worker(BUNDLED ? new URL(import.meta.url) : new URL("./scan-worker.ts", import.meta.url));
          const slot = { w, busy: false };
          w.on("message", (m) => {
            const cb = this.cbs.get(m.id);
            if (!cb) return;
            this.cbs.delete(m.id);
            slot.busy = false;
            if (m.error) cb.reject(new Error(m.error));
            else cb.resolve(m.result);
            this.pump();
          });
          w.on("error", (e) => {
            for (const [id, cb] of this.cbs) if (cb.slot === slot) {
              this.cbs.delete(id);
              cb.reject(e);
            }
            slot.busy = true;
            slot.broken = true;
            if (this.workers.every((x) => x.broken)) for (const j of this.queue.splice(0)) j.reject(e);
            this.pump();
          });
          this.workers.push(slot);
        }
      }
      run(msg) {
        return new Promise((resolve, reject) => {
          this.queue.push({ msg, resolve, reject });
          this.pump();
        });
      }
      pump() {
        for (const slot of this.workers) {
          if (slot.busy || !this.queue.length) continue;
          const job = this.queue.shift();
          const id = ++this.seq;
          slot.busy = true;
          this.cbs.set(id, { resolve: job.resolve, reject: job.reject, slot });
          slot.w.postMessage({ id, ...job.msg });
        }
      }
      async close() {
        await Promise.all(this.workers.map((s) => s.w.terminate()));
      }
    };
    Store = class extends EventEmitter {
      /**
       * @param coworkDir the Claude desktop's Cowork sessions folder whose transcripts are scanned too
       *   (see cowork.ts); '' (the default) scans only `projectsDir`.
       */
      constructor(projectsDir, db2, opts, coworkDir2 = "") {
        super();
        this.projectsDir = projectsDir;
        this.db = db2;
        this.opts = opts;
        this.coworkDir = coworkDir2;
      }
      projectsDir;
      db;
      opts;
      coworkDir;
      files = /* @__PURE__ */ new Map();
      bySession = /* @__PURE__ */ new Map();
      /** Paths whose transcript is gone from disk → when it was first noticed missing. Their summaries stay in `files`. */
      missing = /* @__PURE__ */ new Map();
      version = 0;
      stats = { startedAt: 0, finishedAt: null, filesTotal: 0, filesDone: 0, filesParsed: 0, bytesParsed: 0, fromCache: 0, loadMs: 0 };
      /** Persistence diagnostics: last flush and JSON-cache import. */
      persist = { lastFlushAt: 0, lastFlushMs: 0, lastFlushRows: 0, flushes: 0, imported: null };
      scanDone = false;
      inflight = /* @__PURE__ */ new Map();
      saveTimer = null;
      dirtyPaths = /* @__PURE__ */ new Set();
      flushing = null;
      /** Every transcript: the main projects dir and, when enabled, each Cowork session's own one. */
      listAll() {
        const out = listTranscripts(this.projectsDir);
        if (this.coworkDir) for (const root of coworkProjectRoots(this.coworkDir)) out.push(...listTranscripts(root));
        return out;
      }
      /** Is this transcript one of a Cowork session? */
      isCowork(file) {
        return isCoworkPath(file, this.coworkDir);
      }
      /**
       * Warm start: optionally imports the legacy JSON cache once, then loads all
       * current-version summaries (including archived ones) from SQLite.
       */
      loadCache(legacyCacheDir) {
        const t02 = Date.now();
        if (!this.db) return;
        try {
          if (legacyCacheDir) this.persist.imported = this.db.importJsonCache(legacyCacheDir);
          for (const { summary, missingSince } of this.db.loadSummaries()) {
            migrateSummaryKeys(summary);
            this.put(summary, false, false);
            if (missingSince !== null) this.missing.set(summary.path, missingSince);
          }
        } catch (e) {
          console.error("[clorbit] could not read the database:", e.message);
        }
        this.stats.loadMs = Date.now() - t02;
      }
      put(s, bump2 = true, persist = true) {
        this.files.set(s.path, s);
        let set = this.bySession.get(s.sessionId);
        if (!set) this.bySession.set(s.sessionId, set = /* @__PURE__ */ new Set());
        set.add(s.path);
        if (persist) {
          this.missing.delete(s.path);
          this.dirtyPaths.add(s.path);
        }
        if (bump2) this.version++;
      }
      /**
       * The transcript disappeared from disk (e.g. Claude Code's 30-day cleanup).
       * Its summary is kept for analytics and the row is flagged with missing_since.
       */
      markMissing(file, ts = Date.now()) {
        if (!this.files.has(file) || this.missing.has(file)) return;
        this.missing.set(file, ts);
        this.dirtyPaths.add(file);
        this.version++;
        this.scheduleSave();
      }
      isMissing(file) {
        return this.missing.has(file);
      }
      /** Kept for API compatibility: removal now archives instead of dropping. */
      remove(file) {
        this.markMissing(file);
      }
      sessionFiles(sessionId) {
        const set = this.bySession.get(sessionId);
        if (!set) return [];
        const out = [];
        for (const p of set) {
          const s = this.files.get(p);
          if (s) out.push(s);
        }
        return out;
      }
      mainOf(sessionId) {
        for (const s of this.sessionFiles(sessionId)) if (s.agentId === null) return s;
        return null;
      }
      /** Cold scan in the background. HTTP already responds meanwhile. */
      async coldScan(threads = Math.max(2, Math.min(8, os4.cpus().length - 2))) {
        const st = this.stats;
        st.startedAt = Date.now();
        const list = this.listAll();
        const withM = list.map((f) => {
          try {
            const s = fs8.statSync(f);
            return { f, m: s.mtimeMs, size: s.size };
          } catch {
            return null;
          }
        }).filter((x) => !!x).sort((a, b) => b.m - a.m);
        st.filesTotal = withM.length;
        const present = new Set(withM.map((x) => x.f));
        const now = Date.now();
        for (const p of [...this.files.keys()]) if (!present.has(p)) this.markMissing(p, now);
        const todo = [];
        for (const x of withM) {
          const prev = this.files.get(x.f);
          if (prev && prev.v === SUMMARY_VERSION && prev.size === x.size && prev.mtimeMs === x.m) {
            st.filesDone++;
            st.fromCache++;
            if (this.missing.delete(x.f)) {
              this.dirtyPaths.add(x.f);
              this.version++;
            }
          } else todo.push(x);
        }
        if (todo.length) {
          let pool = null;
          try {
            pool = threads > 0 ? new Pool(Math.min(threads, todo.length)) : null;
          } catch {
            pool = null;
          }
          await Promise.all(todo.map((x) => this.enqueue(x.f, async () => {
            const prev = this.files.get(x.f) ?? null;
            let r = null;
            try {
              r = pool ? await pool.run({ projectsDir: this.projectsDir, file: x.f, prev, opts: this.opts }) : await scanFile(this.projectsDir, x.f, prev, this.opts);
            } catch {
              r = await scanFile(this.projectsDir, x.f, prev, this.opts).catch(() => null);
            }
            if (r?.summary) {
              this.put(r.summary);
              st.filesParsed++;
              st.bytesParsed += r.bytes ?? 0;
            }
            st.filesDone++;
            this.scheduleSave(5e3);
          })));
          await pool?.close();
        }
        st.finishedAt = Date.now();
        this.scanDone = true;
        this.version++;
        await this.flush();
        this.emit("scan-done");
      }
      enqueue(file, job) {
        const prev = this.inflight.get(file) ?? Promise.resolve();
        const next = prev.then(job, job).finally(() => {
          if (this.inflight.get(file) === next) this.inflight.delete(file);
        });
        this.inflight.set(file, next);
        return next;
      }
      /** Reads the new tail of a changed file on the main thread and reports new events. */
      refresh(file) {
        return this.enqueue(file, async () => {
          if (!identify(this.projectsDir, file)) return;
          if (!fs8.existsSync(file)) {
            this.markMissing(file);
            return;
          }
          const prev = this.files.get(file) ?? null;
          const events = [];
          const r = await scanFile(this.projectsDir, file, prev, this.opts, (e) => {
            if (events.length < 500) events.push(e);
          }).catch(() => null);
          if (!r || !r.changed) return;
          const isNew = !prev;
          this.put(r.summary);
          this.scheduleSave(5e3);
          this.emit("file", r.summary, events, isNew);
        });
      }
      /** Throttled background flush of changed summaries to SQLite. */
      scheduleSave(ms = 5e3) {
        if (!this.db || this.saveTimer) return;
        this.saveTimer = setTimeout(() => {
          this.saveTimer = null;
          void this.flush();
        }, ms);
        this.saveTimer.unref?.();
      }
      /**
       * Writes dirty summaries in small transactions, yielding to the event loop
       * between chunks so HTTP handlers are not held up by a large batch.
       */
      flush(chunk = 100) {
        if (!this.db) return Promise.resolve();
        if (this.flushing) return this.flushing.then(() => this.dirtyPaths.size ? this.flush(chunk) : void 0);
        if (this.saveTimer) {
          clearTimeout(this.saveTimer);
          this.saveTimer = null;
        }
        const run = async () => {
          const t02 = performance.now();
          let rows = 0;
          while (this.dirtyPaths.size) {
            const batch = [];
            for (const p of this.dirtyPaths) {
              batch.push(p);
              if (batch.length >= chunk) break;
            }
            for (const p of batch) this.dirtyPaths.delete(p);
            rows += this.writeRows(batch);
            if (this.dirtyPaths.size) await new Promise((r) => setImmediate(r));
          }
          this.persist.lastFlushAt = Date.now();
          this.persist.lastFlushMs = Math.round(performance.now() - t02);
          this.persist.lastFlushRows = rows;
          this.persist.flushes++;
        };
        this.flushing = run().catch((e) => {
          console.error("[clorbit] could not save summaries to the database:", e.message);
        }).finally(() => {
          this.flushing = null;
        });
        return this.flushing;
      }
      writeRows(paths) {
        const items = [];
        for (const p of paths) {
          const s = this.files.get(p);
          if (s) items.push({ summary: s, missingSince: this.missing.get(p) ?? null });
        }
        this.db.upsertSummaries(items);
        return items.length;
      }
      /** Synchronous flush of everything pending (shutdown path). */
      saveNow() {
        if (!this.db) return;
        if (this.saveTimer) {
          clearTimeout(this.saveTimer);
          this.saveTimer = null;
        }
        const paths = [...this.dirtyPaths];
        this.dirtyPaths.clear();
        try {
          this.writeRows(paths);
        } catch (e) {
          for (const p of paths) this.dirtyPaths.add(p);
          console.error("[clorbit] could not save summaries to the database:", e.message);
        }
      }
      get isDirty() {
        return this.dirtyPaths.size > 0;
      }
    };
  }
});

// server/recommend-sessions.ts
function daysOf(s, range) {
  const out = [];
  for (const [d, b] of Object.entries(s.days)) if (inRange(d, range)) out.push(b);
  return out;
}
function sessionView(store2, sessionId) {
  const v = new Store(store2.projectsDir, null, store2.opts);
  const files = store2.sessionFiles(sessionId);
  for (const s of files) v.files.set(s.path, s);
  v.bySession.set(sessionId, new Set(files.map((s) => s.path)));
  v.version = store2.version;
  return v;
}
function sessionRange(store2, sessionId) {
  const days = store2.sessionFiles(sessionId).flatMap((s) => Object.keys(s.days)).sort();
  return days.length ? { from: days[0], to: days[days.length - 1] } : null;
}
function sessionRecommendations(store2, range, lang, env2, o = {}) {
  const scope = o.scope ?? "all";
  const th = TH[scope];
  const one = scope === "session";
  const TT = insightText(lang);
  const T = TT.rec.sessions;
  const ctx = new Ctx(store2);
  const days = rangeDays3(range);
  const mains = [];
  for (const s of store2.files.values()) if (s.agentId === null && Object.keys(s.days).some((d) => inRange(d, range))) mains.push(s);
  if (!mains.length) return [];
  const name = (s) => {
    const t = sessionTitle(s);
    return t ? TT.quote(t) : s.sessionId.slice(0, 8);
  };
  const where = (s) => `${name(s)} (${ctx.project(s)})`;
  const sessionTarget = (s, note) => ({ key: s.sessionId, label: sessionTitle(s) ?? s.sessionId.slice(0, 8), kind: "session", note });
  const out = [];
  {
    const rows = [];
    for (const s of mains) {
      let n = 0, pre = 0;
      for (const b of daysOf(s, range)) {
        n += b.autoCompactions;
        pre += b.compactPre ?? 0;
      }
      if (n > 0) rows.push({ s, n, pre });
    }
    const total = rows.reduce((n, r) => n + r.n, 0);
    if (rows.length && (total >= th.compactTotal || rows.some((r) => r.n >= 2))) {
      rows.sort((a, b) => b.n - a.n || a.s.sessionId.localeCompare(b.s.sessionId));
      const withPre = rows.filter((r) => r.pre > 0);
      const avgPre = withPre.length ? Math.round(withPre.reduce((n, r) => n + r.pre, 0) / withPre.reduce((n, r) => n + r.n, 0)) : 0;
      const facts = (r) => T.compact.facts(r.n, r.pre ? Math.round(r.pre / r.n) : 0);
      out.push({
        id: stableId("auto-compactions", rows.slice(0, MAX_ITEMS).map((r) => r.s.sessionId)),
        severity: total >= 10 ? "warn" : "info",
        title: one ? T.compact.titleOne(total) : T.compact.title(total, rows.length),
        detail: T.compact.detail,
        evidence: [
          ...one ? [] : rows.slice(0, MAX_ITEMS).map((r) => `${where(r.s)}: ${facts(r)}`),
          ...avgPre ? [T.compact.avg(avgPre)] : [],
          ...env2.autoCompactPct ? [T.compact.pctEnv(env2.autoCompactPct)] : []
        ],
        pages: ["sessions"],
        scope: "range",
        targets: one ? void 0 : rows.slice(0, MAX_ITEMS).map((r) => sessionTarget(r.s, facts(r))),
        prompts: buildPrompts({
          lang,
          summary: one ? T.compact.summaryOne(total) : T.compact.summary(total, rows.length),
          items: [instructionNoteItem(lang, { name: T.compact.name, file: env2.userClaudeMd, section: T.compact.section, text: T.compact.noteText, why: T.compact.why(total, rows.length) })],
          notes: [...PROMPT_NOTES[lang].note(env2.userClaudeMd), T.compact.noteRule]
        })
      });
    }
  }
  {
    const rows = [];
    for (const s of mains) {
      let n2 = 0, n60 = 0, write = 0;
      for (const b of daysOf(s, range)) if (b.rebuilds) {
        n2 += b.rebuilds.n;
        n60 += b.rebuilds.n60;
        write += b.rebuilds.write;
      }
      if (n2) rows.push({ s, n: n2, n60, write, save: Math.max(0, write - n2 * startupTok(s)) });
    }
    const n = rows.reduce((a, r) => a + r.n, 0);
    const period = Math.round(rows.reduce((a, r) => a + r.save, 0));
    if (n >= th.rebuildN && period >= th.rebuildSave) {
      rows.sort((a, b) => b.save - a.save || a.s.sessionId.localeCompare(b.s.sessionId));
      const n60 = rows.reduce((a, r) => a + r.n60, 0);
      const write = rows.reduce((a, r) => a + r.write, 0);
      const facts = (r) => T.idle.facts(r.n, r.n60, r.write);
      out.push({
        id: stableId("idle-rebuilds", rows.slice(0, MAX_ITEMS).map((r) => r.s.sessionId)),
        severity: period >= 2e7 ? "high" : period >= 2e6 ? "warn" : "info",
        title: one ? T.idle.titleOne(n, write) : T.idle.title(n, rows.length, write),
        detail: T.idle.detail,
        evidence: [
          T.idle.total(n, n60, write),
          ...one ? [] : rows.slice(0, MAX_ITEMS).map((r) => `${where(r.s)}: ${facts(r)}`)
        ],
        fix: T.idle.fix,
        estSavingTokens: period,
        pages: ["sessions"],
        scope: "range",
        saving: { period, days, basis: "range" },
        targets: one ? void 0 : rows.slice(0, MAX_ITEMS).map((r) => sessionTarget(r.s, facts(r)))
      });
    }
  }
  {
    const rows = [];
    for (const s of mains) {
      const limit = contextLimitFor(s.model, s.requestedModel, s.carry.maxCtx) ?? 2e5;
      let hi = 0, turns = 0, compactions = 0;
      for (const b of daysOf(s, range)) {
        turns += b.turns;
        compactions += b.autoCompactions;
        hi += b.ctxHi ? b.ctxHi[limit > 2e5 ? 1 : 0] : 0;
      }
      if (turns && hi >= th.hiTurns && hi / turns >= th.hiShare) rows.push({ s, hi, turns, share: hi / turns, limit, compactions });
    }
    if (rows.length >= th.hiSessions) {
      rows.sort((a, b) => b.hi - a.hi || a.s.sessionId.localeCompare(b.s.sessionId));
      const facts = (r) => T.full.facts(r.share, r.hi, r.limit, r.compactions);
      out.push({
        id: stableId("context-full", rows.slice(0, MAX_ITEMS).map((r) => r.s.sessionId)),
        severity: rows.length >= 5 ? "warn" : "info",
        title: one ? T.full.titleOne(rows[0].share) : T.full.title(rows.length),
        detail: T.full.detail,
        evidence: one ? [facts(rows[0])] : rows.slice(0, MAX_ITEMS).map((r) => `${where(r.s)}: ${facts(r)}`),
        fix: T.full.fix,
        pages: ["sessions"],
        scope: "range",
        targets: one ? void 0 : rows.slice(0, MAX_ITEMS).map((r) => sessionTarget(r.s, facts(r)))
      });
    }
  }
  if (one) return out;
  {
    const by = /* @__PURE__ */ new Map();
    for (const s of mains) {
      for (const b of daysOf(s, range)) {
        for (const [lvl, e] of Object.entries(b.effort ?? {})) {
          if (!RAISED_EFFORT.has(lvl)) continue;
          const a = by.get(lvl) ?? { rounds: 0, simple: 0, tok: 0, sessions: /* @__PURE__ */ new Set() };
          a.rounds += e.rounds;
          a.simple += e.simple;
          a.tok += e.tok;
          if (e.simple) a.sessions.add(s.sessionId);
          by.set(lvl, a);
        }
      }
    }
    const rounds = [...by.values()].reduce((n, a) => n + a.rounds, 0);
    const simple = [...by.values()].reduce((n, a) => n + a.simple, 0);
    if (rounds >= EFFORT_MIN_ROUNDS && simple >= EFFORT_MIN_SIMPLE && simple / rounds >= EFFORT_MIN_SHARE) {
      const levels = [...by.entries()].sort((a, b) => b[1].simple - a[1].simple || a[0].localeCompare(b[0]));
      out.push({
        id: stableId("effort-simple", levels.map(([l]) => l)),
        severity: "info",
        title: T.effort.title(simple, rounds, levels.map(([l]) => l).join(" / ")),
        detail: T.effort.detail,
        evidence: levels.map(([l, a]) => T.effort.evidence(l, a.simple, a.rounds, a.tok, a.sessions.size)),
        fix: T.effort.fix,
        pages: ["sessions"],
        scope: "range"
      });
    }
  }
  {
    let all = 0;
    const tokOf = /* @__PURE__ */ new Map();
    for (const s of store2.files.values()) {
      let t = 0;
      for (const b of daysOf(s, range)) t += sumT4(b.t);
      if (!t) continue;
      all += t;
      tokOf.set(s.sessionId, (tokOf.get(s.sessionId) ?? 0) + t);
    }
    const groups = /* @__PURE__ */ new Map();
    for (const s of mains) {
      if (sessionKind({ entrypoint: s.entrypoint, promptOrigin: s.promptOrigin }) !== "automated") continue;
      const via = s.entrypoint && s.entrypoint !== "cli" ? s.entrypoint : s.promptOrigin || "sdk";
      const project = ctx.project(s);
      const k = `${project}${via}`;
      const g = groups.get(k) ?? { project, via, runs: 0, tok: 0, models: /* @__PURE__ */ new Map(), last: 0 };
      const t = tokOf.get(s.sessionId) ?? 0;
      g.runs++;
      g.tok += t;
      g.last = Math.max(g.last, s.lastTs);
      if (s.model) g.models.set(s.model, (g.models.get(s.model) ?? 0) + t);
      groups.set(k, g);
    }
    const tok = [...groups.values()].reduce((n, g) => n + g.tok, 0);
    const share = all ? tok / all : 0;
    if (groups.size && (share >= AUTO_MIN_SHARE && tok >= AUTO_MIN_TOKENS || tok >= AUTO_ALWAYS_TOKENS)) {
      const list = [...groups.values()].sort((a, b) => b.tok - a.tok || a.project.localeCompare(b.project));
      const runs = list.reduce((n, g) => n + g.runs, 0);
      const topModel = (g) => [...g.models.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "\u2014";
      const facts = (g) => T.auto.facts(g.runs, g.tok, all ? g.tok / all : 0, topModel(g), localDate(g.last));
      out.push({
        id: stableId("automated-sessions", list.slice(0, MAX_ITEMS).map((g) => `${g.project}|${g.via}`)),
        severity: share >= 0.3 ? "warn" : "info",
        title: T.auto.title(runs, share),
        detail: T.auto.detail,
        evidence: list.slice(0, MAX_ITEMS).map((g) => `${g.project} \xB7 ${g.via}: ${facts(g)}`),
        fix: T.auto.fix,
        pages: ["sessions"],
        scope: "range",
        targets: list.slice(0, MAX_ITEMS).map((g) => ({ key: `${g.project}|${g.via}`, label: `${g.project} \xB7 ${g.via}`, kind: "other", note: facts(g) }))
      });
    }
  }
  {
    const byDay = /* @__PURE__ */ new Map();
    const at = (d) => {
      let x = byDay.get(d);
      if (!x) byDay.set(d, x = { input: 0, read: 0, write: 0, rebuildN: 0, rebuildW: 0, switchN: 0, switchW: 0, compactions: 0, starts: 0, startW: 0 });
      return x;
    };
    for (const s of store2.files.values()) {
      for (const [d, b] of Object.entries(s.days)) {
        if (!inRange(d, range)) continue;
        const x = at(d);
        x.input += b.t[0];
        x.read += b.t[2];
        x.write += b.t[3];
        if (b.rebuilds) {
          x.rebuildN += b.rebuilds.n;
          x.rebuildW += b.rebuilds.write;
        }
        if (b.switches) {
          x.switchN += b.switches.n;
          x.switchW += b.switches.write;
        }
        x.compactions += b.compactions;
      }
      if (s.firstTs && Object.keys(s.startup).length) {
        const d = localDate(s.firstTs);
        if (inRange(d, range)) {
          const x = at(d);
          x.starts++;
          x.startW += startupTok(s);
        }
      }
    }
    const rates = [...byDay.entries()].map(([date, x]) => ({ date, x, denom: x.input + x.read + x.write })).filter((r) => r.denom > CACHE_DAY_MIN).map((r) => ({ ...r, rate: r.x.read / r.denom }));
    if (rates.length) {
      const avg = rates.reduce((n, r) => n + r.x.read, 0) / rates.reduce((n, r) => n + r.denom, 0);
      const low = rates.filter((r) => r.rate < Math.min(0.85, avg - 0.05)).sort((a, b) => a.rate - b.rate);
      if (low.length) {
        const causes = (x) => [
          x.rebuildN ? T.cache.causeIdle(x.rebuildN, x.rebuildW) : "",
          x.switchN ? T.cache.causeSwitch(x.switchN, x.switchW) : "",
          x.compactions ? T.cache.causeCompact(x.compactions) : "",
          x.starts && x.startW >= x.write * 0.2 ? T.cache.causeStarts(x.starts, x.startW) : ""
        ].filter(Boolean);
        out.push({
          id: stableId("low-cache-days", low.map((r) => r.date)),
          severity: low.some((r) => r.rate < 0.7) ? "warn" : "info",
          title: TT.lowCache.title(low.length, avg),
          detail: T.cache.detail,
          evidence: low.slice(0, 8).map((r) => {
            const c = causes(r.x);
            return `${TT.lowCache.evidence(r.date, r.rate, r.x.write, r.x.input)} \u2014 ${c.length ? T.cache.likely(c.join(", ")) : T.cache.unknown}`;
          }),
          fix: TT.lowCache.fix,
          pages: ["sessions"],
          // No saving of its own: the measurable part (the cache rebuilt after idle gaps) is the idle-gap card's.
          scope: "range"
        });
      }
    }
  }
  return out;
}
var RAISED_EFFORT, TH, EFFORT_MIN_ROUNDS, EFFORT_MIN_SIMPLE, EFFORT_MIN_SHARE, AUTO_MIN_SHARE, AUTO_MIN_TOKENS, AUTO_ALWAYS_TOKENS, CACHE_DAY_MIN, MAX_ITEMS, inRange, rangeDays3, startupTok;
var init_recommend_sessions = __esm({
  "server/recommend-sessions.ts"() {
    "use strict";
    init_automation();
    init_prompts();
    init_analytics();
    init_insights_text();
    init_recommend();
    init_store();
    init_util();
    init_titles();
    RAISED_EFFORT = /* @__PURE__ */ new Set(["xhigh", "max"]);
    TH = {
      all: { compactTotal: 3, rebuildN: 3, rebuildSave: 2e5, hiTurns: 10, hiShare: 0.25, hiSessions: 2 },
      session: { compactTotal: 1, rebuildN: 1, rebuildSave: 2e4, hiTurns: 5, hiShare: 0.2, hiSessions: 1 }
    };
    EFFORT_MIN_ROUNDS = 20;
    EFFORT_MIN_SIMPLE = 10;
    EFFORT_MIN_SHARE = 0.3;
    AUTO_MIN_SHARE = 0.1;
    AUTO_MIN_TOKENS = 1e6;
    AUTO_ALWAYS_TOKENS = 5e7;
    CACHE_DAY_MIN = 1e6;
    MAX_ITEMS = 6;
    inRange = (d, r) => d >= r.from && d <= r.to;
    rangeDays3 = (range) => Math.max(1, Math.round(((/* @__PURE__ */ new Date(`${range.to}T00:00:00`)).getTime() - (/* @__PURE__ */ new Date(`${range.from}T00:00:00`)).getTime()) / 864e5) + 1);
    startupTok = (s) => estTokens(Object.values(s.startup).reduce((n, c) => n + c, 0));
  }
});

// server/insights.ts
function filesActiveIn2(store2, range) {
  const out = [];
  for (const s of store2.files.values()) {
    if (Object.keys(s.days).some((d) => d >= range.from && d <= range.to)) out.push(s);
  }
  return out;
}
function insights(store2, range, hookLog2, lang = "en", opts = {}) {
  const env2 = { ...defaultEnv({ unusedDays: opts.unusedDays ?? DEFAULT_SETTINGS.recommendations.unusedDays }), ...opts.env };
  if (opts.page === "session") return opts.session ? sessionInsights(store2, opts.session, lang, env2) : [];
  const base = baseInsights(store2, range, lang, env2, !!opts.env);
  const extra = hookLog2 ? waitInsights(store2, hookLog2, range, lang, env2) : [];
  const forecast = opts.limits && (!opts.page || opts.page === "limits") ? opts.limits() : null;
  const lim = forecast ? limitRecommendations(store2, forecast, lang, (from) => {
    const r = { from: localDate(from), to: localDate(env2.now) };
    return { cards: baseInsights(store2, r, lang, env2, !!opts.env), range: r };
  }) : [];
  const all = extra.length || lim.length ? [...base, ...extra, ...lim].sort(bySaving) : base;
  if (opts.page === "overview") return pickOverview(all);
  return opts.page ? all.filter((i) => i.pages?.includes(opts.page)) : all;
}
function baseInsights(store2, range, lang, env2, noMemo) {
  const key = `ins:${lang}:${range.from}:${range.to}:${env2.unusedDays}:${localDate(env2.now)}:${hash8(JSON.stringify([env2.enabledPlugins, env2.mcp.user, env2.mcp.local, env2.autoCompactPct]))}`;
  return noMemo ? compute(store2, range, lang, env2) : memoize(store2, key, () => compute(store2, range, lang, env2));
}
function sessionInsights(store2, sessionId, lang = "en", env2) {
  const range = sessionRange(store2, sessionId);
  if (!range) return [];
  const e = env2 ?? defaultEnv({ unusedDays: DEFAULT_SETTINGS.recommendations.unusedDays });
  const view = sessionView(store2, sessionId);
  const cards = [
    ...sessionRecommendations(view, range, lang, e, { scope: "session" }),
    ...toolRecommendations(view, range, lang, e).filter((i) => /^(repeated-reads|big-outputs):/.test(i.id)),
    ...agentRecommendations(view, range, lang, e).filter((i) => i.id.startsWith("agent-model:"))
  ];
  return cards.map((i) => {
    const home = homePage(i);
    return { ...i, id: i.id.replace(/^([^:]+)/, "$1@session"), pages: ["session"], ...home && home !== "session" ? { seeAlso: home } : {} };
  }).sort(bySavings);
}
function rangeMs(range) {
  const at = (d, plus) => {
    const [y, m, dd] = d.split("-").map(Number);
    return new Date(y, m - 1, dd + plus).getTime();
  };
  return { from: at(range.from, 0), to: at(range.to, 1) };
}
function waitInsights(store2, hookLog2, range, lang = "en", env2) {
  const { from, to } = rangeMs(range);
  if (!hookLog2.hasEvents(from, to)) return [];
  const e = env2 ?? defaultEnv({ unusedDays: DEFAULT_SETTINGS.recommendations.unusedDays });
  const memoKey = `${hookLog2.version}:${store2.version}:${e.settingsFile}:${localDate(e.now)}`;
  const cacheKey = `${lang}:${range.from}:${range.to}`;
  const hit = waitMemo.get(cacheKey);
  if (hit && hit.key === memoKey) return hit.v;
  const T = insightText(lang);
  const waits = deriveWaits(hookLog2.waitEvents(from - WAIT_CAP_MS, to + WAIT_CAP_MS)).filter((w) => w.start >= from && w.start < to && w.end > w.start);
  const v = [];
  const allow = permissionRecommendation(hookLog2.permissionEvents(from - WAIT_CAP_MS, to + WAIT_CAP_MS), range, lang, e, { from, to });
  if (allow) v.push(allow);
  if (waits.length) {
    const ctx = new Ctx(store2);
    const total = waits.reduce((n, w) => n + (w.end - w.start), 0);
    const perm = waits.filter((w) => w.kind === "permission");
    const input = waits.filter((w) => w.kind === "input");
    const permMs = perm.reduce((n, w) => n + (w.end - w.start), 0);
    const inputMs = total - permMs;
    const longest = waits.reduce((a, b) => b.end - b.start > a.end - a.start ? b : a);
    const where = (sid) => {
      const main = store2.mainOf(sid);
      const project = ctx.projectOfSession.get(sid);
      const title = sessionTitle(main);
      return title ? `${T.quote(title)}${project ? ` (${project})` : ""}` : project ?? sid.slice(0, 8);
    };
    const UNKNOWN = "\0unknown";
    const byTool = /* @__PURE__ */ new Map();
    for (const w of perm) {
      const k = w.tool ?? UNKNOWN;
      const a = byTool.get(k) ?? { n: 0, ms: 0 };
      a.n++;
      a.ms += w.end - w.start;
      byTool.set(k, a);
    }
    const tools = [...byTool.entries()].sort((a, b) => b[1].n - a[1].n || b[1].ms - a[1].ms);
    const allowed = tools.map(([t]) => t).filter((t) => t !== UNKNOWN).slice(0, 4);
    const capH = WAIT_CAP_MS / 36e5;
    v.push({
      id: "hook-waits",
      pages: ["sessions"],
      severity: total > 60 * 6e4 ? "warn" : "info",
      title: T.waits.title(total, longest.end - longest.start),
      detail: T.waits.detail(
        waits.length,
        perm.length ? { n: perm.length, ms: permMs } : null,
        input.length ? { n: input.length, ms: inputMs } : null,
        where(longest.sessionId),
        localDate(longest.start),
        capH
      ),
      evidence: [
        ...tools.slice(0, 6).map(([t, a]) => T.waits.toolLine(t === UNKNOWN ? T.unknownTool : t, a.n, a.ms)),
        ...input.length ? [T.waits.inputLine(input.length, inputMs)] : []
      ],
      // The allow rules are the Tools card's (one card per issue); without one, the generic advice stays here.
      fix: perm.length && !allow ? T.waits.fixPerm(allowed.map((t) => `"${t === "Bash" ? "Bash(pnpm test *)" : t}"`).join(", ")) : T.waits.fixInput,
      ...allow ? { seeAlso: "tools" } : {}
    });
  }
  waitMemo.set(cacheKey, { key: memoKey, v });
  if (waitMemo.size > 50) waitMemo.delete(waitMemo.keys().next().value);
  return v;
}
function compute(store2, range, lang, env2) {
  const T = insightText(lang);
  const skills = skillRecommendations(store2, range, lang, env2);
  const attr = attribution(store2, range, lang);
  const coveredPlugins = new Set(skills.filter((i) => i.id.startsWith("unused-plugins:")).flatMap((i) => (i.targets ?? []).map((t) => t.label)));
  const out = [
    ...skills,
    ...mcpRecommendations(store2, range, lang, env2, { plugins: coveredPlugins }),
    ...startupRecommendations(store2, range, lang, env2, { attr, skillCards: skills }),
    // Tools: repeated reads, huge built-in tool results, failing tools (permission prompts come from hooks: waitInsights).
    ...toolRecommendations(store2, range, lang, env2),
    // Subagents: cheaper models for read-only agents, startup overhead, bursts / deep nesting, failing agents.
    ...agentRecommendations(store2, range, lang, env2)
  ];
  const settings2 = readSettings();
  out.push(...sessionRecommendations(store2, range, lang, env2));
  const ov = overview(store2, range);
  const grand = ov.totals.total || 1;
  const pluginKey = (name) => Object.keys(settings2.enabledPlugins).find((k) => k.split("@")[0] === name) ?? `${name}@\u2026`;
  const filesInRange = filesActiveIn2(store2, range);
  const skillsSorted = attr.skills.filter((r) => r.total > 0).sort((a, b) => b.total - a.total);
  for (const r of skillsSorted.slice(0, 3)) {
    const share = r.total / grand;
    if (share < 0.03) continue;
    const loads = Number(r.extra?.loads ?? 0);
    out.push({
      id: `skill-share-${r.key}`,
      pages: ["skills"],
      severity: share >= 0.15 ? "warn" : "info",
      title: T.skillShare.title(r.key, share, loads),
      detail: T.skillShare.detail(r.key, r.total, r.sessions, loads ? r.total / loads : null),
      evidence: [T.skillShare.turns(r.turns, r.sessions), T.skillShare.tokens(r.tokens.output, r.tokens.cacheWrite)],
      fix: T.skillShare.fix
    });
  }
  const oftenLoaded = attr.skills.filter((r) => Number(r.extra?.loads ?? 0) >= 10).sort((a, b) => Number(b.extra.loads) - Number(a.extra.loads));
  if (oftenLoaded.length) {
    out.push({
      id: "skills-loads",
      pages: [],
      severity: "info",
      title: T.skillLoads.title,
      detail: T.skillLoads.detail,
      evidence: oftenLoaded.slice(0, 8).map((r) => T.skillLoads.evidence(r.key, r.extra.loads, r.total / grand))
    });
  }
  const hookAgg = /* @__PURE__ */ new Map();
  for (const s of filesInRange) {
    for (const [d, b] of Object.entries(s.days)) {
      if (d < range.from || d > range.to) continue;
      for (const [k, h] of Object.entries(b.hooks)) {
        const [plugin, name] = k.split("|");
        const a = hookAgg.get(plugin) ?? { n: 0, ms: 0, err: 0, names: /* @__PURE__ */ new Set() };
        a.n += h.n;
        a.ms += h.ms;
        a.err += h.err;
        a.names.add(name.split(":")[0]);
        hookAgg.set(plugin, a);
      }
    }
  }
  for (const [plugin, a] of [...hookAgg.entries()].sort((x, y) => y[1].ms - x[1].ms)) {
    if (a.n < 200 && a.err < 50) continue;
    const errShare = a.err / a.n;
    const min = Math.round(a.ms / 6e4);
    out.push({
      id: `hooks-${plugin || "none"}`,
      pages: ["startup"],
      severity: errShare > 0.5 && a.n > 500 ? "warn" : "info",
      title: T.hooks.title(plugin || null, a.n, min, errShare > 0.5 ? errShare : null),
      detail: T.hooks.detail([...a.names].join(", "), min, a.err ? errShare : null),
      evidence: [T.hooks.runs(a.n), T.hooks.time(Math.round(a.ms / 1e3)), T.hooks.errors(a.err)],
      fix: plugin ? T.hooks.fix(plugin, pluginKey(plugin)) : T.hooks.fixNoPlugin
    });
  }
  out.sort(bySaving);
  return out;
}
var sevRank, bySaving, waitMemo;
var init_insights2 = __esm({
  "server/insights.ts"() {
    "use strict";
    init_api();
    init_insights();
    init_analytics();
    init_config();
    init_hook_log();
    init_util();
    init_insights_text();
    init_recommend();
    init_recommend_agents();
    init_recommend_mcp();
    init_recommend_skills();
    init_recommend_startup();
    init_recommend_tools();
    init_recommend_limits();
    init_recommend_sessions();
    init_titles();
    sevRank = { high: 0, warn: 1, info: 2 };
    bySaving = (a, b) => (b.estSavingTokens ?? 0) - (a.estSavingTokens ?? 0) || sevRank[a.severity] - sevRank[b.severity];
    waitMemo = /* @__PURE__ */ new Map();
  }
});

// server/limits-forecast.ts
function usageBuckets(files, from, now) {
  const cut = now - H3;
  const cutMin = Math.floor(cut / MIN2);
  const byStart = /* @__PURE__ */ new Map();
  const add = (start, end, tokens) => {
    if (!(tokens > 0) || end <= start) return;
    const b = byStart.get(start);
    if (b) b.tokens += tokens;
    else byStart.set(start, { end, tokens });
  };
  const fromDate = localDate(from);
  for (const s of files) {
    if (s.lastTs < from) continue;
    for (const [date, day] of Object.entries(s.days)) {
      if (date < fromDate) continue;
      const [y, m, d] = date.split("-").map(Number);
      for (const [h, t] of Object.entries(day.hours)) {
        const start = new Date(y, m - 1, d, Number(h)).getTime();
        const end = start + H3;
        if (end <= from || start >= cut) continue;
        const keep = end > cut ? (cut - start) / H3 : 1;
        add(start, Math.min(end, cut), weightT4(t) * keep);
      }
    }
    const total = sumT4(s.total);
    const mix = total > 0 ? weightT4(s.total) / total : 1;
    for (const [k, v] of Object.entries(s.minutes)) {
      const mk = Number(k);
      if (mk < cutMin || mk * MIN2 > now) continue;
      const start = Math.max(mk * MIN2, cut);
      add(start, mk * MIN2 + MIN2, v * mix);
    }
  }
  return [...byStart].map(([start, b]) => ({ start, end: b.end, tokens: b.tokens })).sort((a, b) => a.start - b.start);
}
var H3, MIN2, FORECAST_LOOKBACK_MS, FORECAST_TTL_MS, weightT4, LimitsForecaster;
var init_limits_forecast = __esm({
  "server/limits-forecast.ts"() {
    "use strict";
    init_forecast();
    init_util();
    H3 = 36e5;
    MIN2 = 6e4;
    FORECAST_LOOKBACK_MS = 8 * 24 * H3;
    FORECAST_TTL_MS = 15e3;
    weightT4 = (t) => t[0] * TOKEN_WEIGHTS.input + t[1] * TOKEN_WEIGHTS.output + t[2] * TOKEN_WEIGHTS.cacheRead + t[3] * TOKEN_WEIGHTS.cacheWrite;
    LimitsForecaster = class {
      constructor(history, files) {
        this.history = history;
        this.files = files;
      }
      history;
      files;
      cache = null;
      get(limits, now = Date.now()) {
        const key = JSON.stringify(limits);
        const c = this.cache;
        if (c && c.key === key && now - c.at < FORECAST_TTL_MS && now >= c.at) return c.v;
        let v;
        if (!limits || limits.fiveHourPct == null && limits.sevenDayPct == null) {
          v = forecastLimits({ now, limits: null, history: [] });
        } else {
          const from = now - FORECAST_LOOKBACK_MS;
          v = forecastLimits({ now, limits, history: this.history(from, now), usage: usageBuckets(this.files(), from, now) });
        }
        this.cache = { at: now, key, v };
        return v;
      }
    };
  }
});

// server/limits-log.ts
function parseTsRange(q2, now = Date.now()) {
  const parse = (v, end) => {
    if (!v) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (m) {
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + (end ? 1 : 0)).getTime();
      return end ? d - 1 : d;
    }
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  let to = parse(q2.get("to"), true) ?? now;
  let from = parse(q2.get("from"), false) ?? to - 7 * 24 * 36e5;
  if (from > to) [from, to] = [to, from];
  return { from, to };
}
var LIMITS_POLL_MS, keyOf, sameKey, LimitsLog;
var init_limits_log = __esm({
  "server/limits-log.ts"() {
    "use strict";
    LIMITS_POLL_MS = 3e4;
    keyOf = (l) => [l.fiveHourPct, l.fiveHourResetsAt, l.sevenDayPct, l.sevenDayResetsAt];
    sameKey = (a, b) => a.every((v, i) => v === b[i]);
    LimitsLog = class {
      constructor(db2, read) {
        this.db = db2;
        this.read = read;
        if (!db2) return;
        const r = db2.stmt("SELECT ts, five_pct, five_resets_at, week_pct, week_resets_at FROM limits ORDER BY ts DESC LIMIT 1").get();
        if (r) this.last = { ts: r.ts, key: [r.five_pct, r.five_resets_at, r.week_pct, r.week_resets_at] };
      }
      db;
      read;
      last = null;
      timer = null;
      start(intervalMs = LIMITS_POLL_MS) {
        this.poll();
        this.timer = setInterval(() => this.poll(), intervalMs);
        this.timer.unref?.();
      }
      stop() {
        if (this.timer) clearInterval(this.timer);
      }
      poll() {
        try {
          return this.record(this.read());
        } catch (e) {
          console.error("[clorbit] could not record limits:", e.message);
          return false;
        }
      }
      /** Inserts a row only when any of the four values differs from the last recorded row. */
      record(l) {
        if (!this.db || !l) return false;
        if (l.fiveHourPct === null && l.sevenDayPct === null) return false;
        const key = keyOf(l);
        if (this.last && sameKey(this.last.key, key)) return false;
        const ts = Math.max(Math.round(l.updatedAt || Date.now()), (this.last?.ts ?? 0) + 1);
        this.db.stmt("INSERT OR IGNORE INTO limits(ts, five_pct, five_resets_at, week_pct, week_resets_at) VALUES(?, ?, ?, ?, ?)").run(ts, ...key);
        this.last = { ts, key };
        return true;
      }
      history(from, to) {
        if (!this.db) return [];
        const rows = this.db.stmt("SELECT ts, five_pct, five_resets_at, week_pct, week_resets_at FROM limits WHERE ts >= ? AND ts <= ? ORDER BY ts").all(from, to);
        return rows.map((r) => ({ ts: r.ts, fiveHourPct: r.five_pct, sevenDayPct: r.week_pct, fiveHourResetsAt: r.five_resets_at, sevenDayResetsAt: r.week_resets_at }));
      }
    };
  }
});

// server/plan.ts
import fs9 from "node:fs";
function str2(v, max = 40) {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s && s.length <= max && !/[\u0000-\u001f]/.test(s) ? s : null;
}
function tierOf(rateLimitTier) {
  const m = typeof rateLimitTier === "string" ? /(?:^|_)(\d{1,3})x$/i.exec(rateLimitTier) : null;
  return m ? `${Number(m[1])}\xD7` : null;
}
function planFrom(account) {
  if (!account || typeof account !== "object" || Array.isArray(account)) return null;
  const a = account;
  const type = str2(a.organizationType);
  const name = str2(a.planDisplayName) ?? (type ? NAMES[type] ?? null : null);
  const tier = tierOf(a.userRateLimitTier) ?? tierOf(a.organizationRateLimitTier);
  const sinceRaw = str2(a.subscriptionCreatedAt, 64);
  const since = sinceRaw && Number.isFinite(Date.parse(sinceRaw)) ? sinceRaw : null;
  if (!name && !tier && !type) return null;
  return { name, tier, type, since };
}
function readPlan(files = CLAUDE_JSON_FILES) {
  for (const file of files) {
    let st;
    try {
      st = fs9.statSync(file);
    } catch {
      continue;
    }
    if (cache3 && cache3.file === file && cache3.mtime === st.mtimeMs && cache3.size === st.size) return cache3.plan;
    let plan = null;
    try {
      plan = planFrom(JSON.parse(fs9.readFileSync(file, "utf8"))?.oauthAccount);
    } catch {
      if (cache3 && cache3.file === file) return cache3.plan;
    }
    cache3 = { file, mtime: st.mtimeMs, size: st.size, plan };
    return plan;
  }
  return null;
}
var NAMES, cache3;
var init_plan = __esm({
  "server/plan.ts"() {
    "use strict";
    init_config();
    NAMES = {
      claude_pro: "Pro",
      claude_max: "Max",
      claude_team: "Team",
      claude_enterprise: "Enterprise"
    };
    cache3 = null;
  }
});

// server/tree.ts
function pendingList(s) {
  return Object.entries(s.carry.pending).map(([id, p]) => ({ id, ...p }));
}
function subagentDone(s, now, sessionAlive) {
  if (s.meta?.finished === true) return true;
  if (!sessionAlive) return true;
  const pend = pendingList(s);
  if (s.carry.lastStop === "end_turn" && pend.length === 0) return true;
  const quiet = now - s.lastTs;
  if (quiet > SUB_STALE_MS) return true;
  if (quiet > SUB_QUIET_MS && pend.length === 0) return true;
  return false;
}
function agentStatus(s, now, gate = null) {
  const pend = pendingList(s).filter((p) => p.name !== "Agent" && p.name !== "Task");
  const quiet = now - s.lastTs;
  if (knownPid(gate)) {
    if (pend.length) return gate === "waiting" ? "waiting" : "working";
  } else if (pend.length && quiet > WAIT_MS && pend.some((p) => now - p.ts > WAIT_MS)) return "waiting";
  if (quiet < WORKING_MS) return "working";
  if (pendingList(s).length) return "working";
  if (s.carry.lastStop === "tool_use") return "working";
  return "idle";
}
function buildTree(main, subs, now, sessionAlive, includeDone, gate = null) {
  const owner = /* @__PURE__ */ new Map();
  const spawnInfo = /* @__PURE__ */ new Map();
  if (main) for (const [id, sp] of Object.entries(main.spawns)) {
    owner.set(id, "main");
    spawnInfo.set(id, sp);
  }
  for (const s of subs) for (const [id, sp] of Object.entries(s.spawns)) {
    owner.set(id, s.agentId);
    spawnInfo.set(id, sp);
  }
  const mkNode = (s, id, depth, status) => ({
    id,
    type: id === "main" ? "main" : s?.meta?.agentType ?? (s?.meta?.toolUseId ? spawnInfo.get(s.meta.toolUseId)?.type : void 0) ?? "general-purpose",
    description: id === "main" ? null : s?.meta?.description ?? (s?.meta?.toolUseId ? spawnInfo.get(s.meta.toolUseId)?.desc ?? null : null),
    depth,
    status,
    model: s?.model ?? null,
    effort: s?.effort ?? null,
    currentTool: s?.carry.lastTool ?? null,
    lastText: s?.carry.lastText ?? null,
    startedAt: s?.firstTs ?? now,
    lastActivity: s?.lastTs ?? now,
    tokens: toTokens(s?.total ?? [0, 0, 0, 0]),
    toolCalls: s?.toolCalls ?? 0,
    finishedChildren: 0,
    children: []
  });
  const rootStatus = !main ? "idle" : !sessionAlive ? "done" : agentStatus(main, now, gate);
  const root = mkNode(main, "main", 0, rootStatus);
  const nodes = /* @__PURE__ */ new Map();
  const finished = [];
  let active = 0;
  let working = 0;
  for (const s of subs) {
    const done = subagentDone(s, now, sessionAlive);
    const st = done ? "done" : agentStatus(s, now, gate);
    const parent = s.meta?.toolUseId ? owner.get(s.meta.toolUseId) ?? "main" : "main";
    const depth = s.meta?.spawnDepth ?? 1;
    nodes.set(s.agentId, { node: mkNode(s, s.agentId, depth, st), parent, done });
    if (done) finished.push({ s, parentId: parent });
    else {
      active++;
      if (st === "working" || st === "waiting") working++;
    }
  }
  const visible = /* @__PURE__ */ new Set();
  for (const [id, n] of nodes) {
    if (includeDone || !n.done) {
      let cur = id;
      let guard = 0;
      while (cur && cur !== "main" && !visible.has(cur) && guard++ < 10) {
        visible.add(cur);
        cur = nodes.get(cur)?.parent;
      }
    }
  }
  const byId = (id) => id === "main" ? root : nodes.get(id)?.node;
  for (const [id, n] of nodes) {
    const p = byId(n.parent) ?? root;
    if (n.done) p.finishedChildren++;
    if (visible.has(id)) p.children.push(n.node);
  }
  const sortRec = (n) => {
    n.children.sort((a, b) => a.startedAt - b.startedAt);
    n.children.forEach(sortRec);
  };
  sortRec(root);
  return { root, total: subs.length, active, working, finished };
}
function waitReason(waitingFor, main, subs) {
  const wf = (waitingFor ?? "").trim();
  if (/input|question|elicit/i.test(wf)) return { k: "waitingInput" };
  if (!wf || wf === "dialog open" || /permission|approv/i.test(wf)) {
    let call = null;
    for (const f of [main, ...subs]) {
      for (const p of Object.values(f.carry.pending)) if (p.name !== "Agent" && p.name !== "Task" && (!call || p.ts > call.ts)) call = p;
    }
    if (call) return { k: "waitingPermission", a: call.name };
    return /permission|approv/i.test(wf) ? { k: "waitingPermissionAny" } : { k: "waitingYou" };
  }
  return { k: "waitingFor", a: wf };
}
function sessionStatus(main, subs, tree, now, alive, pidStatus, waitingFor = null) {
  if (!alive) return { status: "stopped", reason: { k: "processEnded" } };
  if (!main) return { status: pidStatus === "waiting" ? "waiting" : "idle", reason: pidStatus === "waiting" ? { k: "waitingYou" } : { k: "justStarted" } };
  if (pidStatus === "waiting") return { status: "waiting", reason: waitReason(waitingFor, main, subs) };
  const lastAct = Math.max(main.lastTs, ...subs.map((s) => s.lastTs));
  const pend = Object.values(main.carry.pending).filter((p) => p.name !== "Agent" && p.name !== "Task");
  const oldest = pend.reduce((m, p) => Math.min(m, p.ts), Infinity);
  const asks = main.permissionMode !== "bypassPermissions";
  if (!knownPid(pidStatus) && asks && pend.length && now - oldest > WAIT_MS && now - lastAct > WAIT_MS) {
    const p = pend.find((x) => x.ts === oldest);
    return { status: "waiting", reason: { k: "probablyPermission", a: p.name } };
  }
  if (now - main.lastTs < WORKING_MS) return { status: "working", reason: main.carry.lastTool && pend.length ? { k: "running", a: main.carry.lastTool } : { k: "working" } };
  if (tree.working > 0) return { status: "working", reason: { k: "subagentsWorking", a: tree.working } };
  if (pend.length) return { status: "working", reason: { k: "running", a: pend[pend.length - 1].label } };
  if (pidStatus === "busy") return { status: "working", reason: { k: "working" } };
  if (main.carry.lastStop === "end_turn") return { status: "idle", reason: { k: "answerReady" } };
  return { status: "idle", reason: null };
}
var WORKING_MS, WAIT_MS, SUB_QUIET_MS, SUB_STALE_MS, knownPid;
var init_tree = __esm({
  "server/tree.ts"() {
    "use strict";
    init_util();
    WORKING_MS = 2e4;
    WAIT_MS = 1e4;
    SUB_QUIET_MS = 10 * 6e4;
    SUB_STALE_MS = 30 * 6e4;
    knownPid = (g) => g === "busy" || g === "idle" || g === "waiting";
  }
});

// server/live.ts
import { EventEmitter as EventEmitter2 } from "node:events";
import fs10 from "node:fs";
import path11 from "node:path";
function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e?.code === "EPERM";
  }
}
function readPidFiles(dir = SESSIONS_DIR) {
  const out = /* @__PURE__ */ new Map();
  let names3 = [];
  try {
    names3 = fs10.readdirSync(dir);
  } catch {
    return out;
  }
  for (const n of names3) {
    if (!/^\d+\.json$/.test(n)) continue;
    try {
      const j = JSON.parse(fs10.readFileSync(path11.join(dir, n), "utf8"));
      const pid = Number(j.pid ?? n.split(".")[0]);
      if (!j.sessionId) continue;
      const info = {
        pid,
        sessionId: String(j.sessionId),
        cwd: j.cwd ?? null,
        startedAt: typeof j.startedAt === "number" ? j.startedAt : null,
        name: j.name ?? null,
        status: typeof j.status === "string" ? j.status : null,
        alive: isAlive(pid),
        waitingFor: typeof j.waitingFor === "string" ? j.waitingFor : null,
        kind: typeof j.kind === "string" ? j.kind : null,
        entrypoint: typeof j.entrypoint === "string" ? j.entrypoint : null
      };
      const prev = out.get(info.sessionId);
      if (!prev || !prev.alive && info.alive) out.set(info.sessionId, info);
    } catch {
    }
  }
  return out;
}
function readHeadOrigin(file) {
  const out = { entrypoint: null, promptOrigin: null };
  let fd = null;
  try {
    fd = fs10.openSync(file, "r");
    const buf = Buffer.alloc(HEAD_BYTES);
    const n = fs10.readSync(fd, buf, 0, HEAD_BYTES, 0);
    const lines = buf.subarray(0, n).toString("utf8").split("\n");
    if (n === HEAD_BYTES) lines.pop();
    for (const line of lines) {
      if (!line.includes('"entrypoint"') && !line.includes('"promptSource"') && !line.includes('"turnOrigin"')) continue;
      let d;
      try {
        d = JSON.parse(line);
      } catch {
        continue;
      }
      if (!out.entrypoint && typeof d?.entrypoint === "string") out.entrypoint = d.entrypoint;
      if (!out.promptOrigin && d?.type === "user" && !d.isMeta) {
        const o = d.turnOrigin ?? d.promptSource;
        if (typeof o === "string" && o) out.promptOrigin = o;
      }
      if (out.entrypoint && out.promptOrigin) break;
    }
  } catch {
  } finally {
    if (fd !== null) try {
      fs10.closeSync(fd);
    } catch {
    }
  }
  return out;
}
function tokensSince(s, cutoff, into) {
  if (s.lastTs < cutoff) return into;
  const fromDate = localDate(cutoff);
  for (const [date, b] of Object.entries(s.days)) {
    if (date < fromDate) continue;
    const [y, m, d] = date.split("-").map(Number);
    for (const [h, t] of Object.entries(b.hours)) {
      const start = new Date(y, m - 1, d, Number(h)).getTime();
      if (start + 36e5 > cutoff) addT4(into, t);
    }
  }
  return into;
}
function limitsFromStatusline(j, updatedAt) {
  const rl = j && typeof j.rate_limits === "object" && j.rate_limits ? j.rate_limits : {};
  const num = (v) => typeof v === "number" && Number.isFinite(v) ? v : null;
  const sec = (v) => num(v) === null ? null : v < 1e12 ? v * 1e3 : v;
  const fiveHourPct = num(rl.five_hour?.used_percentage);
  const sevenDayPct = num(rl.seven_day?.used_percentage);
  const fiveHourWindow = fiveHourPct != null ? "present" : sevenDayPct != null ? "none" : "unknown";
  return {
    fiveHourPct,
    fiveHourResetsAt: fiveHourPct == null ? null : sec(rl.five_hour?.resets_at),
    sevenDayPct,
    sevenDayResetsAt: sec(rl.seven_day?.resets_at),
    updatedAt,
    fiveHourWindow
  };
}
function readLimits() {
  try {
    const file = fs10.existsSync(STATUSLINE_FILE) || !fs10.existsSync(LEGACY_STATUSLINE_FILE) ? STATUSLINE_FILE : LEGACY_STATUSLINE_FILE;
    const st = fs10.statSync(file);
    return { capture: true, limits: limitsFromStatusline(JSON.parse(fs10.readFileSync(file, "utf8")), Math.round(st.mtimeMs)) };
  } catch {
    return { limits: null, capture: false };
  }
}
var DAY_MS2, HEAD_BYTES, Live;
var init_live = __esm({
  "server/live.ts"() {
    "use strict";
    init_automation();
    init_config();
    init_plan();
    init_i18n();
    init_cowork();
    init_titles();
    init_tree();
    init_util();
    DAY_MS2 = 24 * 36e5;
    HEAD_BYTES = 64 * 1024;
    Live = class extends EventEmitter2 {
      constructor(store2, hooks2) {
        super();
        this.store = store2;
        this.hooks = hooks2;
        this.pids = readPidFiles();
        store2.on("file", (s, events, isNew) => this.onFile(s, events, isNew));
      }
      store;
      hooks;
      pids = /* @__PURE__ */ new Map();
      /** "Open in terminal": where a live session's terminal is (set by the server; tests leave it unset). */
      terminalOf = null;
      statusMem = /* @__PURE__ */ new Map();
      finishedMem = /* @__PURE__ */ new Map();
      cache = null;
      timers = [];
      watchers = [];
      pending = /* @__PURE__ */ new Map();
      baseline = false;
      /** Automation signals read from the head of pre-0.2.1 summaries' transcripts, by path. */
      heads = /* @__PURE__ */ new Map();
      /** Subscription-limit forecast for the snapshot (set by the server; see limits-forecast.ts). */
      forecast = null;
      emitEvent(e) {
        this.cache = null;
        this.emit("event", e);
      }
      onFile(s, events, isNew) {
        this.cache = null;
        const agentId = s.agentId ?? "main";
        const sid = s.sessionId;
        if (isNew && s.agentId) {
          const main = this.store.mainOf(sid);
          const subs = this.store.sessionFiles(sid).filter((x) => x.agentId);
          let parentId = "main";
          if (s.meta?.toolUseId) {
            if (main?.spawns[s.meta.toolUseId]) parentId = "main";
            else for (const x of subs) if (x.spawns[s.meta.toolUseId]) parentId = x.agentId;
          }
          this.emit("event", { kind: "spawn", ts: s.firstTs || Date.now(), sessionId: sid, parentId, agentId, agentType: s.meta?.agentType ?? "general-purpose", description: s.meta?.description ?? null });
        }
        const fresh = Date.now() - 5 * 6e4;
        for (const e of events) {
          if (e.ts < fresh) continue;
          if (e.kind === "tool") this.emit("event", { kind: "tool", ts: e.ts, sessionId: sid, agentId, tool: e.name, label: e.label });
          else if (e.kind === "text") this.emit("event", { kind: "text", ts: e.ts, sessionId: sid, agentId, text: e.text });
          else if (e.kind === "prompt" && !s.agentId) this.emit("event", { kind: "prompt", ts: e.ts, sessionId: sid });
          else if (e.kind === "compact") this.emit("event", { kind: "compact", ts: e.ts, sessionId: sid });
        }
      }
      start() {
        try {
          const w = fs10.watch(PROJECTS_DIR, { recursive: true }, (_ev, name) => {
            if (!name) return;
            const f = String(name);
            if (f.endsWith(".jsonl")) this.schedule(path11.join(PROJECTS_DIR, f));
            else if (f.endsWith(".meta.json")) this.schedule(path11.join(PROJECTS_DIR, f.replace(/\.meta\.json$/, ".jsonl")));
          });
          this.watchers.push(w);
        } catch (e) {
          console.warn("[clorbit] fs.watch on projects is unavailable:", e.message);
        }
        if (this.store.coworkDir && fs10.existsSync(this.store.coworkDir)) {
          try {
            const dir = this.store.coworkDir;
            const w = fs10.watch(dir, { recursive: true }, (_ev, name) => {
              if (!name) return;
              const f = String(name);
              if (!f.includes(`${path11.sep}.claude${path11.sep}projects${path11.sep}`)) {
                if (/local_[\w-]+\.json$/.test(f)) this.cache = null;
                return;
              }
              if (f.endsWith(".jsonl")) this.schedule(path11.join(dir, f));
              else if (f.endsWith(".meta.json")) this.schedule(path11.join(dir, f.replace(/\.meta\.json$/, ".jsonl")));
            });
            this.watchers.push(w);
          } catch (e) {
            console.warn("[clorbit] fs.watch on Cowork sessions is unavailable:", e.message);
          }
        }
        try {
          const w = fs10.watch(SESSIONS_DIR, () => this.schedule("__sessions__"));
          this.watchers.push(w);
        } catch {
        }
        this.timers.push(setInterval(() => this.poll(), 3e3));
        this.timers.push(setInterval(() => this.relist(), 6e4));
        this.timers.push(setInterval(() => this.tick(), 2e3));
        this.store.on("scan-done", () => this.relist());
      }
      stop() {
        for (const t of this.timers) clearInterval(t);
        for (const w of this.watchers) w.close();
        for (const t of this.pending.values()) clearTimeout(t);
      }
      schedule(key) {
        if (this.pending.has(key)) return;
        this.pending.set(key, setTimeout(() => {
          this.pending.delete(key);
          if (key === "__sessions__") {
            this.pids = readPidFiles();
            this.cache = null;
            return;
          }
          if (!this.store.scanDone && !this.store.files.has(key)) return;
          void this.store.refresh(key);
        }, 200));
      }
      poll() {
        const now = Date.now();
        this.pids = readPidFiles();
        for (const s of this.store.files.values()) {
          const live2 = this.pids.get(s.sessionId)?.alive || now - s.lastTs < 10 * 6e4;
          if (!live2) continue;
          try {
            const st = fs10.statSync(s.path);
            if (st.size !== s.size || st.mtimeMs !== s.mtimeMs) void this.store.refresh(s.path);
          } catch {
          }
        }
        if (this.store.scanDone) {
          const liveIds = [...this.pids.values()].filter((p) => p.alive).map((p) => p.sessionId);
          for (const s of this.store.files.values()) if (s.agentId === null && now - s.lastTs < COWORK_LIVE_MS && this.store.isCowork(s.path)) liveIds.push(s.sessionId);
          for (const sid of liveIds) {
            const main = this.store.mainOf(sid);
            const dir = main ? path11.join(path11.dirname(main.path), sid, "subagents") : null;
            if (!dir) continue;
            try {
              for (const f of fs10.readdirSync(dir)) {
                if (f.startsWith("agent-") && f.endsWith(".jsonl")) {
                  const full = path11.join(dir, f);
                  if (!this.store.files.has(full)) void this.store.refresh(full);
                }
              }
            } catch {
            }
          }
        }
      }
      relist() {
        if (!this.store.scanDone) return;
        for (const f of this.store.listAll()) if (!this.store.files.has(f)) void this.store.refresh(f);
      }
      /** Compares statuses with the previous tick and broadcasts changes. */
      tick() {
        this.cache = null;
        const { v: snap, reasons } = this.compute();
        const emit = this.baseline;
        for (const ls of snap.sessions) {
          const prev = this.statusMem.get(ls.sessionId);
          if (emit && prev && prev.status !== ls.status) {
            this.emit("event", { kind: "status", ts: snap.now, sessionId: ls.sessionId, status: ls.status, reason: reasons.get(ls.sessionId) ?? null });
          }
        }
        for (const ls of snap.sessions) {
          const known2 = this.finishedMem.get(ls.sessionId) ?? /* @__PURE__ */ new Set();
          const subs = this.store.sessionFiles(ls.sessionId).filter((s) => s.agentId);
          const alive = ls.alive;
          for (const s of subs) {
            if (known2.has(s.agentId)) continue;
            if (subagentDone(s, snap.now, alive)) {
              known2.add(s.agentId);
              if (emit && snap.now - s.lastTs < 15 * 6e4) {
                const parent = s.meta?.toolUseId ? this.parentOf(ls.sessionId, s.meta.toolUseId) : "main";
                this.emit("event", { kind: "finish", ts: snap.now, sessionId: ls.sessionId, agentId: s.agentId, parentId: parent, tokens: sumT4(s.total) });
              }
            }
          }
          this.finishedMem.set(ls.sessionId, known2);
        }
        if (this.store.scanDone) {
          this.baseline = true;
          if (this.listenerCount("snapshot")) this.emit("snapshot", this.snapshot("en"));
        }
      }
      /** Are there any Cowork transcripts at all (for the galaxy's Cowork switch)? */
      hasCowork() {
        if (!this.store.coworkDir) return false;
        if (this.coworkMemo.v === this.store.version) return this.coworkMemo.has;
        let has = false;
        for (const f of this.store.files.keys()) if (this.store.isCowork(f)) {
          has = true;
          break;
        }
        this.coworkMemo = { v: this.store.version, has };
        return has;
      }
      coworkMemo = { v: -1, has: false };
      /** Interactive or automated (see shared/automation.ts), with the entrypoint it was decided by. */
      kindOf(sessionId, main = this.store.mainOf(sessionId) ?? null, pid = this.pids.get(sessionId) ?? null) {
        let entrypoint = main?.entrypoint ?? null;
        let promptOrigin = main?.promptOrigin ?? null;
        if (main && (main.entrypoint === void 0 || main.promptOrigin === void 0)) {
          let h = this.heads.get(main.path);
          if (!h) {
            h = readHeadOrigin(main.path);
            this.heads.set(main.path, h);
            if (this.heads.size > 5e3) this.heads.clear();
          }
          entrypoint = entrypoint ?? h.entrypoint;
          if (main.promptOrigin === void 0) promptOrigin = h.promptOrigin;
        }
        const kind = sessionKind({ pidKind: pid?.kind, pidEntrypoint: pid?.entrypoint, entrypoint, promptOrigin });
        return { kind, entrypoint: entrypoint ?? pid?.entrypoint ?? null };
      }
      /** Project and agent names of an event, resolved now (see EventContext). */
      context(e) {
        const files = this.store.sessionFiles(e.sessionId);
        const main = files.find((f) => f.agentId === null) ?? null;
        const any = main ?? files[0] ?? null;
        const pid = this.pids.get(e.sessionId);
        const cwd = pid?.cwd ?? any?.cwd ?? "";
        const project = cwd || any?.projectDir ? projectOf(cwd, any?.projectDir) : null;
        const typeOf = (id) => {
          if (!id || id === "main") return null;
          const f = files.find((x) => x.agentId === id);
          return f?.meta?.agentType ?? null;
        };
        const agentId = "agentId" in e ? e.agentId : void 0;
        const agentName = e.kind === "spawn" ? e.agentType : typeOf(agentId);
        const parentName = "parentId" in e ? typeOf(e.parentId) : null;
        return { project, agentName, parentName, automated: this.kindOf(e.sessionId, main, pid ?? null).kind === "automated" };
      }
      parentOf(sessionId, toolUseId) {
        for (const s of this.store.sessionFiles(sessionId)) if (s.spawns[toolUseId]) return s.agentId ?? "main";
        return "main";
      }
      /** The live snapshot with status reasons rendered in the given language. */
      snapshot(lang = "en") {
        const { v, reasons } = this.compute();
        return {
          ...v,
          sessions: v.sessions.map((s) => {
            const r = reasons.get(s.sessionId);
            const { code, arg } = reasonCode(r);
            return { ...s, statusReason: reasonText(r, lang), statusCode: code, statusArg: arg };
          })
        };
      }
      compute() {
        const now = Date.now();
        if (this.cache && now - this.cache.at < 500) return this.cache;
        const reasons = /* @__PURE__ */ new Map();
        const cutoff = now - DAY_MS2;
        const today = localDate(now);
        const sessionIds = /* @__PURE__ */ new Set();
        for (const p of this.pids.values()) if (p.alive) sessionIds.add(p.sessionId);
        const recentFiles = [];
        for (const s of this.store.files.values()) {
          if (s.lastTs >= cutoff) {
            recentFiles.push(s);
            sessionIds.add(s.sessionId);
          }
        }
        const t24 = zeroT4();
        const tToday = zeroT4();
        const projects = /* @__PURE__ */ new Set();
        const nowMin = Math.floor(now / 6e4);
        const burn = new Array(30).fill(0);
        let burn10 = 0;
        let finished24 = 0;
        for (const s of recentFiles) {
          tokensSince(s, cutoff, t24);
          const td = s.days[today];
          if (td) addT4(tToday, td.t);
          for (const [k, v2] of Object.entries(s.minutes)) {
            const age = nowMin - Number(k);
            if (age >= 0 && age < 30) burn[29 - age] += v2;
            if (age >= 0 && age < 10) burn10 += v2;
          }
        }
        const sessions2 = [];
        let working = 0, waiting = 0, workingSubs = 0, alive = 0;
        let coworkSeen = false;
        for (const sid of sessionIds) {
          const files = this.store.sessionFiles(sid);
          const main = files.find((f) => f.agentId === null) ?? null;
          const subs = files.filter((f) => f.agentId !== null);
          const pid = this.pids.get(sid) ?? null;
          const cowork = !!main && this.store.isCowork(main.path);
          const cmeta = cowork ? coworkMetaOf(main.path, this.store.coworkDir) : null;
          const isAlive2 = cowork ? !cmeta?.archived && now - Math.max(main.lastTs, ...subs.map((s) => s.lastTs)) < COWORK_LIVE_MS : !!pid?.alive;
          const pidStatus = pid?.status ?? null;
          const tree = buildTree(main, subs, now, isAlive2, false, pidStatus);
          let st = sessionStatus(main, subs, tree, now, isAlive2, pidStatus, pid?.waitingFor ?? null);
          const lastActivity = Math.max(main?.lastTs ?? 0, ...subs.map((s) => s.lastTs), pid?.startedAt ?? 0);
          const hs = this.hooks.bySession.get(sid);
          if (hs && isAlive2 && hs.ts + 3e3 >= lastActivity) {
            if (pidStatus === "busy" || pidStatus === "idle" || pidStatus === "waiting") {
              if (pidStatus === "waiting" && hs.status === "waiting") st = { status: "waiting", reason: hs.reason };
              else if (pidStatus === "idle" && hs.status === "waiting" && hs.reason?.k === "waitingInput") st = { status: "waiting", reason: hs.reason };
            } else st = { status: hs.status, reason: hs.reason };
          }
          const mem = this.statusMem.get(sid);
          const since = mem && mem.status === st.status ? mem.since : mem ? now : lastActivity || now;
          this.statusMem.set(sid, { status: st.status, since, reason: st.reason });
          reasons.set(sid, st.reason);
          const total = zeroT4();
          const s24 = zeroT4();
          for (const f of files) {
            addT4(total, f.total);
            tokensSince(f, cutoff, s24);
          }
          const cwd = pid?.cwd ?? main?.cwd ?? subs[0]?.cwd ?? "";
          const project = cowork && coworkProject(main.path, this.store.coworkDir) || projectOf(cwd, main?.projectDir ?? subs[0]?.projectDir);
          if (sumT4(s24) > 0) projects.add(project);
          for (const f of subs) if (f.lastTs >= cutoff && subagentDone(f, now, isAlive2)) finished24++;
          const k = this.kindOf(sid, main, pid);
          if (isAlive2) alive++;
          if (st.status === "working") working++;
          if (st.status === "waiting") waiting++;
          workingSubs += tree.working;
          sessions2.push({
            sessionId: sid,
            pid: pid?.pid ?? null,
            alive: isAlive2,
            ...titleFields(sid, main, this.store.coworkDir),
            name: pid?.name ?? null,
            cwd,
            project,
            gitBranch: main?.gitBranch ?? null,
            model: main?.model ?? null,
            effort: main?.effort ?? null,
            permissionMode: main?.permissionMode ?? null,
            status: st.status,
            statusSince: since,
            statusReason: null,
            startedAt: pid?.startedAt ?? main?.firstTs ?? now,
            lastActivity: lastActivity || now,
            tokens: toTokens(total),
            tokens24h: sumT4(s24),
            contextTokens: main && main.carry.lastCtx ? main.carry.lastCtx : null,
            contextLimit: main ? contextLimitFor(main.model, main.requestedModel, main.carry.maxCtx) : null,
            subagentsTotal: tree.total,
            subagentsActive: tree.active,
            compactions: main?.compactions ?? 0,
            root: tree.root,
            kind: k.kind,
            terminal: isAlive2 && pid && this.terminalOf ? this.terminalOf(pid) : null,
            entrypoint: k.entrypoint,
            ...cowork ? { source: "cowork" } : {}
          });
          if (cowork) coworkSeen = true;
        }
        const order = { waiting: 0, working: 1, idle: 2, stopped: 3 };
        sessions2.sort((a, b) => order[a.status] - order[b.status] || b.lastActivity - a.lastActivity);
        const lim = readLimits();
        let limitsForecast = null;
        try {
          limitsForecast = this.forecast ? this.forecast(lim.limits, now) : null;
        } catch (e) {
          console.error("[clorbit] limits forecast failed:", e.message);
        }
        const t24tok = toTokens(t24);
        const denom = t24[0] + t24[2] + t24[3];
        const v = {
          now,
          sessions: sessions2,
          totals: {
            tokens24h: t24tok,
            tokensToday: toTokens(tToday),
            burnPerMin: Math.round(burn10 / 10),
            burnSeries: burn,
            activeSessions: alive,
            workingSessions: working,
            waitingSessions: waiting,
            workingSubagents: workingSubs,
            finishedSubagents24h: finished24,
            cacheHitRate24h: denom ? t24[2] / denom : 0,
            projects24h: projects.size
          },
          limits: lim.limits,
          limitsForecast,
          plan: readPlan(),
          // Hooks count as installed when the clorbit plugin (or legacy fleet-hooks) is enabled, or events already arrived.
          hooksInstalled: hookPluginEnabled() || this.hooks.installed,
          statuslineCapture: lim.capture,
          cowork: coworkSeen || this.hasCowork(),
          scan: { done: this.store.scanDone, filesTotal: this.store.stats.filesTotal, filesDone: this.store.stats.filesDone }
        };
        this.cache = { at: now, v, reasons };
        return this.cache;
      }
    };
  }
});

// server/recent-events.ts
function consoleWorthy(e) {
  if (e.kind === "text") return false;
  if (e.kind === "status") return e.status === "waiting";
  return true;
}
var RECENT_MAX, RecentEvents;
var init_recent_events = __esm({
  "server/recent-events.ts"() {
    "use strict";
    init_i18n();
    RECENT_MAX = 500;
    RecentEvents = class {
      constructor(max = RECENT_MAX) {
        this.max = max;
      }
      max;
      buf = [];
      push(e, ctx) {
        if (!consoleWorthy(e)) return;
        this.buf.push({ ...e, ...ctx });
        if (this.buf.length > this.max) this.buf.splice(0, this.buf.length - this.max);
      }
      /** The newest `limit` events, oldest first, with status reasons in the given language. */
      list(lang, limit = this.max) {
        const n = Math.max(0, Math.min(this.max, Math.floor(limit) || 0));
        return this.buf.slice(this.buf.length - n).map((e) => ({ ...localizeEvent(e, lang), project: e.project, agentName: e.agentName, parentName: e.parentName, ...e.automated ? { automated: true } : {} }));
      }
      get size() {
        return this.buf.length;
      }
    };
  }
});

// shared/notify.ts
function resetKey(at) {
  return at ? String(Math.round(at / 6e4)) : "unknown";
}
function waitKind(code) {
  if (code === "waitingInput") return "input";
  if (code === "waitingPermission" || code === "probablyPermission" || code === "waitingPermissionAny") return "permission";
  return "you";
}
var CONTEXT_HIGH, CONTEXT_REARM, LIMIT_HIGH, LIMIT_REARM, sameWindow, NotifyDetector;
var init_notify = __esm({
  "shared/notify.ts"() {
    "use strict";
    init_forecast();
    CONTEXT_HIGH = 0.85;
    CONTEXT_REARM = 0.75;
    LIMIT_HIGH = 80;
    LIMIT_REARM = 75;
    sameWindow = (a, b) => a != null && Math.abs(a - b) <= 10 * 6e4;
    NotifyDetector = class {
      // dedupe keys → ts
      /** @param includeAutomated read on every decision, so a settings change applies at once. */
      constructor(includeAutomated = () => false) {
        this.includeAutomated = includeAutomated;
      }
      includeAutomated;
      sessions = /* @__PURE__ */ new Map();
      baseline = false;
      limitNotified = { "5h": null, "7d": null };
      /** Reset time of the 5 h window whose early warning was already given. */
      forecastNotified = null;
      agentTypes = /* @__PURE__ */ new Map();
      seen = /* @__PURE__ */ new Map();
      get ready() {
        return this.baseline;
      }
      /** Sessions that wait for you or work right now, counted like notifications (live process; automated
       *  runs only when included). Drives the tab badge; follows status events between snapshots. */
      counts() {
        let waiting = 0;
        let working = 0;
        for (const st of this.sessions.values()) {
          if (!this.notifies(st)) continue;
          if (st.status === "waiting") waiting++;
          else if (st.status === "working") working++;
        }
        return { waiting, working };
      }
      /** A session that may notify right now. */
      notifies(st) {
        return st.alive && (!st.automated || this.includeAutomated());
      }
      onSnapshot(snap) {
        const res = { events: [], resolved: [] };
        const now = snap.now;
        for (const s of snap.sessions) if (s.root) this.learnAgents(s.sessionId, s.root);
        if (!this.baseline) {
          for (const s of snap.sessions) {
            const fill = s.contextTokens && s.contextLimit ? s.contextTokens / s.contextLimit : 0;
            this.sessions.set(s.sessionId, {
              status: s.status,
              statusTs: now,
              alive: s.alive,
              project: s.project,
              code: s.statusCode ?? null,
              arg: s.statusArg ?? null,
              waitNotified: s.status === "waiting",
              ctxNotified: fill > CONTEXT_HIGH,
              automated: s.kind === "automated"
            });
          }
          for (const w of ["5h", "7d"]) {
            const { pct: pct3, key } = this.limitOf(snap.limits, w);
            if (pct3 != null && pct3 > LIMIT_HIGH) this.limitNotified[w] = key;
          }
          const f2 = snap.limitsForecast?.fiveHour;
          if (f2 && forecastWarns(f2)) this.forecastNotified = f2.resetsAt;
          this.baseline = true;
          return res;
        }
        const present = /* @__PURE__ */ new Set();
        for (const s of snap.sessions) {
          present.add(s.sessionId);
          let st = this.sessions.get(s.sessionId);
          if (!st) {
            st = { status: "idle", statusTs: 0, alive: s.alive, project: s.project, code: null, arg: null, waitNotified: false, ctxNotified: false, automated: s.kind === "automated" };
            this.sessions.set(s.sessionId, st);
          }
          st.alive = s.alive;
          st.project = s.project;
          st.automated = s.kind === "automated";
          if (now >= st.statusTs) this.applyStatus(s.sessionId, st, s.status, now, s.statusCode ?? null, s.statusArg ?? null, res);
          const fill = s.contextTokens && s.contextLimit ? s.contextTokens / s.contextLimit : 0;
          if (fill > CONTEXT_HIGH && !st.ctxNotified && this.notifies(st)) {
            st.ctxNotified = true;
            res.events.push({ type: "context_high", ts: now, sessionId: s.sessionId, project: st.project, pct: Math.round(fill * 100) });
          } else if (fill < CONTEXT_REARM) st.ctxNotified = false;
        }
        for (const [sid, st] of this.sessions) {
          if (present.has(sid)) continue;
          if (st.status === "waiting") res.resolved.push(sid);
          this.sessions.delete(sid);
        }
        for (const w of ["5h", "7d"]) {
          const { pct: pct3, key } = this.limitOf(snap.limits, w);
          if (pct3 == null) continue;
          if (pct3 > LIMIT_HIGH && this.limitNotified[w] !== key) {
            this.limitNotified[w] = key;
            res.events.push({ type: "limit_high", ts: now, sessionId: null, project: null, pct: Math.round(pct3), window: w });
          } else if (pct3 < LIMIT_REARM) this.limitNotified[w] = null;
        }
        const f = snap.limitsForecast?.fiveHour;
        if (f && forecastWarns(f)) {
          if (!sameWindow(this.forecastNotified, f.resetsAt)) {
            this.forecastNotified = f.resetsAt;
            res.events.push({ type: "limit_forecast", ts: now, sessionId: null, project: null, pct: Math.round(f.pct ?? 0), window: "5h", at: f.hitsAt, resetsAt: f.resetsAt });
          }
        }
        this.gc(now);
        return res;
      }
      onEvent(e) {
        const res = { events: [], resolved: [] };
        if (!this.baseline) return res;
        const st = this.sessions.get(e.sessionId);
        if (e.kind === "spawn") this.agentTypes.set(`${e.sessionId}:${e.agentId}`, e.agentType);
        if (!st || !this.notifies(st)) {
          if (st && e.kind === "status") this.applyStatus(e.sessionId, st, e.status, e.ts, e.code ?? null, e.arg ?? null, res);
          return res;
        }
        const base = { ts: e.ts, sessionId: e.sessionId, project: st.project };
        switch (e.kind) {
          case "status":
            this.applyStatus(e.sessionId, st, e.status, e.ts, e.code ?? null, e.arg ?? null, res);
            break;
          case "spawn":
            if (this.once(`spawn:${e.sessionId}:${e.agentId}`, e.ts)) res.events.push({ type: "subagent_spawned", ...base, agentType: e.agentType });
            break;
          case "finish":
            if (this.once(`finish:${e.sessionId}:${e.agentId}`, e.ts)) {
              res.events.push({ type: "subagent_finished", ...base, agentType: this.agentTypes.get(`${e.sessionId}:${e.agentId}`) ?? null });
            }
            break;
          case "compact": {
            const last = this.seen.get(`compact:${e.sessionId}`);
            this.seen.set(`compact:${e.sessionId}`, e.ts);
            if (last == null || Math.abs(e.ts - last) > 12e4) res.events.push({ type: "compaction", ...base });
            break;
          }
        }
        return res;
      }
      applyStatus(sid, st, status, ts, code, arg, res) {
        if (ts < st.statusTs) return;
        const prev = st.status;
        st.statusTs = ts;
        if (status === prev) {
          if (code) {
            st.code = code;
            st.arg = arg;
          }
          return;
        }
        st.status = status;
        st.code = code;
        st.arg = arg;
        if (prev === "waiting") {
          st.waitNotified = false;
          res.resolved.push(sid);
        }
        if (!this.notifies(st)) return;
        if (status === "waiting" && !st.waitNotified) {
          st.waitNotified = true;
          res.events.push({ type: "session_waiting", ts, sessionId: sid, project: st.project, wait: waitKind(code), tool: arg });
        } else if (prev === "working" && status === "idle") {
          res.events.push({ type: "session_done", ts, sessionId: sid, project: st.project });
        }
      }
      limitOf(l, w) {
        if (!l || w === "5h" && l.fiveHourWindow === "none") return { pct: null, key: "" };
        const pct3 = w === "5h" ? l.fiveHourPct : l.sevenDayPct;
        const at = w === "5h" ? l.fiveHourResetsAt : l.sevenDayResetsAt;
        return { pct: pct3, key: resetKey(at) };
      }
      learnAgents(sid, n) {
        if (n.depth > 0) this.agentTypes.set(`${sid}:${n.id}`, n.type);
        for (const c of n.children) this.learnAgents(sid, c);
      }
      once(key, ts) {
        if (this.seen.has(key)) return false;
        this.seen.set(key, ts);
        return true;
      }
      gc(now) {
        if (this.seen.size > 4e3) {
          for (const [k, ts] of this.seen) if (now - ts > 36e5) this.seen.delete(k);
        }
        if (this.agentTypes.size > 4e3) this.agentTypes.clear();
      }
    };
  }
});

// server/notifier.ts
import { execFile } from "node:child_process";
import fs11 from "node:fs";
import path12 from "node:path";
function escapeAppleScript(s) {
  return s.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
function notifierCommand(tool, title, body) {
  const t = clean(title, 80);
  const b = clean(body, MAX_BODY);
  if (tool === "osascript") {
    return { file: "osascript", args: ["-e", `display notification "${escapeAppleScript(b)}" with title "${escapeAppleScript(t)}"`] };
  }
  return { file: "notify-send", args: ["--app-name=Clorbit", "--", t, b] };
}
function executable(file) {
  try {
    fs11.accessSync(file, fs11.constants.X_OK);
    return fs11.statSync(file).isFile();
  } catch {
    return false;
  }
}
function detectTool(platform = process.platform, pathEnv = process.env.PATH ?? "") {
  if (platform === "darwin") return executable("/usr/bin/osascript") ? "osascript" : null;
  if (platform === "linux") {
    for (const dir of pathEnv.split(path12.delimiter)) if (dir && executable(path12.join(dir, "notify-send"))) return "notify-send";
  }
  return null;
}
function notificationBody(ev, lang) {
  const p = ev.project ?? "";
  const agent = ev.agentType || notifyText(lang, "subagent");
  switch (ev.type) {
    case "session_waiting":
      if (ev.wait === "input") return notifyText(lang, "waitInput", { p });
      if (ev.wait === "permission") return ev.tool ? notifyText(lang, "waitPermissionTool", { p, tool: ev.tool }) : notifyText(lang, "waitPermission", { p });
      return notifyText(lang, "waitYou", { p });
    case "session_done":
      return notifyText(lang, "done", { p });
    case "subagent_finished":
      return (ev.count ?? 1) > 1 ? notifyText(lang, "finishedMany", { p, n: ev.count }) : notifyText(lang, "finished", { p, agent });
    case "subagent_spawned":
      return notifyText(lang, "spawned", { p, agent });
    case "compaction":
      return notifyText(lang, "compaction", { p });
    case "context_high":
      return notifyText(lang, "contextHigh", { p, pct: ev.pct ?? 85 });
    case "limit_high":
      return notifyText(lang, "limitHigh", { w: notifyText(lang, ev.window === "7d" ? "w7d" : "w5h"), pct: ev.pct ?? 80 });
    case "limit_forecast":
      return notifyText(lang, "limitForecast", {
        w: notifyText(lang, ev.window === "7d" ? "w7d" : "w5h"),
        time: ev.at ? clockText(ev.at) : "\u2014",
        left: ev.at && ev.resetsAt ? durationText(ev.resetsAt - ev.at, lang) : "\u2014",
        pct: ev.pct ?? 0
      });
  }
}
function clockText(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function durationText(ms, lang) {
  const m = Math.max(1, Math.round(ms / 6e4));
  return m >= 60 ? notifyText(lang, "durHM", { h: Math.floor(m / 60), m: m % 60 }) : notifyText(lang, "durM", { m });
}
var MAX_BODY, clean, defaultRunner, SystemNotifier, notifyTestBody, ServerNotifications;
var init_notifier = __esm({
  "server/notifier.ts"() {
    "use strict";
    init_notify();
    init_settings();
    init_i18n();
    MAX_BODY = 240;
    clean = (s, n) => {
      const one = s.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
      return one.length > n ? one.slice(0, n - 1) + "\u2026" : one;
    };
    defaultRunner = (cmd) => new Promise((resolve, reject) => {
      execFile(cmd.file, cmd.args, { timeout: 5e3, windowsHide: true }, (err) => err ? reject(err) : resolve());
    });
    SystemNotifier = class {
      constructor(tool = detectTool(), run = defaultRunner, now = Date.now, limit = { perMinute: 6, minGapMs: 1500, maxFailures: 3, pauseMs: 10 * 6e4 }) {
        this.tool = tool;
        this.run = run;
        this.now = now;
        this.limit = limit;
      }
      tool;
      run;
      now;
      limit;
      sent = [];
      failures = 0;
      pausedUntil = 0;
      get available() {
        return this.tool !== null;
      }
      /** Shows a notification unless rate-limited or backed off. Returns whether it was attempted. */
      send(title, body) {
        if (!this.tool) return false;
        const now = this.now();
        if (now < this.pausedUntil) return false;
        this.sent = this.sent.filter((t) => now - t < 6e4);
        if (this.sent.length >= this.limit.perMinute) return false;
        if (this.sent.length && now - this.sent[this.sent.length - 1] < this.limit.minGapMs) return false;
        this.sent.push(now);
        let cmd;
        try {
          cmd = notifierCommand(this.tool, title, body);
        } catch {
          return false;
        }
        this.run(cmd).then(
          () => {
            this.failures = 0;
          },
          (e) => {
            if (++this.failures >= this.limit.maxFailures) {
              this.pausedUntil = this.now() + this.limit.pauseMs;
              this.failures = 0;
              console.warn(`[clorbit] system notifications keep failing (${e?.message ?? e}); pausing them for 10 minutes`);
            }
          }
        );
        return true;
      }
    };
    notifyTestBody = (lang) => notifyText(lang, "test");
    ServerNotifications = class {
      constructor(settings2, notifier, now = Date.now, opts = { debounceMs: 8e3, burstMs: 2e3 }) {
        this.settings = settings2;
        this.notifier = notifier;
        this.now = now;
        this.opts = opts;
      }
      settings;
      notifier;
      now;
      opts;
      detector = new NotifyDetector(() => this.settings().interface.showAutomated);
      last = /* @__PURE__ */ new Map();
      burst = /* @__PURE__ */ new Map();
      attach(src) {
        src.on("snapshot", (s) => this.handle(this.detector.onSnapshot(s)));
        src.on("event", (e) => this.handle(this.detector.onEvent(localizeEvent(e, "en"))));
      }
      handle(res) {
        for (const ev of res.events) {
          try {
            this.consider(ev);
          } catch (e) {
            console.error("[clorbit] notification failed:", e.message);
          }
        }
      }
      consider(ev) {
        const s = this.settings();
        if (!s.notifications[ev.type]?.system || !this.notifier.available) return;
        if (ev.type === "subagent_finished") {
          const key = ev.sessionId ?? "";
          const cur = this.burst.get(key);
          if (cur) {
            cur.ev.count = (cur.ev.count ?? 1) + 1;
            return;
          }
          const timer = setTimeout(() => {
            const b = this.burst.get(key);
            this.burst.delete(key);
            if (b) this.deliver(b.ev);
          }, this.opts.burstMs);
          timer.unref?.();
          this.burst.set(key, { ev: { ...ev, count: 1 }, timer });
          return;
        }
        this.deliver(ev);
      }
      deliver(ev) {
        const s = this.settings();
        const now = this.now();
        if (isSilenced(s, now)) return;
        const key = `${ev.type}:${ev.sessionId ?? ""}:${ev.window ?? ""}`;
        const prev = this.last.get(key);
        if (prev != null && now - prev < this.opts.debounceMs) return;
        this.last.set(key, now);
        if (this.last.size > 500) {
          for (const [k, t] of this.last) if (now - t > 6e4) this.last.delete(k);
        }
        this.notifier.send("Clorbit", notificationBody(ev, s.interface.lang));
      }
    };
  }
});

// server/settings.ts
import { EventEmitter as EventEmitter3 } from "node:events";
var KEY, SettingsStore;
var init_settings2 = __esm({
  "server/settings.ts"() {
    "use strict";
    init_api();
    init_settings();
    KEY = "app";
    SettingsStore = class extends EventEmitter3 {
      constructor(db2) {
        super();
        this.db = db2;
        let saved = null;
        try {
          const raw = db2?.getSetting(KEY);
          if (raw) saved = JSON.parse(raw);
        } catch (e) {
          console.warn("[clorbit] stored settings are unreadable, using defaults:", e.message);
        }
        this.current = normalizeSettings(saved, DEFAULT_SETTINGS);
      }
      db;
      current;
      get() {
        return cloneSettings(this.current);
      }
      /** Merges a (partial) settings object, validates it, persists it and returns the result. */
      update(patch, now = Date.now()) {
        this.current = normalizeSettings(patch, this.current, now);
        try {
          this.db?.setSetting(KEY, JSON.stringify(this.current), now);
        } catch (e) {
          console.error("[clorbit] could not save settings:", e.message);
        }
        this.emit("change", this.get());
        return this.get();
      }
    };
  }
});

// server/session-detail.ts
async function sessionDetail(store2, sessionId, alive, lang = "en", pidStatus = null) {
  const files = store2.sessionFiles(sessionId);
  if (!files.length) return null;
  const sig = files.map((f) => `${f.path}:${f.size}:${store2.isMissing(f.path) ? "gone" : ""}`).sort().join("|") + `:${alive}:${pidStatus}:${lang}`;
  const key = lruKey(sessionId, lang);
  const hit = lru.get(key);
  if (hit && hit.sig === sig) {
    lru.delete(key);
    lru.set(key, hit);
    return hit.v;
  }
  const txt = detailText(lang);
  const main = files.find((f) => f.agentId === null) ?? null;
  const subs = files.filter((f) => f.agentId !== null);
  const now = Date.now();
  const tree = buildTree(main, subs, now, alive, true, pidStatus);
  let timeline = [];
  let series = [];
  const archived = files.every((f) => store2.isMissing(f.path));
  for (const f of files) {
    if (store2.isMissing(f.path)) continue;
    const sink = new DetailSink(f.agentId ?? "main", f.agentId === null, txt);
    try {
      await readLines(f.path, 0, sink);
    } catch {
      continue;
    }
    timeline.push(...sink.items);
    if (f.agentId === null) series = sink.series;
    if (f.agentId && tree.finished.some((x) => x.s === f)) {
      timeline.push({ ts: f.lastTs, agentId: f.agentId, kind: "finish", label: txt.finished(f.meta?.agentType ?? null), tokens: sumT4(f.total) });
    }
    if (timeline.length > MAX_TIMELINE * 4) {
      timeline.sort((a, b) => a.ts - b.ts);
      timeline = timeline.slice(-MAX_TIMELINE * 2);
    }
  }
  timeline.sort((a, b) => a.ts - b.ts);
  if (timeline.length > MAX_TIMELINE) timeline = timeline.slice(-MAX_TIMELINE);
  if (series.length > MAX_SERIES) {
    const step = series.length / MAX_SERIES;
    const out = [];
    for (let i = 0; i < MAX_SERIES; i++) out.push(series[Math.floor(i * step)]);
    out.push(series[series.length - 1]);
    series = out;
  }
  const ctx = new Ctx(store2);
  const summary = summarizeSession(store2, sessionId, ctx);
  const context = main ? Object.entries(main.startup).map(([key2, chars]) => ({ key: key2, label: startupLabel(key2, lang), tokens: estTokens(chars) })).sort((a, b) => b.tokens - a.tokens) : [];
  const v = { summary, tree: tree.root, timeline, context, tools: sessionTools(files), tokensSeries: series };
  if (archived) v.archived = true;
  lru.set(key, { sig, v });
  if (lru.size > 8) lru.delete(lru.keys().next().value);
  return v;
}
function sessionTools(files) {
  const m = /* @__PURE__ */ new Map();
  for (const f of files) {
    for (const b of Object.values(f.days)) {
      for (const [name, t] of Object.entries(b.tools)) {
        const r = m.get(name) ?? { calls: 0, res: 0, n: 0, max: 0, last: 0, agents: /* @__PURE__ */ new Set() };
        r.calls += t.calls;
        r.res += t.res;
        r.n += t.resN;
        r.max = Math.max(r.max, t.max);
        r.last = Math.max(r.last, t.last);
        r.agents.add(f.agentId ?? "main");
        m.set(name, r);
      }
    }
  }
  const rows = [];
  for (const [name, r] of m) {
    const t = zeroT4();
    t[0] = r.res;
    rows.push({
      key: name,
      label: name,
      tokens: toTokens(addT4(zeroT4(), t)),
      total: r.res,
      turns: 0,
      calls: r.calls,
      sessions: 1,
      lastUsed: r.last || void 0,
      extra: { resultTokens: r.res, avgResult: r.n ? Math.round(r.res / r.n) : 0, maxResult: r.max, agents: r.agents.size }
    });
  }
  return rows.sort((a, b) => b.calls - a.calls);
}
var MAX_TIMELINE, MAX_SERIES, TOOL_RESULT, DetailSink, lru, lruKey;
var init_session_detail = __esm({
  "server/session-detail.ts"() {
    "use strict";
    init_lines();
    init_tree();
    init_util();
    init_analytics();
    init_i18n();
    MAX_TIMELINE = 2e3;
    MAX_SERIES = 1500;
    TOOL_RESULT = Buffer.from('"tool_use_id"');
    DetailSink = class {
      constructor(agentId, isMain, txt) {
        this.agentId = agentId;
        this.isMain = isMain;
        this.txt = txt;
      }
      agentId;
      isMain;
      txt;
      items = [];
      series = [];
      recent = [];
      cum = 0;
      sinceTurn = 0;
      lastTs = 0;
      skipped() {
      }
      line(buf) {
        if (buf.indexOf(TOOL_RESULT) >= 0 && buf.indexOf('"type":"assistant"') < 0) return;
        const d = parseLine(buf);
        if (!d) return;
        const ts = parseTs(d.timestamp) ?? this.lastTs;
        if (ts) this.lastTs = ts;
        const side = this.isMain && d.isSidechain === true;
        if (d.type === "assistant" && d.message) {
          const msg = d.message;
          if (msg.model === "<synthetic>") return;
          const key = d.requestId || msg.id;
          if (key && msg.usage && !this.recent.includes(key)) {
            this.recent.push(key);
            if (this.recent.length > 64) this.recent.shift();
            const u = msg.usage;
            const total = (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
            this.cum += total;
            this.sinceTurn += total;
            if (this.isMain && !side) {
              this.series.push({ ts, total: this.cum, context: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0) });
            }
          }
          if (side) return;
          for (const b of Array.isArray(msg.content) ? msg.content : []) {
            if (b?.type === "tool_use") {
              const name = String(b.name ?? "");
              if (name === "Agent" || name === "Task") {
                const inp = b.input ?? {};
                this.items.push({ ts, agentId: this.agentId, kind: "spawn", label: `${toolLabel(name, inp)}${inp.description ? ": " + trimText(String(inp.description), 80) : ""}` });
              } else {
                this.items.push({ ts, agentId: this.agentId, kind: "tool", label: toolLabel(name, b.input) });
              }
            } else if (b?.type === "text" && typeof b.text === "string" && b.text.trim()) {
              this.items.push({ ts, agentId: this.agentId, kind: "text", label: trimText(b.text, 160) });
            }
          }
        } else if (d.type === "user" && d.message && !d.isMeta && !side) {
          const c = d.message.content;
          const text = typeof c === "string" ? c : Array.isArray(c) ? c.filter((x) => x?.type === "text").map((x) => x.text).join(" ") : "";
          const hasResult = Array.isArray(c) && c.some((x) => x?.type === "tool_result");
          if (text && !hasResult && !d.sourceToolUseID) {
            this.items.push({ ts, agentId: this.agentId, kind: "prompt", label: trimText(text, 160) });
          }
        } else if (d.type === "system") {
          if (d.subtype === "compact_boundary") {
            const auto = d.compactMetadata?.trigger === "auto";
            this.items.push({ ts, agentId: this.agentId, kind: "compact", label: auto ? this.txt.autoCompact : this.txt.compact, tokens: d.compactMetadata?.preTokens });
          } else if (d.subtype === "turn_duration" && !side) {
            const sec = Math.round((d.durationMs ?? 0) / 1e3);
            this.items.push({ ts, agentId: this.agentId, kind: "turn", label: this.txt.turnDone(sec), tokens: this.sinceTurn });
            this.sinceTurn = 0;
          }
        }
      }
    };
    lru = /* @__PURE__ */ new Map();
    lruKey = (id, lang) => `${id}:${lang}`;
  }
});

// shared/replay.ts
function sortReplayEvents(events) {
  return events.map((e, i) => ({ e, i })).sort((a, b) => a.e.ts - b.e.ts || KIND_ORDER[a.e.kind] - KIND_ORDER[b.e.kind] || a.i - b.i).map((x) => x.e);
}
function normalizeReplayEvents(events) {
  const sorted = sortReplayEvents(events);
  const first2 = /* @__PURE__ */ new Map();
  const last = /* @__PURE__ */ new Map();
  for (const e of sorted) {
    if (e.kind !== "tool" && e.kind !== "text" && e.kind !== "tokens") continue;
    if (!first2.has(e.agentId)) first2.set(e.agentId, e.ts);
    last.set(e.agentId, e.ts);
  }
  const spawned = /* @__PURE__ */ new Set();
  const finished = /* @__PURE__ */ new Set();
  const out = [];
  for (const e of sorted) {
    if (e.kind === "spawn") {
      if (e.agentId === "main" || spawned.has(e.agentId)) continue;
      spawned.add(e.agentId);
      out.push({ ...e, ts: Math.min(e.ts, first2.get(e.agentId) ?? e.ts) });
    } else if (e.kind === "finish") {
      if (e.agentId === "main" || finished.has(e.agentId)) continue;
      finished.add(e.agentId);
      out.push({ ...e, ts: Math.max(e.ts, last.get(e.agentId) ?? e.ts) });
    } else out.push(e);
  }
  return sortReplayEvents(out);
}
function strideKeep(items, keep) {
  if (keep >= items.length) return items;
  if (keep <= 0) return [];
  const out = [];
  const n = items.length;
  for (let i = 0; i < n; i++) if (Math.floor((i + 1) * keep / n) > Math.floor(i * keep / n)) out.push(items[i]);
  return out;
}
function mergeTokens(items, keep) {
  if (keep >= items.length) return items;
  const per = /* @__PURE__ */ new Map();
  for (const e of items) {
    const l = per.get(e.agentId);
    if (l) l.push(e);
    else per.set(e.agentId, [e]);
  }
  let g = Math.max(2, Math.ceil(items.length / Math.max(1, keep)));
  const count = (gg) => [...per.values()].reduce((a, l) => a + Math.ceil(l.length / gg), 0);
  while (count(g) > keep && g < items.length) g = Math.ceil(g * 1.25);
  const out = [];
  for (const l of per.values()) {
    for (let i = 0; i < l.length; i += g) {
      const chunk = l.slice(i, i + g);
      const t = [0, 0, 0, 0];
      let context;
      for (const c of chunk) {
        t[0] += c.t[0];
        t[1] += c.t[1];
        t[2] += c.t[2];
        t[3] += c.t[3];
        if (c.context !== void 0) context = c.context;
      }
      const lastE = chunk[chunk.length - 1];
      out.push(context === void 0 ? { kind: "tokens", ts: lastE.ts, agentId: lastE.agentId, t } : { kind: "tokens", ts: lastE.ts, agentId: lastE.agentId, t, context });
    }
  }
  return out;
}
function capReplayEvents(events, max = REPLAY_MAX_EVENTS) {
  if (events.length <= max) return { events: [...events] };
  const structural = [];
  const tool = [];
  const text = [];
  const tokens = [];
  for (const e of events) {
    if (STRUCTURAL.has(e.kind)) structural.push(e);
    else if (e.kind === "tool") tool.push(e);
    else if (e.kind === "text") text.push(e);
    else if (e.kind === "tokens") tokens.push(e);
  }
  let budget = Math.max(0, max - structural.length);
  const want = { tool: tool.length, tokens: tokens.length, text: text.length };
  const share = { tool: 0.5, tokens: 0.35, text: 0.15 };
  const alloc = { tool: 0, tokens: 0, text: 0 };
  let open = Object.keys(want).filter((k) => want[k] > 0);
  while (open.length && budget > 0) {
    const w = open.reduce((a, k) => a + share[k], 0);
    let gave = false;
    for (const k of open) {
      const part = Math.floor(budget * share[k] / w);
      if (want[k] - alloc[k] <= part) {
        budget -= want[k] - alloc[k];
        alloc[k] = want[k];
        gave = true;
      }
    }
    open = open.filter((k) => alloc[k] < want[k]);
    if (!gave) {
      const w2 = open.reduce((a, k) => a + share[k], 0);
      for (const k of open) alloc[k] += Math.floor(budget * share[k] / w2);
      break;
    }
  }
  const kept = [...structural, ...strideKeep(tool, alloc.tool), ...strideKeep(text, alloc.text), ...mergeTokens(tokens, alloc.tokens)];
  const out = sortReplayEvents(kept);
  const n = (k) => out.reduce((a, e) => a + (e.kind === k ? 1 : 0), 0);
  return { events: out, sampled: { tool: [n("tool"), tool.length], text: [n("text"), text.length], tokens: [n("tokens"), tokens.length] } };
}
var REPLAY_MAX_EVENTS, STRUCTURAL, KIND_ORDER, GAP_TAU_MS;
var init_replay = __esm({
  "shared/replay.ts"() {
    "use strict";
    REPLAY_MAX_EVENTS = 2e4;
    STRUCTURAL = /* @__PURE__ */ new Set(["spawn", "finish", "prompt", "compact", "status"]);
    KIND_ORDER = { spawn: 0, prompt: 1, tool: 2, text: 3, status: 4, tokens: 5, compact: 6, finish: 7 };
    GAP_TAU_MS = 10 * 6e4;
  }
});

// server/replay.ts
function stringAt(buf, at) {
  const end = buf.indexOf(34, at);
  return end > at ? buf.toString("latin1", at, end) : null;
}
function hourlyTokens(f, agentId) {
  const out = [];
  for (const [date, b] of Object.entries(f.days)) {
    const [y, m, d] = date.split("-").map(Number);
    for (const [h, t] of Object.entries(b.hours)) {
      const ts = Math.min(f.lastTs, Math.max(f.firstTs, new Date(y, m - 1, d, Number(h), 30).getTime()));
      out.push({ kind: "tokens", ts, agentId, t: [...t] });
    }
  }
  return out;
}
async function buildReplay(files, meta, opts) {
  const now = opts.now ?? Date.now();
  const missing = opts.isMissing ?? (() => false);
  const main = files.find((f) => f.agentId === null) ?? null;
  const subs = files.filter((f) => f.agentId !== null).sort((a, b) => a.firstTs - b.firstTs || a.path.localeCompare(b.path));
  const tree = buildTree(main, subs, now, opts.alive, true);
  const parentOf = /* @__PURE__ */ new Map();
  const walk = (n) => {
    for (const c of n.children) {
      parentOf.set(c.id, n.id);
      walk(c);
    }
  };
  walk(tree.root);
  const spawnTs = /* @__PURE__ */ new Map();
  for (const f of files) for (const [id, sp] of Object.entries(f.spawns)) spawnTs.set(id, sp.ts);
  const finished = new Map(tree.finished.map((x) => [x.s.agentId, x.s]));
  let events = [];
  const marks = [];
  const waits = [];
  const archived = files.length > 0 && files.every((f) => missing(f.path));
  const ordered = [...main ? [main] : [], ...subs];
  const sinks = new Array(ordered.length).fill(null);
  let nextFile = 0;
  const worker = async () => {
    for (let i = nextFile++; i < ordered.length; i = nextFile++) {
      const f = ordered[i];
      if (missing(f.path)) continue;
      const sink = new ReplaySink(f.agentId ?? "main", f.agentId === null, f.permissionMode);
      try {
        await readLines(f.path, 0, sink);
      } catch {
        continue;
      }
      sink.finish(opts.alive, now);
      sinks[i] = sink;
    }
  };
  await Promise.all(Array.from({ length: Math.min(READ_PARALLEL, ordered.length) }, worker));
  ordered.forEach((f, i) => {
    const id = f.agentId ?? "main";
    if (f.agentId) {
      const sp = f.meta?.toolUseId ? spawnTs.get(f.meta.toolUseId) : void 0;
      const known2 = [sp, f.firstTs].filter((x) => !!x && x > 0);
      const node = findNode(tree.root, f.agentId);
      events.push({
        kind: "spawn",
        ts: known2.length ? Math.min(...known2) : f.lastTs,
        agentId: f.agentId,
        parentId: parentOf.get(f.agentId) ?? "main",
        agentType: node?.type ?? f.meta?.agentType ?? "general-purpose",
        description: node?.description ?? f.meta?.description ?? null,
        model: f.model,
        effort: f.effort
      });
      const done = finished.get(f.agentId);
      if (done) events.push({ kind: "finish", ts: done.lastTs, agentId: f.agentId, tokens: sumT4(done.total) });
    }
    if (missing(f.path)) {
      events.push(...hourlyTokens(f, id));
      if (!f.agentId && f.firstTs) {
        marks.push({ ts: f.firstTs, status: "working", reason: { k: "working" } });
        if (!opts.alive) marks.push({ ts: f.lastTs, status: "idle", reason: { k: "sessionEnded" } });
      }
      return;
    }
    const sink = sinks[i];
    if (!sink) return;
    for (const e of sink.events) events.push(e);
    for (const m of sink.marks) marks.push(m);
    for (const w of sink.waits) waits.push(w);
  });
  events = normalizeReplayEvents(events);
  const busy = events.filter((e) => (e.kind === "tool" || e.kind === "tokens" || e.kind === "text") && e.agentId !== "main").map((e) => e.ts);
  const busyIn = (a, b) => {
    let lo = 0, hi = busy.length;
    while (lo < hi) {
      const m = lo + hi >> 1;
      if (busy[m] < a) lo = m + 1;
      else hi = m;
    }
    return lo < busy.length && busy[lo] <= b;
  };
  for (const w of waits) {
    if (w.heuristic && busyIn(w.from, w.to)) continue;
    marks.push({ ts: w.from, status: "waiting", reason: w.reason });
    if (w.to < now || !opts.alive) marks.push({ ts: w.to, status: "working", reason: { k: "working" } });
  }
  const startedAt = Math.min(...files.map((f) => f.firstTs || Infinity), events.length ? events[0].ts : Infinity);
  const lastTs = Math.max(0, ...files.map((f) => f.lastTs), events.length ? events[events.length - 1].ts : 0);
  const endedAt = opts.alive ? Math.max(lastTs, now) : lastTs;
  if (!opts.alive && marks.length) marks.push({ ts: lastTs, status: "idle", reason: { k: "sessionEnded" } });
  marks.sort((a, b) => a.ts - b.ts);
  let cur = null;
  for (const m of marks) {
    const key = `${m.status}|${m.reason?.k ?? ""}|${m.reason && "a" in m.reason ? m.reason.a : ""}`;
    if (key === cur || m.status === (cur?.split("|")[0] ?? "") && m.status !== "waiting") continue;
    cur = key;
    const r = m.reason;
    events.push({ kind: "status", ts: m.ts, status: m.status, reason: reasonText(r, opts.lang), code: r?.k ?? null, arg: r && "a" in r ? String(r.a) : null });
  }
  events = normalizeReplayEvents(events);
  const capped = capReplayEvents(events, opts.max ?? REPLAY_MAX_EVENTS);
  const out = {
    ...meta,
    contextLimit: main ? contextLimitFor(main.model, main.requestedModel, main.carry.maxCtx) : null,
    startedAt: Number.isFinite(startedAt) ? startedAt : now,
    endedAt: Number.isFinite(startedAt) ? endedAt : now,
    live: opts.alive,
    generatedAt: now,
    events: capped.events
  };
  if (archived) out.archived = true;
  if (capped.sampled) out.sampled = capped.sampled;
  return out;
}
function findNode(n, id) {
  if (n.id === id) return n;
  for (const c of n.children) {
    const r = findNode(c, id);
    if (r) return r;
  }
  return null;
}
async function sessionReplay(store2, sessionId, alive, lang = "en", now = Date.now()) {
  const files = store2.sessionFiles(sessionId);
  if (!files.length) return null;
  const sig = files.map((f) => `${f.path}:${f.size}:${store2.isMissing(f.path) ? "gone" : ""}`).sort().join("|") + `:${alive}:${lang}:${alive ? Math.floor(now / 1e4) : ""}`;
  const key = `${sessionId}:${lang}`;
  const hit = lru2.get(key);
  if (hit && hit.sig === sig) {
    lru2.delete(key);
    lru2.set(key, hit);
    return hit.v;
  }
  const main = files.find((f) => f.agentId === null) ?? null;
  const any = main ?? files[0];
  const v = await buildReplay(files, {
    sessionId,
    project: projectOf(any.cwd, any.projectDir),
    cwd: main?.cwd ?? any.cwd ?? "",
    title: sessionTitle(main),
    model: main?.model ?? null,
    effort: main?.effort ?? null
  }, { alive, lang, now, isMissing: (p) => store2.isMissing(p) });
  lru2.set(key, { sig, v });
  if (lru2.size > 6) lru2.delete(lru2.keys().next().value);
  return v;
}
var TOOL_USE_ID, READ_PARALLEL, HEAD2, TIMESTAMP, PERMISSION, SIDECHAIN, ASKS_USER, ReplaySink, lru2;
var init_replay2 = __esm({
  "server/replay.ts"() {
    "use strict";
    init_replay();
    init_lines();
    init_tree();
    init_util();
    init_i18n();
    init_titles();
    TOOL_USE_ID = Buffer.from('"tool_use_id":"');
    READ_PARALLEL = 4;
    HEAD2 = 640;
    TIMESTAMP = Buffer.from('"timestamp":"');
    PERMISSION = Buffer.from('"permissionDecision":');
    SIDECHAIN = Buffer.from('"isSidechain":true');
    ASKS_USER = /* @__PURE__ */ new Set(["AskUserQuestion", "ExitPlanMode"]);
    ReplaySink = class {
      constructor(agentId, isMain, permissionMode) {
        this.agentId = agentId;
        this.isMain = isMain;
        this.mode = permissionMode;
      }
      agentId;
      isMain;
      events = [];
      marks = [];
      waits = [];
      recent = [];
      calls = /* @__PURE__ */ new Map();
      lastTs = 0;
      mode;
      skipped() {
      }
      /** The first record written after a tool call (strictly later): when the session moved on. */
      touch(ts) {
        for (const c of this.calls.values()) if (c.nextTs === null && ts > c.ts) c.nextTs = ts;
      }
      /**
       * A tool result. Its bytes are scanned as little as possible (results are most of a transcript): the id from
       * the head of the line, the timestamp (one scan up to it), the permission decision from the tail.
       * `ids`/`parsedTs` when the line was parsed anyway.
       */
      result(buf, parsedIds, parsedTs) {
        if (this.isMain && buf.subarray(0, HEAD2).indexOf(SIDECHAIN) >= 0) return;
        let ts = parsedTs ?? null;
        if (ts == null) {
          const at = buf.indexOf(TIMESTAMP);
          ts = at >= 0 ? parseTs(stringAt(buf, at + TIMESTAMP.length)) : null;
        }
        ts ??= this.lastTs;
        const tailFrom = Math.max(0, buf.length - 4096);
        const p = buf.subarray(tailFrom).lastIndexOf(PERMISSION);
        let src = null;
        if (p >= 0) {
          const m = /"source":"([^"]+)"/.exec(buf.toString("latin1", tailFrom + p, Math.min(buf.length, tailFrom + p + 400)));
          src = m ? m[1] : "config";
        }
        let ids = parsedIds;
        if (!ids) {
          const h = buf.subarray(0, HEAD2 * 2);
          const i = h.indexOf(TOOL_USE_ID);
          const id = i >= 0 ? stringAt(buf, i + TOOL_USE_ID.length) : null;
          ids = id ? [id] : [];
        }
        for (const id of ids) {
          const c = this.calls.get(id);
          if (!c) continue;
          this.calls.delete(id);
          this.settle(c, ts, src);
        }
        if (ts) {
          this.touch(ts);
          this.lastTs = Math.max(this.lastTs, ts);
        }
      }
      /** A finished call: did the session wait for the user meanwhile? */
      settle(c, end, src) {
        if (end <= c.ts) return;
        if (ASKS_USER.has(c.name)) {
          this.waits.push({ from: c.ts, to: end, reason: { k: "waitingInput" }, heuristic: false });
          return;
        }
        if (src !== null) {
          if (/^user/.test(src)) this.waits.push({ from: c.ts, to: end, reason: { k: "waitingPermission", a: c.name }, heuristic: false });
          return;
        }
        if (!this.isMain || this.mode === "bypassPermissions") return;
        const next = c.nextTs ?? end;
        if (next - c.ts > WAIT_MS) this.waits.push({ from: c.ts + WAIT_MS, to: next, reason: { k: "probablyPermission", a: c.name }, heuristic: true });
      }
      /** Calls still open at the end of a live session's transcript. */
      finish(alive, now) {
        if (!alive) {
          this.calls.clear();
          return;
        }
        for (const c of this.calls.values()) {
          if (ASKS_USER.has(c.name)) this.waits.push({ from: c.ts, to: now, reason: { k: "waitingInput" }, heuristic: false });
          else if (this.isMain && this.mode !== "bypassPermissions" && c.nextTs === null && now - c.ts > WAIT_MS) {
            this.waits.push({ from: c.ts + WAIT_MS, to: now, reason: { k: "probablyPermission", a: c.name }, heuristic: true });
          }
        }
        this.calls.clear();
      }
      line(buf) {
        const head = buf.toString("latin1", 0, Math.min(buf.length, HEAD2));
        const lead = /^\{"type":"([\w-]+)"/.exec(head)?.[1];
        if (lead && lead !== "permission-mode" && lead !== "user" && lead !== "assistant" && lead !== "system") return;
        if (head.includes('"attachment":{')) return;
        else if (head.includes('"type":"user"') && head.includes('"tool_use_id"')) return this.result(buf);
        else if (head.includes('"type":"system"') && !head.includes('"compact_boundary"')) return;
        else if (!this.isMain && head.includes('"type":"user"')) return;
        const d = parseLine(buf);
        if (!d) return;
        if (d.type === "user" && Array.isArray(d.message?.content) && d.message.content.some((x) => x?.type === "tool_result")) {
          const ids = d.message.content.filter((x) => x?.type === "tool_result" && x.tool_use_id).map((x) => String(x.tool_use_id));
          if (this.isMain && d.isSidechain === true) return;
          return this.result(buf, ids, parseTs(d.timestamp));
        }
        if (d.type === "permission-mode" && d.permissionMode) {
          this.mode = String(d.permissionMode);
          return;
        }
        if (typeof d.permissionMode === "string") this.mode = d.permissionMode;
        const ts = parseTs(d.timestamp) ?? this.lastTs;
        if (!ts) return;
        this.lastTs = Math.max(this.lastTs, ts);
        const side = this.isMain && d.isSidechain === true;
        if (side) return;
        this.touch(ts);
        const me = this.agentId;
        if (d.type === "assistant" && d.message) {
          const msg = d.message;
          if (msg.model === "<synthetic>") return;
          const key = d.requestId || msg.id;
          if (key && msg.usage && !this.recent.includes(key)) {
            this.recent.push(key);
            if (this.recent.length > 64) this.recent.shift();
            const u = msg.usage;
            const t = [u.input_tokens || 0, u.output_tokens || 0, u.cache_read_input_tokens || 0, u.cache_creation_input_tokens || 0];
            this.events.push(this.isMain ? { kind: "tokens", ts, agentId: me, t, context: t[0] + t[2] + t[3] } : { kind: "tokens", ts, agentId: me, t });
          }
          for (const b of Array.isArray(msg.content) ? msg.content : []) {
            if (b?.type === "tool_use") {
              const name = String(b.name ?? "");
              if (b.id) this.calls.set(String(b.id), { ts, name, label: toolLabel(name, b.input), nextTs: null });
              if (name !== "Agent" && name !== "Task") this.events.push({ kind: "tool", ts, agentId: me, label: toolLabel(name, b.input) });
            } else if (b?.type === "text" && typeof b.text === "string" && b.text.trim()) {
              this.events.push({ kind: "text", ts, agentId: me, text: trimText(b.text, 160) });
            }
          }
          if (this.isMain) {
            if (msg.stop_reason === "end_turn") this.marks.push({ ts, status: "idle", reason: { k: "answerReady" } });
            else this.marks.push({ ts, status: "working", reason: { k: "working" } });
          }
        } else if (d.type === "user" && d.message && !d.isMeta && this.isMain) {
          const c = d.message.content;
          const text = typeof c === "string" ? c : Array.isArray(c) ? c.filter((x) => x?.type === "text").map((x) => x.text).join(" ") : "";
          if (text && !d.sourceToolUseID) {
            this.events.push({ kind: "prompt", ts, text: trimText(text, 160) });
            this.marks.push({ ts, status: "working", reason: { k: "gotPrompt" } });
          }
        } else if (d.type === "system" && d.subtype === "compact_boundary") {
          const pre = d.compactMetadata?.preTokens;
          this.events.push({ kind: "compact", ts, auto: d.compactMetadata?.trigger === "auto", preTokens: typeof pre === "number" ? pre : null });
        }
      }
    };
    lru2 = /* @__PURE__ */ new Map();
  }
});

// server/changes.ts
import fs12 from "node:fs/promises";
import os5 from "node:os";
import path13 from "node:path";
function stringAt2(buf, at) {
  const end = buf.indexOf(34, at);
  return end > at ? buf.toString("latin1", at, end) : null;
}
function splitLines(s) {
  if (typeof s !== "string" || s === "") return [];
  const out = s.split("\n");
  if (out[out.length - 1] === "") out.pop();
  return out;
}
function diffOps(a, b) {
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  const am = a.slice(p, a.length - s);
  const bm = b.slice(p, b.length - s);
  const mid = [];
  if (am.length && bm.length && am.length * bm.length <= CHANGE_LIMITS.lcsCells) {
    const n = am.length, m = bm.length;
    const w = m + 1;
    const L = new Uint32Array((n + 1) * w);
    for (let i2 = n - 1; i2 >= 0; i2--) {
      for (let j2 = m - 1; j2 >= 0; j2--) {
        L[i2 * w + j2] = am[i2] === bm[j2] ? L[(i2 + 1) * w + j2 + 1] + 1 : Math.max(L[(i2 + 1) * w + j2], L[i2 * w + j2 + 1]);
      }
    }
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (am[i] === bm[j]) {
        mid.push(" " + am[i]);
        i++;
        j++;
      } else if (L[(i + 1) * w + j] >= L[i * w + j + 1]) mid.push("-" + am[i++]);
      else mid.push("+" + bm[j++]);
    }
    while (i < n) mid.push("-" + am[i++]);
    while (j < m) mid.push("+" + bm[j++]);
  } else {
    for (const x of am) mid.push("-" + x);
    for (const x of bm) mid.push("+" + x);
  }
  return [...a.slice(0, p).map((x) => " " + x), ...mid, ...a.slice(a.length - s).map((x) => " " + x)];
}
function lineDiff(oldText, newText) {
  const ops = diffOps(splitLines(oldText), splitLines(newText));
  let added = 0, removed = 0, first2 = -1, last = -1;
  ops.forEach((o, i) => {
    if (o[0] === " ") return;
    if (o[0] === "+") added++;
    else removed++;
    if (first2 < 0) first2 = i;
    last = i;
  });
  const view = first2 < 0 ? [] : ops.slice(Math.max(0, first2 - 2), last + 3);
  const max = CHANGE_LIMITS.linesPerHunk;
  return { added, removed, lines: view.slice(0, max).map(clip), more: Math.max(0, view.length - max) };
}
function changeOf(name, input, ts) {
  if (!CHANGE_TOOLS.has(name) || !input || typeof input !== "object") return null;
  const p = name === "NotebookEdit" ? input.notebook_path : input.file_path;
  if (typeof p !== "string" || !p) return null;
  const max = CHANGE_LIMITS.linesPerHunk;
  if (name === "Write") {
    const lines = splitLines(input.content);
    return { path: p, added: lines.length, removed: 0, write: true, hunks: [{ ts, tool: "Write", lines: lines.slice(0, max).map((x) => clip("+" + x)), more: Math.max(0, lines.length - max) }] };
  }
  if (name === "NotebookEdit") {
    const mode = typeof input.edit_mode === "string" ? input.edit_mode : "replace";
    const lines = mode === "delete" ? [] : splitLines(input.new_source);
    return { path: p, added: lines.length, removed: 0, write: false, hunks: [{ ts, tool: "NotebookEdit", mode, lines: lines.slice(0, max).map((x) => clip("+" + x)), more: Math.max(0, lines.length - max) }] };
  }
  const edits = name === "MultiEdit" ? Array.isArray(input.edits) ? input.edits : [] : [input];
  let added = 0, removed = 0;
  const hunks = [];
  for (const e of edits) {
    if (!e || typeof e !== "object") continue;
    const d = lineDiff(e.old_string, e.new_string);
    added += d.added;
    removed += d.removed;
    const h = { ts, tool: name, lines: d.lines, more: d.more };
    if (e.replace_all === true) h.replaceAll = true;
    hunks.push(h);
  }
  return { path: p, added, removed, hunks, write: false };
}
function relPath(abs, cwd, home = os5.homedir()) {
  if (!path13.isAbsolute(abs)) return abs;
  const norm = path13.normalize(abs);
  if (cwd) {
    const c = path13.normalize(cwd).replace(/\/+$/, "");
    if (norm === c) return path13.basename(norm);
    if (norm.startsWith(c + "/")) return norm.slice(c.length + 1);
  }
  if (home && norm.startsWith(home.replace(/\/+$/, "") + "/")) {
    const rest = norm.slice(home.replace(/\/+$/, "").length + 1);
    const parts2 = rest.split("/");
    return parts2.length > 4 ? `~/\u2026/${parts2.slice(-3).join("/")}` : `~/${rest}`;
  }
  const parts = norm.split("/").filter(Boolean);
  return parts.length > 3 ? `\u2026/${parts.slice(-3).join("/")}` : norm;
}
function mergeAccs(list) {
  const out = /* @__PURE__ */ new Map();
  for (const { agentId, files } of list) {
    for (const f of files.values()) {
      const m = out.get(f.abs);
      if (!m) {
        out.set(f.abs, { ...f, hunks: [...f.hunks], agents: f.edits || f.failed ? [agentId] : [] });
        continue;
      }
      m.added += f.added;
      m.removed += f.removed;
      m.edits += f.edits;
      m.failed += f.failed;
      m.reads += f.reads;
      m.lastTs = Math.max(m.lastTs, f.lastTs);
      m.write = m.write === "created" || f.write === "created" ? "created" : m.write ?? f.write;
      m.hunks.push(...f.hunks);
      m.hunksDropped += f.hunksDropped;
      if (f.edits || f.failed) m.agents.push(agentId);
    }
  }
  for (const m of out.values()) {
    m.hunks.sort((a, b) => a.ts - b.ts);
    if (m.hunks.length > CHANGE_LIMITS.hunksPerFile) {
      const drop = m.hunks.length - CHANGE_LIMITS.hunksPerFile;
      m.hunks.splice(0, drop);
      m.hunksDropped += drop;
    }
  }
  return out;
}
function buildChanges(files, steps, stepsTotal, meta) {
  const changed = [];
  const reads = [];
  let readsTotal = 0;
  const totals = { files: 0, added: 0, removed: 0, edits: 0, failed: 0 };
  for (const f of files) {
    const rel = relPath(f.abs, meta.cwd, meta.home);
    if (f.edits || f.failed) {
      const c = {
        path: rel,
        name: path13.basename(f.abs),
        added: f.added,
        removed: f.removed,
        edits: f.edits,
        failed: f.failed,
        reads: f.reads,
        lastTs: f.lastTs,
        write: f.write,
        hunks: f.hunks.map((h) => ({ ...h, lines: [...h.lines] }))
      };
      if (f.hunksDropped) c.hunksDropped = f.hunksDropped;
      if (f.agents?.length) c.agents = [...f.agents];
      changed.push(c);
      totals.failed += f.failed;
      if (f.edits) {
        totals.files++;
        totals.added += f.added;
        totals.removed += f.removed;
        totals.edits += f.edits;
      }
    } else if (f.reads) {
      readsTotal++;
      reads.push({ path: rel, name: path13.basename(f.abs), count: f.reads, lastTs: f.lastTs });
    }
  }
  changed.sort((a, b) => Number(b.edits > 0) - Number(a.edits > 0) || b.lastTs - a.lastTs || a.path.localeCompare(b.path));
  reads.sort((a, b) => b.lastTs - a.lastTs || a.path.localeCompare(b.path));
  return {
    sessionId: meta.sessionId,
    agentId: meta.agentId,
    cwd: meta.cwd,
    files: changed.slice(0, CHANGE_LIMITS.files),
    filesTotal: changed.length,
    reads: reads.slice(0, CHANGE_LIMITS.reads),
    readsTotal,
    totals,
    steps: steps.slice(-CHANGE_LIMITS.steps).map((s) => ({ ...s })),
    stepsTotal,
    generatedAt: meta.now ?? Date.now()
  };
}
async function sinkFor(f) {
  let st;
  try {
    st = await fs12.stat(f.path);
  } catch {
    return null;
  }
  let hit = cache4.get(f.path);
  if (hit && st.size < hit.size) hit = void 0;
  if (!hit) hit = { offset: 0, mtimeMs: 0, size: 0, sink: new ChangesSink(f.agentId === null) };
  if (st.size !== hit.offset) {
    try {
      hit.offset = await readLines(f.path, hit.offset, hit.sink);
    } catch {
      return null;
    }
  }
  hit.size = st.size;
  hit.mtimeMs = st.mtimeMs;
  cache4.delete(f.path);
  cache4.set(f.path, hit);
  if (cache4.size > CACHE_MAX) cache4.delete(cache4.keys().next().value);
  return hit.sink;
}
async function agentChanges(files, sessionId, agentId, opts = {}) {
  if (!files.length) return null;
  const missing = opts.isMissing ?? (() => false);
  const main = files.find((f2) => f2.agentId === null) ?? null;
  const baseCwd = main?.cwd ?? files[0].cwd ?? null;
  const meta = { sessionId, agentId, now: opts.now, home: opts.home };
  if (agentId === "all") {
    const list = [];
    let any = false;
    for (const f2 of files) {
      if (missing(f2.path)) continue;
      const sink2 = await sinkFor(f2);
      if (!sink2) continue;
      any = true;
      list.push({ agentId: f2.agentId ?? "main", files: sink2.files });
    }
    const out = buildChanges(mergeAccs(list).values(), [], 0, { ...meta, cwd: baseCwd });
    if (!any) out.archived = true;
    return out;
  }
  const f = files.find((x) => agentId === "main" ? x.agentId === null : x.agentId === agentId);
  if (!f) return null;
  const cwd = f.cwd ?? baseCwd;
  const sink = missing(f.path) ? null : await sinkFor(f);
  if (!sink) {
    const out = buildChanges([], [], 0, { ...meta, cwd });
    out.archived = true;
    return out;
  }
  return buildChanges(sink.files.values(), sink.steps, sink.stepsTotal, { ...meta, cwd });
}
async function sessionAgentChanges(store2, sessionId, agentId) {
  return agentChanges(store2.sessionFiles(sessionId), sessionId, agentId, { isMissing: (p) => store2.isMissing(p) });
}
var CHANGE_LIMITS, CHANGE_TOOLS, TOOL_USE_ID2, IS_ERROR, TIMESTAMP2, TUR2, ASSISTANT, SIDECHAIN2, clip, ChangesSink, cache4, CACHE_MAX;
var init_changes = __esm({
  "server/changes.ts"() {
    "use strict";
    init_lines();
    init_util();
    CHANGE_LIMITS = {
      /** Steps kept per transcript (newest). */
      steps: 200,
      /** Diff previews kept per file (newest). */
      hunksPerFile: 8,
      /** Lines per diff preview. */
      linesPerHunk: 40,
      /** Characters per previewed line. */
      lineChars: 200,
      /** Files returned (newest first). */
      files: 300,
      /** Read-only files returned. */
      reads: 30,
      /** Calls waiting for their result (a transcript cut short never resolves some). */
      pending: 2e3,
      /** Largest old × new middle (in lines) that gets an exact LCS; bigger edits count every line. */
      lcsCells: 25e4,
      /** A result line shorter than this is JSON-parsed; longer ones are byte-scanned. */
      parseResultBelow: 64 * 1024
    };
    CHANGE_TOOLS = /* @__PURE__ */ new Set(["Edit", "MultiEdit", "Write", "NotebookEdit"]);
    TOOL_USE_ID2 = Buffer.from('"tool_use_id":"');
    IS_ERROR = Buffer.from('"is_error":true');
    TIMESTAMP2 = Buffer.from('"timestamp":"');
    TUR2 = Buffer.from(',"toolUseResult":');
    ASSISTANT = Buffer.from('"type":"assistant"');
    SIDECHAIN2 = Buffer.from('"isSidechain":true');
    clip = (s) => s.length > CHANGE_LIMITS.lineChars ? s.slice(0, CHANGE_LIMITS.lineChars - 1) + "\u2026" : s;
    ChangesSink = class {
      constructor(isMain) {
        this.isMain = isMain;
      }
      isMain;
      files = /* @__PURE__ */ new Map();
      steps = [];
      stepsTotal = 0;
      lastTs = 0;
      pend = /* @__PURE__ */ new Map();
      skipped() {
      }
      file(abs) {
        let f = this.files.get(abs);
        if (!f) this.files.set(abs, f = { abs, added: 0, removed: 0, edits: 0, failed: 0, reads: 0, lastTs: 0, write: null, hunks: [], hunksDropped: 0 });
        return f;
      }
      step(s) {
        this.stepsTotal++;
        this.steps.push(s);
        if (this.steps.length > CHANGE_LIMITS.steps * 2) this.steps = this.steps.slice(-CHANGE_LIMITS.steps);
      }
      line(buf) {
        const head = buf.toString("latin1", 0, Math.min(buf.length, 120));
        const lead = /^\{"type":"([\w-]+)"/.exec(head)?.[1];
        if (lead && lead !== "user" && lead !== "assistant") return;
        if (this.isMain && buf.subarray(0, 1024).indexOf(SIDECHAIN2) >= 0) return;
        const cut = buf.indexOf(TUR2);
        const isAssistant = (cut >= 0 ? buf.subarray(0, cut) : buf).indexOf(ASSISTANT) >= 0;
        if (!isAssistant) {
          if (buf.indexOf(TOOL_USE_ID2) >= 0) this.results(buf);
          return;
        }
        const d = parseLine(buf);
        if (!d || d.type !== "assistant" || !d.message) return;
        if (this.isMain && d.isSidechain === true) return;
        const msg = d.message;
        if (msg.model === "<synthetic>") return;
        const ts = parseTs(d.timestamp) ?? this.lastTs;
        if (ts) this.lastTs = Math.max(this.lastTs, ts);
        for (const b of Array.isArray(msg.content) ? msg.content : []) {
          if (b?.type === "tool_use") {
            const id = b.id ? String(b.id) : "";
            if (id && this.pend.has(id)) continue;
            const name = String(b.name ?? "");
            const inp = b.input && typeof b.input === "object" ? b.input : {};
            const spawn = name === "Agent" || name === "Task";
            const label = spawn && inp.description ? `${toolLabel(name, inp)}: ${trimText(String(inp.description), 60)}` : toolLabel(name, inp);
            const step = { ts, kind: spawn ? "spawn" : "tool", tool: name, label, status: "pending" };
            this.step(step);
            if (!id) continue;
            const read = name === "Read" && typeof inp.file_path === "string" ? inp.file_path : null;
            this.pend.set(id, { ts, name, step, change: changeOf(name, inp, ts), read });
            if (this.pend.size > CHANGE_LIMITS.pending) this.pend.delete(this.pend.keys().next().value);
          } else if (b?.type === "text" && typeof b.text === "string" && b.text.trim()) {
            this.step({ ts, kind: "text", label: trimText(b.text, 160) });
          }
        }
      }
      /** A user record with tool results: which calls finished, and whether they failed. */
      results(buf) {
        const turAt = buf.indexOf(TUR2);
        const end = turAt >= 0 ? turAt : buf.length;
        let found = [];
        let ts = null;
        if (buf.length < CHANGE_LIMITS.parseResultBelow) {
          const d = parseLine(buf);
          if (!d || d.type !== "user" || !Array.isArray(d.message?.content)) return;
          if (this.isMain && d.isSidechain === true) return;
          ts = parseTs(d.timestamp);
          found = d.message.content.filter((x) => x?.type === "tool_result" && x.tool_use_id).map((x) => ({ id: String(x.tool_use_id), error: x.is_error === true }));
        } else {
          const at = buf.indexOf(TIMESTAMP2);
          ts = at >= 0 ? parseTs(stringAt2(buf, at + TIMESTAMP2.length)) : null;
          const ids = [];
          for (let i = buf.indexOf(TOOL_USE_ID2); i >= 0 && i < end; i = buf.indexOf(TOOL_USE_ID2, i + 1)) {
            const id = stringAt2(buf, i + TOOL_USE_ID2.length);
            if (id) ids.push({ id, at: i });
          }
          const errs = [];
          for (let i = buf.indexOf(IS_ERROR); i >= 0 && i < end; i = buf.indexOf(IS_ERROR, i + 1)) errs.push(i);
          found = ids.map((x, k) => ({
            id: x.id,
            error: ids.length === 1 ? errs.length > 0 : errs.some((e) => e > x.at && e < (ids[k + 1]?.at ?? end))
          }));
        }
        if (!found.length) return;
        ts ??= this.lastTs;
        if (ts) this.lastTs = Math.max(this.lastTs, ts);
        let kind = null;
        if (turAt >= 0) {
          const tail = buf.toString("latin1", turAt + TUR2.length, Math.min(buf.length, turAt + TUR2.length + 40));
          kind = tail.startsWith('{"type":"create"') ? "created" : tail.startsWith('{"type":"update"') ? "overwritten" : null;
        }
        for (const r of found) {
          const p = this.pend.get(r.id);
          if (!p) continue;
          this.pend.delete(r.id);
          p.step.status = r.error ? "error" : "ok";
          if (ts) p.step.endTs = ts;
          if (p.change) {
            const f = this.file(p.change.path);
            if (r.error) {
              f.failed++;
              if (!f.edits) f.lastTs = Math.max(f.lastTs, ts || p.ts);
              continue;
            }
            f.added += p.change.added;
            f.removed += p.change.removed;
            f.edits++;
            f.lastTs = Math.max(f.lastTs, ts || p.ts);
            if (p.change.write) f.write = found.length === 1 && kind ? kind : f.write ?? "written";
            for (const h of p.change.hunks) f.hunks.push(h);
            if (f.hunks.length > CHANGE_LIMITS.hunksPerFile) {
              const drop = f.hunks.length - CHANGE_LIMITS.hunksPerFile;
              f.hunks.splice(0, drop);
              f.hunksDropped += drop;
            }
          } else if (p.read && !r.error) {
            const f = this.file(p.read);
            f.reads++;
            f.lastTs = Math.max(f.lastTs, ts || p.ts);
          }
        }
      }
    };
    cache4 = /* @__PURE__ */ new Map();
    CACHE_MAX = 32;
  }
});

// server/terminal.ts
import { execFile as execFile2, execFileSync } from "node:child_process";
import fs13 from "node:fs";
import path14 from "node:path";
function parsePsEnv(out) {
  const env2 = {};
  for (const tok of out.split(/\s+/)) {
    const eq = tok.indexOf("=");
    if (eq <= 0) continue;
    const k = tok.slice(0, eq);
    if (ENV_KEYS.includes(k)) env2[k] = tok.slice(eq + 1);
  }
  return env2;
}
function parseProcEnviron(buf) {
  const env2 = {};
  for (const kv of buf.split("\0")) {
    const eq = kv.indexOf("=");
    if (eq <= 0) continue;
    const k = kv.slice(0, eq);
    if (ENV_KEYS.includes(k)) env2[k] = kv.slice(eq + 1);
  }
  return env2;
}
function appBundlePath(command) {
  const i = command.indexOf(".app/");
  if (i < 0) return command.endsWith(".app") && RE.path.test(command) ? command : null;
  const p = command.slice(0, i + 4);
  return RE.path.test(p) ? p : null;
}
function known(id, bundle, appPath) {
  const def = APPS[id];
  return { app: id, name: def.name, bundle: bundle && def.bundles.test(bundle) ? bundle : def.bundle, appPath };
}
function detectApp(env2, appPath = null) {
  const tp = env2.TERM_PROGRAM ?? "";
  const bundle = env2.__CFBundleIdentifier && RE.bundle.test(env2.__CFBundleIdentifier) ? env2.__CFBundleIdentifier : null;
  if (tp === "vscode") {
    const fork = VSCODE_FAMILY.find((id) => bundle && APPS[id].bundles.test(bundle));
    return known(fork ?? "vscode", bundle, appPath);
  }
  for (const id of TERMINAL_APPS) if (APPS[id].term?.includes(tp)) return known(id, bundle, appPath);
  if (env2.KITTY_WINDOW_ID) return known("kitty", bundle, appPath);
  if (env2.ALACRITTY_WINDOW_ID || env2.ALACRITTY_SOCKET) return known("alacritty", bundle, appPath);
  if (env2.GHOSTTY_RESOURCES_DIR) return known("ghostty", bundle, appPath);
  if (bundle) {
    for (const id of TERMINAL_APPS) if (APPS[id].bundles.test(bundle)) return known(id, bundle, appPath);
    return { app: "other", name: appName(appPath) ?? bundle.split(".").pop() ?? bundle, bundle, appPath };
  }
  if (appPath) return { app: "other", name: appName(appPath), bundle: null, appPath };
  return { app: null, name: null, bundle: null, appPath: null };
}
function tabScript(app, dev) {
  if (app === "iterm") {
    return [
      `tell application id "${APPS.iterm.bundle}"`,
      "  repeat with w in windows",
      "    repeat with t in tabs of w",
      "      repeat with s in sessions of t",
      `        if tty of s is "${q(dev)}" then`,
      "          select w",
      "          select t",
      "          select s",
      "          activate",
      '          return "ok"',
      "        end if",
      "      end repeat",
      "    end repeat",
      "  end repeat",
      "end tell",
      'return "missing"'
    ].join("\n");
  }
  return [
    `tell application id "${APPS.terminal.bundle}"`,
    "  repeat with w in windows",
    "    repeat with t in tabs of w",
    `      if tty of t is "${q(dev)}" then`,
    "        set selected of t to true",
    "        set index of w to 1",
    "        activate",
    '        return "ok"',
    "      end if",
    "    end repeat",
    "  end repeat",
    "end tell",
    'return "missing"'
  ].join("\n");
}
function planFor(d, choice, tools, platform) {
  const app = choice === "auto" || choice === "off" ? d.app : choice;
  const def = app && app !== "other" ? APPS[app] : null;
  const mac = platform === "darwin";
  const bundle = def ? d.bundle && def.bundles.test(d.bundle) ? d.bundle : def.bundle : d.bundle;
  const activate = !mac || !tools.open ? null : bundle ? { file: "open", args: ["-b", bundle] } : d.appPath && RE.path.test(d.appPath) ? { file: "open", args: ["-a", d.appPath] } : null;
  const steps = [];
  let activateAfter = true;
  const env2 = d.env;
  if (app === "warp" && mac && tools.open && env2.WARP_FOCUS_URL && RE.warpUrl.test(env2.WARP_FOCUS_URL)) {
    steps.push({ file: "open", args: [env2.WARP_FOCUS_URL] });
    activateAfter = false;
  } else if ((app === "iterm" || app === "terminal") && mac && tools.osascript && d.tty && RE.tty.test(d.tty)) {
    steps.push({ file: "osascript", args: ["-e", tabScript(app, `/dev/${d.tty}`)], expect: "ok" });
    activateAfter = false;
  } else if (app === "wezterm" && tools.wezterm && env2.WEZTERM_PANE && RE.num.test(env2.WEZTERM_PANE)) {
    const sock = env2.WEZTERM_UNIX_SOCKET && RE.path.test(env2.WEZTERM_UNIX_SOCKET) ? { WEZTERM_UNIX_SOCKET: env2.WEZTERM_UNIX_SOCKET } : void 0;
    steps.push({ file: tools.wezterm, args: ["cli", "activate-pane", "--pane-id", env2.WEZTERM_PANE], env: sock });
  } else if (app === "kitty" && tools.kitten && env2.KITTY_WINDOW_ID && RE.num.test(env2.KITTY_WINDOW_ID) && env2.KITTY_LISTEN_ON && RE.kittyTo.test(env2.KITTY_LISTEN_ON)) {
    steps.push({ file: tools.kitten, args: ["@", "--to", env2.KITTY_LISTEN_ON, "focus-window", "--match", `id:${env2.KITTY_WINDOW_ID}`] });
  }
  return {
    name: def?.name ?? d.name,
    precision: steps.length ? "tab" : activate ? "app" : "none",
    steps,
    activate,
    activateAfter
  };
}
function tmuxSocket(env2) {
  const s = env2.TMUX?.split(",")[0] ?? "";
  return RE.tmuxSocket.test(s) ? s : null;
}
function planTmux(inner, outer, choice, tools, platform) {
  const socket = tmuxSocket(inner.env);
  const pane = inner.env.TMUX_PANE && RE.tmuxPane.test(inner.env.TMUX_PANE) ? inner.env.TMUX_PANE : null;
  const none2 = { app: null, name: null, bundle: null, appPath: null, env: {}, tty: null };
  const o = planFor(outer ?? none2, choice, tools, platform);
  const steps = [];
  if (tools.tmux && socket && pane) {
    steps.push({ file: tools.tmux, args: ["-S", socket, "switch-client", "-t", pane], optional: true });
    steps.push({ file: tools.tmux, args: ["-S", socket, "select-window", "-t", pane] });
    steps.push({ file: tools.tmux, args: ["-S", socket, "select-pane", "-t", pane] });
  }
  return {
    name: o.name ? `${o.name} \xB7 tmux` : "tmux",
    precision: steps.length ? o.precision === "none" ? "app" : "tab" : o.precision,
    steps: [...steps, ...o.steps],
    activate: o.activate,
    activateAfter: o.activateAfter,
    tmux: true
  };
}
async function runPlan(p, run = defaultRunner2) {
  if (p.precision === "none") return { ok: false, name: p.name, precision: "none", error: "unsupported" };
  let warning;
  for (const c of p.steps) {
    const r = await run(c);
    const ok = r.ok && (!c.expect || r.stdout.trim() === c.expect);
    if (ok || c.optional) continue;
    warning = /-1743|not authori[sz]ed/i.test(r.stderr) ? "permission" : "tab-not-found";
    break;
  }
  if (!warning) {
    if (p.activateAfter && p.activate) await run(p.activate);
    return { ok: true, name: p.name, precision: p.precision };
  }
  if (p.activate && (await run(p.activate)).ok) return { ok: true, name: p.name, precision: "app", warning };
  return { ok: false, name: p.name, precision: "none", error: "failed", warning };
}
function sh(file, args) {
  try {
    return execFileSync(file, args, { encoding: "utf8", timeout: 1500, stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
  } catch {
    return null;
  }
}
function findBin(name, extra = []) {
  const dirs = [...(process.env.PATH ?? "").split(path14.delimiter), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"];
  for (const f of [...extra, ...dirs.filter(Boolean).map((d) => path14.join(d, name))]) {
    try {
      fs13.accessSync(f, fs13.constants.X_OK);
      return f;
    } catch {
    }
  }
  return null;
}
function systemReader(platform = process.platform) {
  return {
    env(pid) {
      if (platform === "linux") {
        try {
          return parseProcEnviron(fs13.readFileSync(`/proc/${pid}/environ`, "utf8"));
        } catch {
          return {};
        }
      }
      const out = sh("ps", ["-E", "-ww", "-o", "command=", "-p", String(pid)]);
      return out ? parsePsEnv(out) : {};
    },
    tty(pid) {
      const t = (sh("ps", ["-o", "tty=", "-p", String(pid)]) ?? "").trim();
      return RE.tty.test(t) ? t : null;
    },
    appPath(pid) {
      if (platform !== "darwin") return null;
      let p = pid;
      for (let i = 0; i < 16 && p > 1; i++) {
        const out = (sh("ps", ["-o", "ppid=,comm=", "-p", String(p)]) ?? "").trim();
        const m = /^(\d+)\s+(.+)$/.exec(out);
        if (!m) return null;
        const app = appBundlePath(m[2]);
        if (app) return app;
        p = Number(m[1]);
      }
      return null;
    },
    tmuxClient(tmux, socket) {
      const out = sh(tmux, ["-S", socket, "list-clients", "-F", "#{client_activity} #{client_pid}"]) ?? "";
      let best = null;
      for (const line of out.split("\n")) {
        const m = /^(\d+) (\d+)$/.exec(line.trim());
        if (m && (!best || Number(m[1]) > best[0])) best = [Number(m[1]), Number(m[2])];
      }
      return best ? best[1] : null;
    }
  };
}
var ENV_KEYS, APPS, VSCODE_FAMILY, RE, appName, q, defaultRunner2, TMUX_TTL, TerminalLocator;
var init_terminal = __esm({
  "server/terminal.ts"() {
    "use strict";
    init_api();
    ENV_KEYS = [
      "TERM_PROGRAM",
      "WARP_FOCUS_URL",
      "__CFBundleIdentifier",
      "KITTY_WINDOW_ID",
      "KITTY_LISTEN_ON",
      "WEZTERM_PANE",
      "WEZTERM_UNIX_SOCKET",
      "TMUX",
      "TMUX_PANE",
      "ALACRITTY_WINDOW_ID",
      "ALACRITTY_SOCKET",
      "GHOSTTY_RESOURCES_DIR"
    ];
    APPS = {
      warp: { name: TERMINAL_NAMES.warp, bundle: "dev.warp.Warp-Stable", bundles: /^dev\.warp\./, term: ["WarpTerminal"] },
      iterm: { name: TERMINAL_NAMES.iterm, bundle: "com.googlecode.iterm2", bundles: /^com\.googlecode\.iterm2/, term: ["iTerm.app"] },
      terminal: { name: TERMINAL_NAMES.terminal, bundle: "com.apple.Terminal", bundles: /^com\.apple\.Terminal$/, term: ["Apple_Terminal"] },
      ghostty: { name: TERMINAL_NAMES.ghostty, bundle: "com.mitchellh.ghostty", bundles: /^com\.mitchellh\.ghostty/, term: ["ghostty"] },
      wezterm: { name: TERMINAL_NAMES.wezterm, bundle: "com.github.wez.wezterm", bundles: /^com\.github\.wez\.wezterm/, term: ["WezTerm"] },
      kitty: { name: TERMINAL_NAMES.kitty, bundle: "net.kovidgoyal.kitty", bundles: /^net\.kovidgoyal\.kitty/ },
      alacritty: { name: TERMINAL_NAMES.alacritty, bundle: "org.alacritty", bundles: /^org\.alacritty/ },
      vscode: { name: TERMINAL_NAMES.vscode, bundle: "com.microsoft.VSCode", bundles: /^com\.microsoft\.VSCode/ },
      cursor: { name: TERMINAL_NAMES.cursor, bundle: "com.todesktop.230313mzl4w4u92", bundles: /^com\.todesktop\.230313mzl4w4u92$/ },
      windsurf: { name: TERMINAL_NAMES.windsurf, bundle: "com.exafunction.windsurf", bundles: /^com\.exafunction\.windsurf/ }
    };
    VSCODE_FAMILY = ["cursor", "windsurf", "vscode"];
    RE = {
      warpUrl: /^warp:\/\/session\/[A-Za-z0-9-]{8,64}$/,
      bundle: /^[A-Za-z0-9][A-Za-z0-9.-]{2,120}$/,
      tty: /^(ttys?\d{1,4}|pts\/\d{1,5})$/,
      num: /^\d{1,9}$/,
      tmuxPane: /^%\d{1,9}$/,
      tmuxSocket: /^\/[^\0\n\r,]{1,500}$/,
      kittyTo: /^(unix:[@/][^\0\s]{1,300}|tcp:(localhost|127\.0\.0\.1):\d{1,5})$/,
      path: /^\/[^\0\n\r]{1,1000}$/
    };
    appName = (p) => p ? path14.basename(p).replace(/\.app$/, "") : null;
    q = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    defaultRunner2 = (c) => new Promise((resolve) => {
      execFile2(c.file, c.args, { timeout: 5e3, windowsHide: true, env: c.env ? { ...process.env, ...c.env } : process.env }, (err, stdout, stderr) => {
        resolve({ ok: !err, stdout: String(stdout ?? ""), stderr: String(stderr ?? "") + (err ? ` ${err.message}` : "") });
      });
    });
    TMUX_TTL = 3e4;
    TerminalLocator = class {
      constructor(platform = process.platform, reader = systemReader(platform), run = defaultRunner2, toolsOverride = null) {
        this.platform = platform;
        this.reader = reader;
        this.run = run;
        this.toolsOverride = toolsOverride;
      }
      platform;
      reader;
      run;
      toolsOverride;
      cache = /* @__PURE__ */ new Map();
      outerCache = /* @__PURE__ */ new Map();
      toolsCache = null;
      /** Only macOS and Linux have ways to switch terminals. */
      get supported() {
        return this.platform === "darwin" || this.platform === "linux";
      }
      tools() {
        if (this.toolsOverride) return this.toolsOverride;
        const mac = this.platform === "darwin";
        this.toolsCache ??= {
          open: mac && findBin("open", ["/usr/bin/open"]) !== null,
          osascript: mac && findBin("osascript", ["/usr/bin/osascript"]) !== null,
          tmux: findBin("tmux"),
          wezterm: findBin("wezterm", mac ? ["/Applications/WezTerm.app/Contents/MacOS/wezterm"] : []),
          kitten: findBin("kitten", mac ? ["/Applications/kitty.app/Contents/MacOS/kitten"] : [])
        };
        return this.toolsCache;
      }
      detectPid(pid) {
        const env2 = this.reader.env(pid);
        const tty = this.reader.tty(pid);
        const quick = detectApp(env2);
        const app = quick.app ? quick : detectApp(env2, this.reader.appPath(pid));
        return { ...app, env: env2, tty };
      }
      /** The process's terminal; `key` changes when the pid is reused by another session. */
      detect(pid, key = String(pid)) {
        let d = this.cache.get(key);
        if (!d) {
          if (this.cache.size > 300) this.cache.clear();
          d = this.detectPid(pid);
          this.cache.set(key, d);
        }
        return d;
      }
      outerOf(inner) {
        const tools = this.tools();
        const socket = tmuxSocket(inner.env);
        if (!tools.tmux || !socket) return null;
        const hit = this.outerCache.get(socket);
        if (hit && Date.now() - hit.at < TMUX_TTL) return hit.d;
        const client = this.reader.tmuxClient(tools.tmux, socket);
        const d = client ? this.detectPid(client) : null;
        this.outerCache.set(socket, { d, at: Date.now() });
        return d;
      }
      plan(pid, choice, key, fresh = false) {
        const d = this.detect(pid, key);
        const tools = this.tools();
        if (d.env.TMUX) {
          if (fresh) this.outerCache.clear();
          return planTmux(d, this.outerOf(d), choice, tools, this.platform);
        }
        return planFor(d, choice, tools, this.platform);
      }
      /** What the UI shows for a live session (null when the button is off or switching is not supported here). */
      describe(pid, choice, key) {
        if (!this.supported || choice === "off") return null;
        const p = this.plan(pid, choice, key);
        return { app: choice === "auto" ? this.detect(pid, key).app : choice, name: p.name, precision: p.precision, ...p.tmux ? { tmux: true } : {} };
      }
      async focus(pid, choice, key) {
        if (choice === "off") return { ok: false, name: null, precision: "none", error: "off" };
        if (!this.supported) return { ok: false, name: null, precision: "none", error: "unsupported" };
        return runPlan(this.plan(pid, choice, key, true), this.run);
      }
    };
  }
});

// server/index.ts
var index_exports = {};
import fs14 from "node:fs";
import http from "node:http";
import path15 from "node:path";
function about() {
  const st = db ? (hookLog.flush(), db.stats()) : null;
  const lim = readLimits();
  const lastHook = hooks.recent.length ? hooks.recent[hooks.recent.length - 1].ts : null;
  return {
    version: VERSION,
    dataDir: DATA_DIR,
    hooks: { pluginEnabled: hookPluginEnabled(), eventsReceived: hooks.installed || (st?.rows.hookEvents ?? 0) > 0, lastEventAt: lastHook },
    limits: { capture: lim.capture, updatedAt: lim.limits?.updatedAt ?? null },
    store: { enabled: !!st, fileSummaries: st?.rows.fileSummaries ?? 0, archived: st?.rows.archived ?? 0, hookEvents: st?.rows.hookEvents ?? 0, limits: st?.rows.limits ?? 0 },
    system: { available: systemNotifier.available, tool: systemNotifier.tool, platform: process.platform },
    plan: readPlan()
  };
}
function localOrigin(req) {
  const o = req.headers.origin;
  if (!o) return true;
  try {
    return ["127.0.0.1", "localhost", "[::1]"].includes(new URL(o).hostname);
  } catch {
    return false;
  }
}
function dbHealth() {
  if (!db) return { enabled: false };
  hookLog.flush();
  return {
    enabled: true,
    ...db.stats(),
    archivedInMemory: store.missing.size,
    warmLoadMs: store.stats.loadMs,
    pendingWrites: store.isDirty,
    lastFlush: { at: store.persist.lastFlushAt, ms: store.persist.lastFlushMs, rows: store.persist.lastFlushRows, count: store.persist.flushes }
  };
}
function json(res, code, body) {
  const s = JSON.stringify(body);
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(s);
}
function serveStatic(res, urlPath) {
  const safe = path15.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
  let file = path15.join(DIST_DIR, safe);
  if (!file.startsWith(DIST_DIR) || !fs14.existsSync(file) || fs14.statSync(file).isDirectory()) file = path15.join(DIST_DIR, "index.html");
  if (!fs14.existsSync(file)) {
    res.writeHead(404);
    res.end("dist is not built: run pnpm build");
    return;
  }
  res.writeHead(200, { "content-type": MIME[path15.extname(file)] ?? "application/octet-stream", "cache-control": file.endsWith("index.html") ? "no-store" : "public, max-age=3600" });
  fs14.createReadStream(file).pipe(res);
}
function readBody(req, limit = 2e6) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const chunks = [];
    req.on("data", (c) => {
      n += c.length;
      if (n > limit) {
        reject(new Error(errorText("en").tooLarge));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
var t0, migratedFrom, db, store, hooks, hookLog, limitsLog, live, forecaster, settings, terminals, termKey, systemNotifier, clients, recent, broadcast, MIME, server, PID_FILE, ownsPidFile, shutdown;
var init_index = __esm({
  "server/index.ts"() {
    "use strict";
    init_analytics();
    init_api();
    init_settings();
    init_config();
    init_db();
    init_hook_log();
    init_hooks();
    init_i18n();
    init_insights2();
    init_limits_forecast();
    init_limits_log();
    init_live();
    init_plan();
    init_recent_events();
    init_notifier();
    init_settings2();
    init_session_detail();
    init_replay2();
    init_changes();
    init_store();
    init_terminal();
    init_titles();
    t0 = Date.now();
    migratedFrom = migrateLegacyDb();
    if (migratedFrom) console.log(`[clorbit] copied the database from ${migratedFrom} to ${DB_FILE} (one-time migration; the old file is left untouched)`);
    db = null;
    try {
      db = ClorbitDb.open(DB_FILE);
    } catch (e) {
      console.error(`[clorbit] could not open ${DB_FILE}, running without persistence:`, e.message);
    }
    store = new Store(PROJECTS_DIR, db, { knownPlugins: knownPlugins() }, COWORK_DIR);
    store.loadCache(CACHE_DIR);
    if (store.persist.imported) console.log(`[clorbit] imported ${store.persist.imported.count} summaries from ${store.persist.imported.file}`);
    hooks = new Hooks();
    hookLog = new HookLog(db);
    limitsLog = new LimitsLog(db, () => readLimits().limits);
    live = new Live(store, hooks);
    forecaster = new LimitsForecaster((from, to) => limitsLog.history(from, to), () => store.files.values());
    live.forecast = (limits, now) => forecaster.get(limits, now);
    settings = new SettingsStore(db);
    setSessionNames(settings.get().sessionNames);
    settings.on("change", (s) => setSessionNames(s.sessionNames));
    terminals = new TerminalLocator();
    termKey = (pid) => `${pid.pid}:${pid.startedAt ?? ""}`;
    live.terminalOf = (pid) => terminals.describe(pid.pid, settings.get().terminal.app, termKey(pid));
    systemNotifier = new SystemNotifier();
    new ServerNotifications(() => settings.get(), systemNotifier).attach(live);
    clients = /* @__PURE__ */ new Map();
    recent = new RecentEvents();
    broadcast = (e) => {
      const ctx = e.kind === "text" ? {} : live.context(e);
      recent.push(e, ctx);
      const byLang = /* @__PURE__ */ new Map();
      for (const [c, lang] of clients) {
        let data = byLang.get(lang);
        if (!data) byLang.set(lang, data = `data: ${JSON.stringify({ ...localizeEvent(e, lang), ...ctx })}

`);
        c.write(data);
      }
    };
    live.on("event", broadcast);
    MIME = {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".woff2": "font/woff2",
      ".json": "application/json",
      ".ico": "image/x-icon",
      ".webp": "image/webp"
    };
    server = http.createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", `http://${HOST}`);
      const p = url.pathname;
      const lang = parseLang(url.searchParams);
      const err = errorText(lang);
      try {
        if (req.method === "POST" && p === "/api/hook") {
          const body = await readBody(req);
          let j = null;
          try {
            j = JSON.parse(body);
          } catch {
          }
          for (const e of hooks.ingest(j)) live.emitEvent(e);
          hookLog.record(j);
          return json(res, 200, { ok: true });
        }
        if (req.method === "PUT" && p === "/api/settings") {
          if (!localOrigin(req)) return json(res, 403, { error: err.forbidden });
          if (!String(req.headers["content-type"] ?? "").includes("application/json")) return json(res, 415, { error: err.jsonOnly });
          let j;
          try {
            j = JSON.parse(await readBody(req, 64e3));
          } catch {
            return json(res, 400, { error: err.badJson });
          }
          return json(res, 200, settings.update(j));
        }
        if (req.method === "POST" && p === "/api/notify/test") {
          if (!localOrigin(req)) return json(res, 403, { error: err.forbidden });
          if (!systemNotifier.available) return json(res, 200, { ok: false, error: "unavailable" });
          const ok = systemNotifier.send("Clorbit", notifyTestBody(lang));
          return json(res, 200, ok ? { ok } : { ok, error: "rate-limited" });
        }
        const term = req.method === "POST" ? /^\/api\/session\/([^/]+)\/terminal$/.exec(p) : null;
        if (term) {
          if (!localOrigin(req)) return json(res, 403, { error: err.forbidden });
          if (!String(req.headers["content-type"] ?? "").includes("application/json")) return json(res, 415, { error: err.jsonOnly });
          const id = decodeURIComponent(term[1]);
          if (!/^[\w-]{8,64}$/.test(id)) return json(res, 400, { error: err.badSession });
          const pid = live.pids.get(id);
          if (!pid?.alive) return json(res, 200, { ok: false, name: null, precision: "none", error: "not-live" });
          return json(res, 200, await terminals.focus(pid.pid, settings.get().terminal.app, termKey(pid)));
        }
        if (req.method !== "GET" && req.method !== "HEAD") return json(res, 405, { error: err.getOnly });
        if (p === "/api/health") return json(res, 200, { app: "clorbit", version: VERSION, pid: process.pid, port: PORT, dataDir: DATA_DIR, uptimeMs: Date.now() - t0 });
        if (p === "/api/live") return json(res, 200, live.snapshot(lang));
        if (p === "/api/settings") return json(res, 200, settings.get());
        if (p === "/api/about") return json(res, 200, about());
        if (p === "/api/events/recent") return json(res, 200, recent.list(lang, Number(url.searchParams.get("limit") ?? 500)));
        if (p === "/api/events") {
          res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", connection: "keep-alive", "x-accel-buffering": "no" });
          res.write(": clorbit\n\n");
          clients.set(res, lang);
          const hb = setInterval(() => res.write(": heartbeat\n\n"), 15e3);
          req.on("close", () => {
            clearInterval(hb);
            clients.delete(res);
          });
          return;
        }
        if (p === "/api/analytics/overview") return json(res, 200, overview(store, parseRange(url.searchParams)));
        if (p === "/api/analytics/attribution") return json(res, 200, attribution(store, parseRange(url.searchParams), lang));
        if (p === "/api/analytics/sessions") return json(res, 200, sessions(store, parseRange(url.searchParams), url.searchParams.get("project")));
        const rp = /^\/api\/session\/([^/]+)\/replay$/.exec(p);
        if (rp) {
          const id = decodeURIComponent(rp[1]);
          if (!/^[\w-]{8,64}$/.test(id)) return json(res, 400, { error: err.badSession });
          const r = await sessionReplay(store, id, !!live.pids.get(id)?.alive, lang);
          return r ? json(res, 200, r) : json(res, 404, { error: err.notFound });
        }
        const ac = /^\/api\/session\/([^/]+)\/agent\/([^/]+)\/changes$/.exec(p);
        if (ac) {
          const id = decodeURIComponent(ac[1]);
          const agent = decodeURIComponent(ac[2]);
          if (!/^[\w-]{8,64}$/.test(id) || !/^[\w-]{1,80}$/.test(agent)) return json(res, 400, { error: err.badSession });
          const r = await sessionAgentChanges(store, id, agent);
          return r ? json(res, 200, r) : json(res, 404, { error: err.notFound });
        }
        if (p.startsWith("/api/session/")) {
          const id = decodeURIComponent(p.slice("/api/session/".length));
          if (!/^[\w-]{8,64}$/.test(id)) return json(res, 400, { error: err.badSession });
          const pid = live.pids.get(id);
          const alive = !!pid?.alive;
          const d = await sessionDetail(store, id, alive, lang, alive ? pid?.status ?? null : null);
          return d ? json(res, 200, d) : json(res, 404, { error: err.notFound });
        }
        if (p === "/api/insights") {
          const page = url.searchParams.get("page");
          if (page !== null && !INSIGHT_PAGES.includes(page)) return json(res, 200, []);
          const nd = Number(url.searchParams.get("unusedDays"));
          const unusedDays = Number.isFinite(nd) && nd > 0 ? Math.round(Math.min(RECOMMEND_DAYS.max, Math.max(RECOMMEND_DAYS.min, nd))) : settings.get().recommendations.unusedDays;
          const session = url.searchParams.get("session");
          if (session !== null && !/^[\w-]{8,64}$/.test(session)) return json(res, 400, { error: err.badSession });
          return json(res, 200, insights(store, parseRange(url.searchParams), hookLog, lang, {
            page: page ?? void 0,
            unusedDays,
            session: session ?? void 0,
            limits: () => forecaster.get(readLimits().limits)
          }));
        }
        if (p === "/api/limits/history") {
          const r = parseTsRange(url.searchParams);
          return json(res, 200, limitsLog.history(r.from, r.to));
        }
        if (p === "/api/limits/forecast") return json(res, 200, forecaster.get(readLimits().limits));
        if (p === "/api/debug/scan") return json(res, 200, { ...store.stats, files: store.files.size, archived: store.missing.size, hooksRecent: hooks.recent.slice(-20), uptimeMs: Date.now() - t0, db: dbHealth() });
        if (p === "/api/debug/db") return json(res, 200, dbHealth());
        if (p.startsWith("/api/")) return json(res, 404, { error: err.unknownRoute });
        if (SERVE_WEB) return serveStatic(res, p);
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        res.end("Clorbit API. To serve the web app from here: pnpm start (or CLORBIT_SERVE_WEB=1 after pnpm build).");
      } catch (e) {
        console.error("[clorbit] request failed", p, e);
        if (!res.headersSent) json(res, 500, { error: String(e?.message ?? e) });
        else res.end();
      }
    });
    PID_FILE = env("PID_FILE");
    ownsPidFile = () => {
      try {
        return PID_FILE && JSON.parse(fs14.readFileSync(PID_FILE, "utf8")).pid === process.pid;
      } catch {
        return false;
      }
    };
    server.on("error", (e) => {
      if (e.code === "EADDRINUSE") console.error(`[clorbit] port ${PORT} on ${HOST} is already in use. Stop the other process or pick another port with CLORBIT_PORT.`);
      else console.error("[clorbit] server error", e);
      process.exit(1);
    });
    server.listen(PORT, HOST, () => {
      if (PID_FILE) {
        try {
          fs14.writeFileSync(PID_FILE, JSON.stringify({ pid: process.pid, port: PORT, version: VERSION, startedAt: (/* @__PURE__ */ new Date()).toISOString() }) + "\n");
        } catch (e) {
          console.error(`[clorbit] could not write ${PID_FILE}:`, e.message);
        }
      }
      const lock = env("START_LOCK");
      if (lock) try {
        fs14.rmSync(lock, { force: true });
      } catch {
      }
      console.log(`[clorbit] v${VERSION} http://${HOST}:${PORT} ready in ${Date.now() - t0} ms; ${store.files.size} files in the database, ${store.missing.size} archived (loaded in ${store.stats.loadMs} ms)`);
      live.start();
      hookLog.start();
      limitsLog.start();
      store.coldScan().then(() => {
        const st = store.stats;
        console.log(`[clorbit] scan: ${st.filesTotal} files, parsed ${st.filesParsed} (${(st.bytesParsed / 1e9).toFixed(2)} GB), from cache ${st.fromCache}, ${st.finishedAt - st.startedAt} ms`);
      }).catch((e) => console.error("[clorbit] scan failed", e));
    });
    shutdown = () => {
      live.stop();
      limitsLog.stop();
      try {
        hookLog.stop();
        store.saveNow();
        db?.close();
      } catch {
      }
      for (const c of clients.keys()) c.end();
      if (ownsPidFile()) try {
        fs14.unlinkSync(PID_FILE);
      } catch {
      }
      server.close();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }
});

// server/scan-worker.ts
var scan_worker_exports = {};
import { parentPort } from "node:worker_threads";
var init_scan_worker = __esm({
  "server/scan-worker.ts"() {
    "use strict";
    init_scanner();
    parentPort.on("message", async (msg) => {
      try {
        const r = await scanFile(msg.projectsDir, msg.file, msg.prev, msg.opts);
        parentPort.postMessage({ id: msg.id, result: r });
      } catch (e) {
        parentPort.postMessage({ id: msg.id, error: String(e?.message ?? e) });
      }
    });
  }
});

// server/bundle.ts
import { isMainThread } from "node:worker_threads";
if (isMainThread) await Promise.resolve().then(() => (init_index(), index_exports));
else await Promise.resolve().then(() => (init_scan_worker(), scan_worker_exports));
