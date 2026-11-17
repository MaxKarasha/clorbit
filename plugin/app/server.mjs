// Clorbit 0.1.1 server, bundled from server/ by scripts/build.mjs. Do not edit.
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
function parseLang(q) {
  const v = typeof q === "string" || q == null ? q : q.get("lang");
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
  return e.kind === "status" ? { ...e, reason: reasonText(e.reason, lang) } : e;
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
var REASONS, STARTUP, hookPluginKey, hookEventKey, OWN_SKILLS, STARTUP_LABELS, LEGACY_STARTUP, DETAIL, ERRORS;
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
        subagentsWorking: "\u041F\u0440\u0430\u0446\u044E\u044E\u0442\u044C \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0438: {a}"
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
      en: { badSession: "Invalid session id", notFound: "Session not found", getOnly: "GET only", unknownRoute: "Unknown route", tooLarge: "Request too large" },
      uk: { badSession: "\u041D\u0435\u043A\u043E\u0440\u0435\u043A\u0442\u043D\u0438\u0439 id \u0441\u0435\u0441\u0456\u0457", notFound: "\u0421\u0435\u0441\u0456\u044E \u043D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E", getOnly: "\u041B\u0438\u0448\u0435 GET", unknownRoute: "\u041D\u0435\u0432\u0456\u0434\u043E\u043C\u0438\u0439 \u043C\u0430\u0440\u0448\u0440\u0443\u0442", tooLarge: "\u0417\u0430\u0432\u0435\u043B\u0438\u043A\u0438\u0439 \u0437\u0430\u043F\u0438\u0442" }
    };
  }
});

// server/util.ts
import path from "node:path";
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
  const base = (p) => typeof p === "string" && p ? path.basename(p) : "";
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
  if (cwd) return path.basename(cwd) || cwd;
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
    zeroT4 = () => [0, 0, 0, 0];
    sumT4 = (t) => t[0] + t[1] + t[2] + t[3];
    toTokens = (t) => ({ input: t[0], output: t[1], cacheRead: t[2], cacheWrite: t[3] });
    estTokens = (chars) => Math.round(chars / 3.6);
    hourCache = /* @__PURE__ */ new Map();
    localDate = (ts) => localDateHour(ts).date;
    mcpKey = (display) => display.replace(/[^a-zA-Z0-9_-]/g, "_");
  }
});

// server/analytics.ts
function parseRange(q) {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const today = localDate(Date.now());
  let to = q.get("to") ?? "";
  let from = q.get("from") ?? "";
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
    title: main?.title ?? null,
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

// server/config.ts
import fs from "node:fs";
import os from "node:os";
import path2 from "node:path";
import { fileURLToPath } from "node:url";
function env(name) {
  return process.env[`CLORBIT_${name}`] || process.env[`FLEET_${name}`] || void 0;
}
function devVersion() {
  try {
    return JSON.parse(fs.readFileSync(path2.join(PROJECT_ROOT, "package.json"), "utf8")).version ?? "dev";
  } catch {
    return "dev";
  }
}
function migrateLegacyDb({ dbFile = DB_FILE, legacy = LEGACY_DB_FILE, explicitDataDir = DATA_DIR_EXPLICIT } = {}) {
  if (explicitDataDir) return null;
  try {
    if (fs.existsSync(dbFile) || !fs.existsSync(legacy)) return null;
    fs.mkdirSync(path2.dirname(dbFile), { recursive: true });
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
function hookPluginEnabled(settings = readSettings()) {
  return Object.entries(settings.enabledPlugins).some(([k, on]) => on && (k.startsWith("clorbit@") || k.startsWith("fleet-hooks@")));
}
function knownPlugins() {
  const names = /* @__PURE__ */ new Set();
  for (const k of Object.keys(readSettings().enabledPlugins)) names.add(k.split("@")[0]);
  try {
    const cache2 = path2.join(CLAUDE_DIR, "plugins", "cache");
    for (const mkt of fs.readdirSync(cache2)) {
      try {
        for (const p of fs.readdirSync(path2.join(cache2, mkt))) names.add(p);
      } catch {
      }
    }
  } catch {
  }
  return [...names].filter((n) => n.length >= 4).sort((a, b) => b.length - a.length);
}
var BUNDLED, HERE, PROJECT_ROOT, CLAUDE_DIR, PROJECTS_DIR, SESSIONS_DIR, SETTINGS_FILE, HOME_DATA_DIR, STATUSLINE_FILE, LEGACY_STATUSLINE_FILE, DATA_DIR, DATA_DIR_EXPLICIT, DB_FILE, CACHE_DIR, DIST_DIR, SERVE_WEB, PORT, HOST, VERSION, LEGACY_DB_FILE, settingsCache;
var init_config = __esm({
  "server/config.ts"() {
    "use strict";
    BUNDLED = true;
    HERE = path2.dirname(fileURLToPath(import.meta.url));
    PROJECT_ROOT = path2.resolve(HERE, "..");
    CLAUDE_DIR = env("CLAUDE_DIR") || path2.join(os.homedir(), ".claude");
    PROJECTS_DIR = path2.join(CLAUDE_DIR, "projects");
    SESSIONS_DIR = path2.join(CLAUDE_DIR, "sessions");
    SETTINGS_FILE = path2.join(CLAUDE_DIR, "settings.json");
    HOME_DATA_DIR = path2.join(os.homedir(), ".clorbit");
    STATUSLINE_FILE = env("STATUSLINE_FILE") || path2.join(HOME_DATA_DIR, "statusline.json");
    LEGACY_STATUSLINE_FILE = path2.join(os.homedir(), ".fleet", "statusline.json");
    DATA_DIR = env("DATA_DIR") || HOME_DATA_DIR;
    DATA_DIR_EXPLICIT = !!env("DATA_DIR");
    DB_FILE = path2.join(DATA_DIR, "clorbit.db");
    CACHE_DIR = env("CACHE_DIR") || path2.join(DATA_DIR, "cache");
    DIST_DIR = BUNDLED ? path2.join(HERE, "web") : path2.join(PROJECT_ROOT, "plugin", "app", "web");
    SERVE_WEB = env("SERVE_WEB") ? env("SERVE_WEB") === "1" : BUNDLED;
    PORT = Number(env("PORT")) || 4980;
    HOST = "127.0.0.1";
    VERSION = BUNDLED && true ? "0.1.1" : devVersion();
    LEGACY_DB_FILE = path2.join(PROJECT_ROOT, "data", "fleet.db");
    settingsCache = null;
  }
});

// server/types.ts
var SUMMARY_VERSION;
var init_types = __esm({
  "server/types.ts"() {
    "use strict";
    SUMMARY_VERSION = 5;
  }
});

// server/db.ts
import fs2 from "node:fs";
import { createRequire } from "node:module";
import path3 from "node:path";
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
  `)
    ];
    SCHEMA_VERSION = MIGRATIONS.length;
    ClorbitDb = class _ClorbitDb {
      constructor(file) {
        this.file = file;
        const { DatabaseSync } = loadSqlite();
        if (file !== ":memory:") fs2.mkdirSync(path3.dirname(file), { recursive: true });
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
      // ---------- file summaries ----------
      /** Loads summaries of the current SUMMARY_VERSION; rows of other versions stay in the DB untouched. */
      loadSummaries() {
        const rows = this.stmt("SELECT summary_json, missing_since FROM file_summaries WHERE version = ?").all(SUMMARY_VERSION);
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
        let names = [];
        try {
          names = fs2.readdirSync(cacheDir).filter((f) => /^summaries-v\d+\.json$/.test(f));
        } catch {
        }
        const want = `summaries-v${SUMMARY_VERSION}.json`;
        const skipped = names.filter((f) => f !== want);
        if (n > 0 || !names.includes(want)) {
          this.setMeta("json_import", JSON.stringify({ at: Date.now(), file: null, count: 0, skipped, reason: n > 0 ? "db-not-empty" : "no-current-cache" }));
          return null;
        }
        const file = path3.join(cacheDir, want);
        let files = [];
        try {
          const j = JSON.parse(fs2.readFileSync(file, "utf8"));
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
            return fs2.statSync(f).size;
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
var HOOK_RETENTION_MS, MAX_PAYLOAD_BYTES, WAIT_CAP_MS, str, WAIT_END, HookLog;
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

// server/insights-text.ts
function en() {
  const N = (n) => fmtNum(n, "en");
  const D = (ms) => fmtDuration(ms, "en");
  const times = (n) => `${n} ${plural(n, "en", ["time", "times"])}`;
  return {
    pct,
    unknownTool: "unknown tool",
    noPlugin: "no plugin",
    quote: (s) => `\u201C${s}\u201D`,
    toolFix: {
      Read: "Read large files in chunks (offset/limit) or locate the spot with Grep first, so only the needed fragment lands in context.",
      Bash: "Limit command output: `| head -n 50`, `| tail -n 50`, `--quiet`/`-q`, `grep` for key lines; for test logs, only failing tests.",
      Grep: "Narrow searches: `glob`/`type`, `head_limit`, files_with_matches mode instead of content.",
      WebFetch: "Ask WebFetch for a specific answer rather than the whole page.",
      Agent: "Ask subagents to return a concise report (findings, paths, short snippets), not raw file dumps."
    },
    toolFixBrowser: "For the browser, prefer get_page_text or find over full read_page/screenshots; close extra tabs \u2014 the tab list goes into context too.",
    toolFixMcp: (server2) => `Narrow requests to the ${server2} MCP server: filters, limits, only the fields you need.`,
    toolFixGeneric: "Limit the size of this tool's results (filters, limits, a compact format).",
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
    startupHook: {
      title: (plugin, per) => `Plugin ${plugin} adds ~${N(per)} tokens to every session`,
      detail: (plugin, per, sessions2, total) => `The SessionStart hook of ${plugin} injects a block of text at the start of every session. In this period that is ${N(per)} \xD7 ${sessions2} sessions \u2248 ${N(total)} tokens (estimated from text length), which are then re-read from cache on every turn.`,
      sessions: (sessions2, days) => `${sessions2} sessions with this block over ${days} days`,
      perSession: (per) => `\u2248 ${N(per)} tokens per session`,
      listing: (plugin, per) => `Another \u2248 ${N(per)} tokens per session \u2014 ${plugin}'s skill descriptions in the skill listing`,
      noListing: (plugin) => `No ${plugin} skills found in the listing`,
      fix: (plugin, key) => `If ${plugin} is not needed in every project, disable it globally in ~/.claude/settings.json: "enabledPlugins": { "${key}": false }, and enable it in the project-level .claude/settings.json where needed.`
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
    unusedPlugin: {
      title: (name, days) => `Plugin ${name} is enabled but unused for ${days} days`,
      detail: (name, hookRuns) => `No skill calls, MCP tool calls or attributed turns from ${name} in this period${hookRuns ? `, although its hooks ran ${N(hookRuns)} times` : ""}. It still takes space in the startup context.`,
      skills: (tok) => `Its skill descriptions: \u2248 ${N(tok)} tokens in this period`,
      noSkills: "No skills found in the listing",
      hookBlock: (tok) => `Hook block at startup: \u2248 ${N(tok)} tokens`,
      noHookBlock: "No startup hook block",
      hookRuns: (n) => `Hook runs: ${N(n)}`,
      fix: (key) => `In ~/.claude/settings.json: "enabledPlugins": { "${key}": false }`
    },
    unusedMcp: {
      title: (n, days) => `${n} MCP ${plural(n, "en", ["server is", "servers are"])} connected but had no calls in ${days} days`,
      detail: "These servers show up in sessions (instructions and/or the deferred tool list), but their tools were never called.",
      evidence: (name, n, tok) => `${name}: in ${n} sessions/subagents${tok ? `, instructions \u2248 ${N(tok)} tokens in total` : ""}`,
      fix: 'Disable unneeded servers via /mcp in Claude Code; claude.ai connectors ("claude.ai \u2026") \u2014 in Connectors settings on claude.ai.'
    },
    bigResults: {
      example: (label, tok, project) => `${label} \u2014 ${N(tok)} tokens (${project})`,
      title: (tool, n, max) => `${tool}: ${n} oversized ${plural(n, "en", ["result", "results"])} (up to ${N(max)} tokens)`,
      detail: (sum) => `Results over 20K tokens bloat the context at once and are then re-read on every turn. \u2248 ${N(sum)} tokens in total in this period.`
    },
    repeatedReads: {
      title: (n) => `Repeated reads: ${n} ${plural(n, "en", ["file was", "files were"])} read \u2265 3 times within a session`,
      detail: (sessions2, extra, avg) => `In ${sessions2} sessions the same files were read again; that is \u2248 ${N(extra)} extra Read calls (${N(avg)} tokens each on average).`,
      fix: "After the first read, keep the needed fragments in notes or the plan, and pass subagents a path and a specific line range. Frequently re-read reference files are worth shortening or splitting."
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
      detail: (names, min, err) => `Hooks (${names}) run as a separate process on every such event; their total execution time is \u2248 ${min} min.${err !== null ? ` ${pct(err)} of runs ended with an error or wrote to stderr.` : ""}`,
      runs: (n) => `Runs: ${N(n)}`,
      time: (sec) => `Total time: ${sec}s`,
      errors: (n) => `With error/stderr: ${N(n)}`,
      fix: (plugin, key) => `If plugin ${plugin} is not needed in this environment, disable it: "enabledPlugins": { "${key}": false } in ~/.claude/settings.json.`,
      fixNoPlugin: "Review the hook commands in ~/.claude/settings.json: are they needed on every event?"
    }
  };
}
function uk() {
  const N = (n) => fmtNum(n, "uk");
  const D = (ms) => fmtDuration(ms, "uk");
  const times = (n) => `${n} ${plural(n, "uk", ["\u0440\u0430\u0437", "\u0440\u0430\u0437\u0438", "\u0440\u0430\u0437\u0456\u0432"])}`;
  return {
    pct,
    unknownTool: "\u043D\u0435\u0432\u0456\u0434\u043E\u043C\u0438\u0439 \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442",
    noPlugin: "\u0431\u0435\u0437 \u043F\u043B\u0430\u0433\u0456\u043D\u0430",
    quote: (s) => `\xAB${s}\xBB`,
    toolFix: {
      Read: "\u0427\u0438\u0442\u0430\u0439 \u0432\u0435\u043B\u0438\u043A\u0456 \u0444\u0430\u0439\u043B\u0438 \u0447\u0430\u0441\u0442\u0438\u043D\u0430\u043C\u0438 (\u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u0438 offset/limit) \u0430\u0431\u043E \u0441\u043F\u0435\u0440\u0448\u0443 \u0437\u043D\u0430\u0439\u0434\u0438 \u043F\u043E\u0442\u0440\u0456\u0431\u043D\u0435 \u043C\u0456\u0441\u0446\u0435 \u0447\u0435\u0440\u0435\u0437 Grep \u2014 \u0442\u043E\u0434\u0456 \u0432 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 \u043F\u043E\u0442\u0440\u0430\u043F\u043B\u044F\u0454 \u043B\u0438\u0448\u0435 \u043F\u043E\u0442\u0440\u0456\u0431\u043D\u0438\u0439 \u0444\u0440\u0430\u0433\u043C\u0435\u043D\u0442.",
      Bash: "\u041E\u0431\u043C\u0435\u0436\u0443\u0439 \u0432\u0438\u0432\u0456\u0434 \u043A\u043E\u043C\u0430\u043D\u0434: `| head -n 50`, `| tail -n 50`, `--quiet`/`-q`, `grep` \u043F\u043E \u043A\u043B\u044E\u0447\u043E\u0432\u0438\u0445 \u0440\u044F\u0434\u043A\u0430\u0445; \u0434\u043B\u044F \u043B\u043E\u0433\u0456\u0432 \u0442\u0435\u0441\u0442\u0456\u0432 \u2014 \u043B\u0438\u0448\u0435 \u043D\u0435\u0432\u0434\u0430\u043B\u0456 \u0442\u0435\u0441\u0442\u0438.",
      Grep: "\u0417\u0432\u0443\u0436\u0443\u0439 \u043F\u043E\u0448\u0443\u043A: `glob`/`type`, `head_limit`, \u0440\u0435\u0436\u0438\u043C files_with_matches \u0437\u0430\u043C\u0456\u0441\u0442\u044C content.",
      WebFetch: "\u041F\u0440\u043E\u0441\u0438 \u0432 \u0437\u0430\u043F\u0438\u0442\u0456 WebFetch \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u0443 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u044C, \u0430 \u043D\u0435 \u0432\u0435\u0441\u044C \u0432\u043C\u0456\u0441\u0442 \u0441\u0442\u043E\u0440\u0456\u043D\u043A\u0438.",
      Agent: "\u041F\u0440\u043E\u0441\u0438 \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0456\u0432 \u043F\u043E\u0432\u0435\u0440\u0442\u0430\u0442\u0438 \u0441\u0442\u0438\u0441\u043B\u0438\u0439 \u0437\u0432\u0456\u0442 (\u0432\u0438\u0441\u043D\u043E\u0432\u043A\u0438, \u0448\u043B\u044F\u0445\u0438, \u043A\u043E\u0440\u043E\u0442\u043A\u0456 \u0444\u0440\u0430\u0433\u043C\u0435\u043D\u0442\u0438), \u0430 \u043D\u0435 \u0441\u0438\u0440\u0456 \u0434\u0430\u043C\u043F\u0438 \u0444\u0430\u0439\u043B\u0456\u0432."
    },
    toolFixBrowser: "\u0414\u043B\u044F \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430 \u0431\u0435\u0440\u0438 get_page_text \u0430\u0431\u043E find \u0437\u0430\u043C\u0456\u0441\u0442\u044C \u043F\u043E\u0432\u043D\u043E\u0433\u043E read_page/\u0441\u043A\u0440\u0438\u043D\u0448\u043E\u0442\u0456\u0432; \u0437\u0430\u043A\u0440\u0438\u0432\u0430\u0439 \u0437\u0430\u0439\u0432\u0456 \u0432\u043A\u043B\u0430\u0434\u043A\u0438 \u2014 \u0441\u043F\u0438\u0441\u043E\u043A \u0432\u043A\u043B\u0430\u0434\u043E\u043A \u0442\u0435\u0436 \u0456\u0434\u0435 \u0432 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442.",
    toolFixMcp: (server2) => `\u0417\u0432\u0443\u0437\u044C \u0437\u0430\u043F\u0438\u0442\u0438 \u0434\u043E MCP-\u0441\u0435\u0440\u0432\u0435\u0440\u0430 ${server2}: \u0444\u0456\u043B\u044C\u0442\u0440\u0438, \u043B\u0456\u043C\u0456\u0442\u0438, \u043B\u0438\u0448\u0435 \u043F\u043E\u0442\u0440\u0456\u0431\u043D\u0456 \u043F\u043E\u043B\u044F.`,
    toolFixGeneric: "\u041E\u0431\u043C\u0435\u0436 \u043E\u0431\u0441\u044F\u0433 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0443 \u0446\u044C\u043E\u0433\u043E \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0430 (\u0444\u0456\u043B\u044C\u0442\u0440\u0438, \u043B\u0456\u043C\u0456\u0442\u0438, \u0441\u0442\u0438\u0441\u043B\u0438\u0439 \u0444\u043E\u0440\u043C\u0430\u0442).",
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
    startupHook: {
      title: (plugin, per) => `\u041F\u043B\u0430\u0433\u0456\u043D ${plugin} \u0434\u043E\u0434\u0430\u0454 ~${N(per)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u0443 \u043A\u043E\u0436\u043D\u0443 \u0441\u0435\u0441\u0456\u044E`,
      detail: (plugin, per, sessions2, total) => `\u0425\u0443\u043A SessionStart \u043F\u043B\u0430\u0433\u0456\u043D\u0430 ${plugin} \u0432\u0441\u0442\u0430\u0432\u043B\u044F\u0454 \u0431\u043B\u043E\u043A \u0442\u0435\u043A\u0441\u0442\u0443 \u043D\u0430 \u0441\u0442\u0430\u0440\u0442\u0456 \u043A\u043E\u0436\u043D\u043E\u0457 \u0441\u0435\u0441\u0456\u0457. \u0417\u0430 \u043F\u0435\u0440\u0456\u043E\u0434 \u0446\u0435 ${N(per)} \xD7 ${sessions2} \u0441\u0435\u0441\u0456\u0439 \u2248 ${N(total)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 (\u043E\u0446\u0456\u043D\u043A\u0430 \u0437\u0430 \u0434\u043E\u0432\u0436\u0438\u043D\u043E\u044E \u0442\u0435\u043A\u0441\u0442\u0443), \u044F\u043A\u0456 \u043F\u043E\u0442\u0456\u043C \u0449\u043E\u0445\u043E\u0434\u0443 \u043F\u0435\u0440\u0435\u0447\u0438\u0442\u0443\u044E\u0442\u044C\u0441\u044F \u0437 \u043A\u0435\u0448\u0443.`,
      sessions: (sessions2, days) => `${sessions2} \u0441\u0435\u0441\u0456\u0439 \u0437 \u0446\u0438\u043C \u0431\u043B\u043E\u043A\u043E\u043C \u0437\u0430 ${days} \u0434\u043D.`,
      perSession: (per) => `\u2248 ${N(per)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u043D\u0430 \u0441\u0435\u0441\u0456\u044E`,
      listing: (plugin, per) => `\u0429\u0435 \u2248 ${N(per)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u043D\u0430 \u0441\u0435\u0441\u0456\u044E \u2014 \u043E\u043F\u0438\u0441\u0438 \u0441\u043A\u0456\u043B\u0456\u0432 ${plugin} \u0443 \u0441\u043F\u0438\u0441\u043A\u0443 \u0441\u043A\u0456\u043B\u0456\u0432`,
      noListing: (plugin) => `\u0421\u043A\u0456\u043B\u0456\u0432 ${plugin} \u0443 \u0441\u043F\u0438\u0441\u043A\u0443 \u043D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E`,
      fix: (plugin, key) => `\u042F\u043A\u0449\u043E ${plugin} \u043F\u043E\u0442\u0440\u0456\u0431\u0435\u043D \u043D\u0435 \u0432 \u043A\u043E\u0436\u043D\u043E\u043C\u0443 \u043F\u0440\u043E\u0454\u043A\u0442\u0456 \u2014 \u0432\u0438\u043C\u043A\u043D\u0438 \u0439\u043E\u0433\u043E \u0433\u043B\u043E\u0431\u0430\u043B\u044C\u043D\u043E \u0432 ~/.claude/settings.json: "enabledPlugins": { "${key}": false }, \u0430 \u0432 \u043F\u043E\u0442\u0440\u0456\u0431\u043D\u0438\u0445 \u043F\u0440\u043E\u0454\u043A\u0442\u0430\u0445 \u0443\u0432\u0456\u043C\u043A\u043D\u0438 \u0432 .claude/settings.json \u043F\u0440\u043E\u0454\u043A\u0442\u0443.`
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
    unusedPlugin: {
      title: (name, days) => `\u041F\u043B\u0430\u0433\u0456\u043D ${name} \u0443\u0432\u0456\u043C\u043A\u043D\u0435\u043D\u043E, \u0430\u043B\u0435 \u043D\u0435 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0432\u0430\u0432\u0441\u044F ${days} \u0434\u043D.`,
      detail: (name, hookRuns) => `\u0416\u043E\u0434\u043D\u043E\u0433\u043E \u0432\u0438\u043A\u043B\u0438\u043A\u0443 \u0441\u043A\u0456\u043B\u0456\u0432, MCP-\u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0456\u0432 \u0447\u0438 \u0430\u0442\u0440\u0438\u0431\u0443\u0442\u043E\u0432\u0430\u043D\u0438\u0445 \u0445\u043E\u0434\u0456\u0432 \u043F\u043B\u0430\u0433\u0456\u043D\u0430 ${name} \u0437\u0430 \u043F\u0435\u0440\u0456\u043E\u0434${hookRuns ? `, \u0445\u043E\u0447\u0430 \u0439\u043E\u0433\u043E \u0445\u0443\u043A\u0438 \u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u043B\u0438 ${N(hookRuns)} \u0440\u0430\u0437\u0456\u0432` : ""}. \u0412\u0456\u043D \u043E\u0434\u043D\u0430\u043A\u043E\u0432\u043E \u0437\u0430\u0439\u043C\u0430\u0454 \u043C\u0456\u0441\u0446\u0435 \u0432 \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u043E\u043C\u0443 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u0456.`,
      skills: (tok) => `\u041E\u043F\u0438\u0441\u0438 \u0439\u043E\u0433\u043E \u0441\u043A\u0456\u043B\u0456\u0432: \u2248 ${N(tok)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u0437\u0430 \u043F\u0435\u0440\u0456\u043E\u0434`,
      noSkills: "\u0421\u043A\u0456\u043B\u0456\u0432 \u0443 \u0441\u043F\u0438\u0441\u043A\u0443 \u043D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E",
      hookBlock: (tok) => `\u0411\u043B\u043E\u043A \u0445\u0443\u043A\u0430 \u043D\u0430 \u0441\u0442\u0430\u0440\u0442\u0456: \u2248 ${N(tok)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432`,
      noHookBlock: "\u0421\u0442\u0430\u0440\u0442\u043E\u0432\u043E\u0433\u043E \u0431\u043B\u043E\u043A\u0443 \u0445\u0443\u043A\u0430 \u043D\u0435\u043C\u0430\u0454",
      hookRuns: (n) => `\u0417\u0430\u043F\u0443\u0441\u043A\u0456\u0432 \u0445\u0443\u043A\u0456\u0432: ${N(n)}`,
      fix: (key) => `\u0423 ~/.claude/settings.json: "enabledPlugins": { "${key}": false }`
    },
    unusedMcp: {
      title: (n, days) => `${n} MCP-\u0441\u0435\u0440\u0432\u0435\u0440\u0456\u0432 \u043F\u0456\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u043E, \u0430\u043B\u0435 \u0436\u043E\u0434\u043D\u043E\u0433\u043E \u0432\u0438\u043A\u043B\u0438\u043A\u0443 \u0437\u0430 ${days} \u0434\u043D.`,
      detail: "\u0426\u0456 \u0441\u0435\u0440\u0432\u0435\u0440\u0438 \u0437'\u044F\u0432\u043B\u044F\u044E\u0442\u044C\u0441\u044F \u0432 \u0441\u0435\u0441\u0456\u044F\u0445 (\u0456\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0456\u0457 \u0442\u0430/\u0430\u0431\u043E \u0441\u043F\u0438\u0441\u043E\u043A \u0432\u0456\u0434\u043A\u043B\u0430\u0434\u0435\u043D\u0438\u0445 \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0456\u0432), \u0430\u043B\u0435 \u0457\u0445\u043D\u0456 \u0456\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0438 \u0436\u043E\u0434\u043D\u043E\u0433\u043E \u0440\u0430\u0437\u0443 \u043D\u0435 \u0432\u0438\u043A\u043B\u0438\u043A\u0430\u043B\u0438\u0441\u044C.",
      evidence: (name, n, tok) => `${name}: \u0443 ${n} \u0441\u0435\u0441\u0456\u044F\u0445/\u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0430\u0445${tok ? `, \u0456\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0456\u0457 \u2248 ${N(tok)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u0441\u0443\u043C\u0430\u0440\u043D\u043E` : ""}`,
      fix: "\u0412\u0438\u043C\u043A\u043D\u0438 \u043D\u0435\u043F\u043E\u0442\u0440\u0456\u0431\u043D\u0456 \u0441\u0435\u0440\u0432\u0435\u0440\u0438 \u0447\u0435\u0440\u0435\u0437 /mcp \u0443 Claude Code; \u043A\u043E\u043D\u0435\u043A\u0442\u043E\u0440\u0438 claude.ai (\xABclaude.ai \u2026\xBB) \u2014 \u0443 \u043D\u0430\u043B\u0430\u0448\u0442\u0443\u0432\u0430\u043D\u043D\u044F\u0445 Connectors \u043D\u0430 claude.ai."
    },
    bigResults: {
      example: (label, tok, project) => `${label} \u2014 ${N(tok)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 (${project})`,
      title: (tool, n, max) => `${tool}: ${n} \u0437\u0430\u0432\u0435\u043B\u0438\u043A\u0438\u0445 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0456\u0432 (\u0434\u043E ${N(max)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432)`,
      detail: (sum) => `\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0438 \u043F\u043E\u043D\u0430\u0434 20 \u0442\u0438\u0441. \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u043E\u0434\u0440\u0430\u0437\u0443 \u0440\u043E\u0437\u0434\u0443\u0432\u0430\u044E\u0442\u044C \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 \u0456 \u0434\u0430\u043B\u0456 \u043F\u0435\u0440\u0435\u0447\u0438\u0442\u0443\u044E\u0442\u044C\u0441\u044F \u0449\u043E\u0445\u043E\u0434\u0443. \u0420\u0430\u0437\u043E\u043C \u2248 ${N(sum)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u0437\u0430 \u043F\u0435\u0440\u0456\u043E\u0434.`
    },
    repeatedReads: {
      title: (n) => `\u041F\u043E\u0432\u0442\u043E\u0440\u043D\u0456 \u0447\u0438\u0442\u0430\u043D\u043D\u044F: ${n} \u0444\u0430\u0439\u043B\u0456\u0432 \u0447\u0438\u0442\u0430\u043B\u0438\u0441\u044C \u2265 3 \u0440\u0430\u0437\u0456\u0432 \u0443 \u043C\u0435\u0436\u0430\u0445 \u0441\u0435\u0441\u0456\u0457`,
      detail: (sessions2, extra, avg) => `\u0423 ${sessions2} \u0441\u0435\u0441\u0456\u044F\u0445 \u0442\u0456 \u0441\u0430\u043C\u0456 \u0444\u0430\u0439\u043B\u0438 \u043F\u0435\u0440\u0435\u0447\u0438\u0442\u0443\u0432\u0430\u043B\u0438\u0441\u044C; \u0446\u0435 \u2248 ${N(extra)} \u0437\u0430\u0439\u0432\u0438\u0445 \u0432\u0438\u043A\u043B\u0438\u043A\u0456\u0432 Read (\u0443 \u0441\u0435\u0440\u0435\u0434\u043D\u044C\u043E\u043C\u0443 ${N(avg)} \u0442\u043E\u043A\u0435\u043D\u0456\u0432 \u043A\u043E\u0436\u0435\u043D).`,
      fix: "\u041F\u0456\u0441\u043B\u044F \u043F\u0435\u0440\u0448\u043E\u0433\u043E \u0447\u0438\u0442\u0430\u043D\u043D\u044F \u0442\u0440\u0438\u043C\u0430\u0439 \u043F\u043E\u0442\u0440\u0456\u0431\u043D\u0456 \u0444\u0440\u0430\u0433\u043C\u0435\u043D\u0442\u0438 \u0432 \u043D\u043E\u0442\u0430\u0442\u043A\u0430\u0445/\u043F\u043B\u0430\u043D\u0456, \u0430 \u0441\u0443\u0431\u0430\u0433\u0435\u043D\u0442\u0430\u043C \u043F\u0435\u0440\u0435\u0434\u0430\u0432\u0430\u0439 \u0448\u043B\u044F\u0445 \u0456 \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u0438\u0439 \u0434\u0456\u0430\u043F\u0430\u0437\u043E\u043D \u0440\u044F\u0434\u043A\u0456\u0432. \u0427\u0430\u0441\u0442\u043E \u043F\u0435\u0440\u0435\u0447\u0438\u0442\u0443\u0432\u0430\u043D\u0456 \u0434\u043E\u0432\u0456\u0434\u043A\u043E\u0432\u0456 \u0444\u0430\u0439\u043B\u0438 \u0432\u0430\u0440\u0442\u043E \u0441\u043A\u043E\u0440\u043E\u0442\u0438\u0442\u0438 \u0430\u0431\u043E \u0440\u043E\u0437\u0431\u0438\u0442\u0438."
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
      detail: (names, min, err) => `\u0425\u0443\u043A\u0438 (${names}) \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u044E\u0442\u044C\u0441\u044F \u043E\u043A\u0440\u0435\u043C\u0438\u043C \u043F\u0440\u043E\u0446\u0435\u0441\u043E\u043C \u043D\u0430 \u043A\u043E\u0436\u043D\u0443 \u0442\u0430\u043A\u0443 \u043F\u043E\u0434\u0456\u044E; \u0441\u0443\u043C\u0430\u0440\u043D\u0438\u0439 \u0447\u0430\u0441 \u0457\u0445 \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F \u2248 ${min} \u0445\u0432.${err !== null ? ` ${pct(err)} \u0437\u0430\u043F\u0443\u0441\u043A\u0456\u0432 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u043B\u0438\u0441\u044C \u0437 \u043F\u043E\u043C\u0438\u043B\u043A\u043E\u044E \u0430\u0431\u043E \u043F\u0438\u0441\u0430\u043B\u0438 \u0432 stderr.` : ""}`,
      runs: (n) => `\u0417\u0430\u043F\u0443\u0441\u043A\u0456\u0432: ${N(n)}`,
      time: (sec) => `\u0421\u0443\u043C\u0430\u0440\u043D\u0438\u0439 \u0447\u0430\u0441: ${sec} \u0441`,
      errors: (n) => `\u0417 \u043F\u043E\u043C\u0438\u043B\u043A\u043E\u044E/stderr: ${N(n)}`,
      fix: (plugin, key) => `\u042F\u043A\u0449\u043E \u043F\u043B\u0430\u0433\u0456\u043D ${plugin} \u043D\u0435 \u043F\u043E\u0442\u0440\u0456\u0431\u0435\u043D \u0443 \u0446\u044C\u043E\u043C\u0443 \u0441\u0435\u0440\u0435\u0434\u043E\u0432\u0438\u0449\u0456 \u2014 \u0432\u0438\u043C\u043A\u043D\u0438: "enabledPlugins": { "${key}": false } \u0443 ~/.claude/settings.json.`,
      fixNoPlugin: "\u041F\u0435\u0440\u0435\u0432\u0456\u0440 \u043A\u043E\u043C\u0430\u043D\u0434\u0438 \u0445\u0443\u043A\u0456\u0432 \u0443 ~/.claude/settings.json: \u0447\u0438 \u0432\u043E\u043D\u0438 \u043F\u043E\u0442\u0440\u0456\u0431\u043D\u0456 \u043D\u0430 \u043A\u043E\u0436\u043D\u0443 \u043F\u043E\u0434\u0456\u044E."
    }
  };
}
function insightText(lang) {
  return cache[lang] ??= lang === "uk" ? uk() : en();
}
var pct, cache;
var init_insights_text = __esm({
  "server/insights-text.ts"() {
    "use strict";
    init_i18n();
    pct = (x) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`;
    cache = {};
  }
});

// server/insights.ts
import path4 from "node:path";
function filesStartedIn(store2, range) {
  const out = [];
  for (const s of store2.files.values()) {
    if (!s.firstTs) continue;
    const d = localDate(s.firstTs);
    if (d >= range.from && d <= range.to) out.push(s);
  }
  return out;
}
function filesActiveIn(store2, range) {
  const out = [];
  for (const s of store2.files.values()) {
    if (Object.keys(s.days).some((d) => d >= range.from && d <= range.to)) out.push(s);
  }
  return out;
}
function toolFix(tool, T) {
  if (T.toolFix[tool]) return T.toolFix[tool];
  const m = mcpSplit(tool);
  if (m && /chrome|browser/i.test(m.server)) return T.toolFixBrowser;
  if (m) return T.toolFixMcp(m.server);
  return T.toolFixGeneric;
}
function insights(store2, range, hookLog2, lang = "en") {
  const base = memoize(store2, `ins:${lang}:${range.from}:${range.to}`, () => compute(store2, range, lang));
  const extra = hookLog2 ? waitInsights(store2, hookLog2, range, lang) : [];
  if (!extra.length) return base;
  return [...base, ...extra].sort((a, b) => (b.estSavingTokens ?? 0) - (a.estSavingTokens ?? 0) || sevRank[a.severity] - sevRank[b.severity]);
}
function rangeMs(range) {
  const at = (d, plus) => {
    const [y, m, dd] = d.split("-").map(Number);
    return new Date(y, m - 1, dd + plus).getTime();
  };
  return { from: at(range.from, 0), to: at(range.to, 1) };
}
function waitInsights(store2, hookLog2, range, lang = "en") {
  const { from, to } = rangeMs(range);
  if (!hookLog2.hasEvents(from, to)) return [];
  const memoKey = `${hookLog2.version}:${store2.version}`;
  const cacheKey = `${lang}:${range.from}:${range.to}`;
  const hit = waitMemo.get(cacheKey);
  if (hit && hit.key === memoKey) return hit.v;
  const T = insightText(lang);
  const waits = deriveWaits(hookLog2.waitEvents(from - WAIT_CAP_MS, to + WAIT_CAP_MS)).filter((w) => w.start >= from && w.start < to && w.end > w.start);
  const v = [];
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
      return main?.title ? `${T.quote(main.title)}${project ? ` (${project})` : ""}` : project ?? sid.slice(0, 8);
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
    const allow = tools.map(([t]) => t).filter((t) => t !== UNKNOWN).slice(0, 4);
    const capH = WAIT_CAP_MS / 36e5;
    v.push({
      id: "hook-waits",
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
      fix: perm.length ? T.waits.fixPerm(allow.map((t) => `"${t === "Bash" ? "Bash(pnpm test:*)" : t}"`).join(", ")) : T.waits.fixInput
    });
  }
  waitMemo.set(cacheKey, { key: memoKey, v });
  if (waitMemo.size > 50) waitMemo.delete(waitMemo.keys().next().value);
  return v;
}
function compute(store2, range, lang) {
  const T = insightText(lang);
  const out = [];
  const attr = attribution(store2, range, lang);
  const ov = overview(store2, range);
  const grand = ov.totals.total || 1;
  const settings = readSettings();
  const ctx = new Ctx(store2);
  const started = filesStartedIn(store2, range);
  const mainsStarted = started.filter((s) => s.agentId === null);
  const days = Math.max(1, ov.daily.length);
  const pluginKey = (name) => Object.keys(settings.enabledPlugins).find((k) => k.split("@")[0] === name) ?? `${name}@\u2026`;
  for (const r of attr.startupContext) {
    if (!r.key.startsWith("hook:plugin:")) continue;
    const plugin = r.key.slice("hook:plugin:".length);
    const per = Number(r.extra?.perSession ?? 0);
    const sessions2 = r.calls;
    if (!sessions2 || per < 300) continue;
    const listing = mainsStarted.reduce((n, s) => n + (s.skillsByPlugin[plugin] ?? 0), 0);
    const listingPer = mainsStarted.length ? estTokens(listing) / mainsStarted.length : 0;
    const total = r.total;
    out.push({
      id: `startup-hook-${plugin}`,
      severity: total > 5e6 ? "high" : total > 5e5 ? "warn" : "info",
      title: T.startupHook.title(plugin, per),
      detail: T.startupHook.detail(plugin, per, sessions2, total),
      evidence: [
        T.startupHook.sessions(sessions2, days),
        T.startupHook.perSession(per),
        listingPer > 0 ? T.startupHook.listing(plugin, listingPer) : T.startupHook.noListing(plugin)
      ],
      fix: T.startupHook.fix(plugin, pluginKey(plugin)),
      estSavingTokens: Math.round(total)
    });
  }
  const skillRow = attr.startupContext.find((r) => r.key === STARTUP.skills);
  if (skillRow && skillRow.total > 0) {
    const byPlugin = /* @__PURE__ */ new Map();
    for (const s of started) for (const [p, c] of Object.entries(s.skillsByPlugin)) byPlugin.set(p, (byPlugin.get(p) ?? 0) + c);
    const top = [...byPlugin.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const per = Number(skillRow.extra?.perSession ?? 0);
    const perSub2 = Number(skillRow.extra?.perSubagent ?? 0);
    out.push({
      id: "startup-skill-listing",
      severity: skillRow.total > 5e6 ? "high" : "warn",
      title: T.skillListing.title(per, perSub2),
      detail: T.skillListing.detail(perSub2 > 0, skillRow.total),
      evidence: top.map(([p, c]) => T.skillListing.evidence(skillGroupLabel(p, lang), estTokens(c))),
      fix: T.skillListing.fix,
      estSavingTokens: Math.round(skillRow.total * 0.3)
    });
  }
  const perMain = attr.startupContext.reduce((n, r) => n + Number(r.extra?.perSession ?? 0), 0);
  const perSub = attr.startupContext.reduce((n, r) => n + Number(r.extra?.perSubagent ?? 0), 0);
  const startupTotal = attr.startupContext.reduce((n, r) => n + r.total, 0);
  if (perMain > 0) {
    const top = [...attr.startupContext].sort((a, b) => Number(b.extra?.perSession ?? 0) - Number(a.extra?.perSession ?? 0)).slice(0, 5);
    out.push({
      id: "startup-total",
      severity: "info",
      title: T.startupTotal.title(perMain, perSub),
      detail: T.startupTotal.detail(startupTotal),
      evidence: top.map((r) => T.startupTotal.evidence(r.label, Number(r.extra?.perSession ?? 0), Number(r.extra?.perSubagent ?? 0))),
      fix: T.startupTotal.fix
    });
  }
  const usedPlugin = (name) => attr.plugins.some((r) => r.key === name && (r.total > 0 || r.calls > 0)) || attr.skills.some((r) => (r.group === name || r.key.startsWith(name + ":")) && (r.total > 0 || r.calls > 0)) || attr.mcpServers.some((r) => (r.key.includes(`plugin:${name}:`) || mcpKey(r.key).includes(`plugin_${name}_`)) && (r.total > 0 || r.calls > 0)) || attr.tools.some((r) => r.key.startsWith(`mcp__plugin_${name}_`) && r.calls > 0);
  const filesInRange = filesActiveIn(store2, range);
  for (const [key, on] of Object.entries(settings.enabledPlugins)) {
    if (!on) continue;
    const name = key.split("@")[0];
    if (usedPlugin(name)) continue;
    const hookRunsAny = filesInRange.some((s) => Object.values(s.days).some((b) => Object.keys(b.hooks).some((k) => k.startsWith(name + "|"))));
    if (hookRunsAny && !started.some((s) => s.skillsByPlugin[name])) continue;
    const listChars = started.reduce((n, s) => n + (s.skillsByPlugin[name] ?? 0), 0);
    const hookRow = attr.startupContext.find((r) => r.key === hookPluginKey(name));
    const saving = estTokens(listChars) + (hookRow?.total ?? 0);
    const hookRuns = filesInRange.reduce((n, s) => {
      for (const [d, b] of Object.entries(s.days)) if (d >= range.from && d <= range.to) {
        for (const [k, h] of Object.entries(b.hooks)) if (k.startsWith(name + "|")) n += h.n;
      }
      return n;
    }, 0);
    out.push({
      id: `unused-plugin-${name}`,
      severity: saving > 1e6 ? "warn" : "info",
      title: T.unusedPlugin.title(name, days),
      detail: T.unusedPlugin.detail(name, hookRuns),
      evidence: [
        listChars ? T.unusedPlugin.skills(estTokens(listChars)) : T.unusedPlugin.noSkills,
        hookRow ? T.unusedPlugin.hookBlock(hookRow.total) : T.unusedPlugin.noHookBlock,
        ...hookRuns ? [T.unusedPlugin.hookRuns(hookRuns)] : []
      ],
      fix: T.unusedPlugin.fix(key),
      estSavingTokens: saving
    });
  }
  const disp = mcpDisplayNames(store2);
  const seen = /* @__PURE__ */ new Map();
  const blockChars = /* @__PURE__ */ new Map();
  for (const s of filesInRange) {
    for (const k of s.mcpSeen) seen.set(k, (seen.get(k) ?? 0) + 1);
    for (const [n, c] of Object.entries(s.mcpBlocks)) blockChars.set(mcpKey(n), (blockChars.get(mcpKey(n)) ?? 0) + c);
  }
  const usedMcp = /* @__PURE__ */ new Set();
  for (const r of attr.tools) {
    const m = mcpSplit(r.key);
    if (m && r.calls > 0) usedMcp.add(m.server);
  }
  for (const r of attr.mcpServers) if (r.total > 0 || r.calls > 0) usedMcp.add(mcpKey(r.key));
  const unusedMcp = [...seen.entries()].filter(([k]) => !usedMcp.has(k)).sort((a, b) => (blockChars.get(b[0]) ?? 0) - (blockChars.get(a[0]) ?? 0) || b[1] - a[1]);
  if (unusedMcp.length) {
    const saving = unusedMcp.reduce((n, [k]) => n + estTokens(blockChars.get(k) ?? 0), 0);
    out.push({
      id: "unused-mcp",
      severity: saving > 1e6 ? "warn" : "info",
      title: T.unusedMcp.title(unusedMcp.length, days),
      detail: T.unusedMcp.detail,
      evidence: unusedMcp.slice(0, 12).map(([k, n]) => T.unusedMcp.evidence(disp.get(k) ?? k, n, blockChars.get(k) ? estTokens(blockChars.get(k)) : 0)),
      fix: T.unusedMcp.fix,
      estSavingTokens: saving
    });
  }
  const big = /* @__PURE__ */ new Map();
  for (const s of filesInRange) {
    for (const r of s.bigResults) {
      const d = localDate(r.ts);
      if (d < range.from || d > range.to) continue;
      const a = big.get(r.tool) ?? { n: 0, sum: 0, max: 0, ex: [] };
      a.n++;
      a.sum += r.tokens;
      a.max = Math.max(a.max, r.tokens);
      if (a.ex.length < 4) a.ex.push(T.bigResults.example(r.label, r.tokens, ctx.project(s)));
      big.set(r.tool, a);
    }
  }
  for (const [tool, a] of [...big.entries()].sort((x, y) => y[1].sum - x[1].sum).slice(0, 5)) {
    out.push({
      id: `big-results-${tool}`,
      severity: a.sum > 2e6 ? "high" : a.sum > 3e5 ? "warn" : "info",
      title: T.bigResults.title(tool, a.n, a.max),
      detail: T.bigResults.detail(a.sum),
      evidence: a.ex,
      fix: toolFix(tool, T),
      estSavingTokens: Math.max(0, Math.round(a.sum - a.n * 5e3))
    });
  }
  const readAvg = Number(attr.tools.find((r) => r.key === "Read")?.extra?.avgResult ?? 1500);
  const repeated = [];
  const bySession = /* @__PURE__ */ new Map();
  for (const s of filesInRange) {
    const m = bySession.get(s.sessionId) ?? /* @__PURE__ */ new Map();
    for (const [f, n] of Object.entries(s.reads)) m.set(f, (m.get(f) ?? 0) + n);
    bySession.set(s.sessionId, m);
  }
  for (const [sid, m] of bySession) for (const [file, n] of m) if (n >= 3) repeated.push({ sid, file, n });
  if (repeated.length) {
    repeated.sort((a, b) => b.n - a.n);
    const extra = repeated.reduce((n, r) => n + (r.n - 1), 0);
    const sessionsN = new Set(repeated.map((r) => r.sid)).size;
    out.push({
      id: "repeated-reads",
      severity: extra * readAvg > 1e6 ? "warn" : "info",
      title: T.repeatedReads.title(repeated.length),
      detail: T.repeatedReads.detail(sessionsN, extra, readAvg),
      evidence: repeated.slice(0, 8).map((r) => {
        const main = store2.mainOf(r.sid);
        return `${path4.basename(r.file)} \xD7${r.n} \u2014 ${main?.title ?? ctx.projectOfSession.get(r.sid) ?? r.sid.slice(0, 8)}`;
      }),
      fix: T.repeatedReads.fix,
      estSavingTokens: Math.round(extra * readAvg)
    });
  }
  const compacted = [];
  for (const s of filesInRange) {
    if (s.agentId !== null) continue;
    let n = 0;
    for (const [d, b] of Object.entries(s.days)) if (d >= range.from && d <= range.to) n += b.autoCompactions;
    if (n > 0) compacted.push({ s, n });
  }
  if (compacted.length) {
    compacted.sort((a, b) => b.n - a.n);
    const total = compacted.reduce((n, c) => n + c.n, 0);
    out.push({
      id: "auto-compactions",
      severity: total >= 10 ? "warn" : "info",
      title: T.autoCompactions.title(total, compacted.length),
      detail: T.autoCompactions.detail,
      evidence: compacted.slice(0, 8).map((c) => `${c.s.title ?? ctx.project(c.s)} \u2014 ${c.n}\xD7 (${ctx.project(c.s)})`),
      fix: T.autoCompactions.fix(settings.env.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE)
    });
  }
  const skillsSorted = attr.skills.filter((r) => r.total > 0).sort((a, b) => b.total - a.total);
  for (const r of skillsSorted.slice(0, 3)) {
    const share = r.total / grand;
    if (share < 0.03) continue;
    const loads = Number(r.extra?.loads ?? 0);
    out.push({
      id: `skill-share-${r.key}`,
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
      severity: "info",
      title: T.skillLoads.title,
      detail: T.skillLoads.detail,
      evidence: oftenLoaded.slice(0, 8).map((r) => T.skillLoads.evidence(r.key, r.extra.loads, r.total / grand))
    });
  }
  const rates = ov.daily.map((d) => {
    const denom = d.tokens.input + d.tokens.cacheRead + d.tokens.cacheWrite;
    return { d, denom, rate: denom ? d.tokens.cacheRead / denom : 1 };
  }).filter((x) => x.denom > 1e6);
  if (rates.length) {
    const sumDen = rates.reduce((n, x) => n + x.denom, 0);
    const avg = rates.reduce((n, x) => n + x.d.tokens.cacheRead, 0) / sumDen;
    const low = rates.filter((x) => x.rate < Math.min(0.85, avg - 0.05)).sort((a, b) => a.rate - b.rate);
    if (low.length) {
      const saving = low.reduce((n, x) => n + Math.max(0, (avg - x.rate) * x.denom), 0);
      out.push({
        id: "low-cache-days",
        severity: low.some((x) => x.rate < 0.7) ? "warn" : "info",
        title: T.lowCache.title(low.length, avg),
        detail: T.lowCache.detail,
        evidence: low.slice(0, 8).map((x) => T.lowCache.evidence(x.d.date, x.rate, x.d.tokens.cacheWrite, x.d.tokens.input)),
        fix: T.lowCache.fix,
        estSavingTokens: Math.round(saving)
      });
    }
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
      severity: errShare > 0.5 && a.n > 500 ? "warn" : "info",
      title: T.hooks.title(plugin || null, a.n, min, errShare > 0.5 ? errShare : null),
      detail: T.hooks.detail([...a.names].join(", "), min, a.err ? errShare : null),
      evidence: [T.hooks.runs(a.n), T.hooks.time(Math.round(a.ms / 1e3)), T.hooks.errors(a.err)],
      fix: plugin ? T.hooks.fix(plugin, pluginKey(plugin)) : T.hooks.fixNoPlugin
    });
  }
  out.sort((a, b) => (b.estSavingTokens ?? 0) - (a.estSavingTokens ?? 0) || sevRank[a.severity] - sevRank[b.severity]);
  return out;
}
var sevRank, waitMemo;
var init_insights = __esm({
  "server/insights.ts"() {
    "use strict";
    init_analytics();
    init_config();
    init_hook_log();
    init_util();
    init_i18n();
    init_insights_text();
    sevRank = { high: 0, warn: 1, info: 2 };
    waitMemo = /* @__PURE__ */ new Map();
  }
});

// server/limits-log.ts
function parseTsRange(q, now = Date.now()) {
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
  let to = parse(q.get("to"), true) ?? now;
  let from = parse(q.get("from"), false) ?? to - 7 * 24 * 36e5;
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
        const rows = this.db.stmt("SELECT ts, five_pct, week_pct FROM limits WHERE ts >= ? AND ts <= ? ORDER BY ts").all(from, to);
        return rows.map((r) => ({ ts: r.ts, fiveHourPct: r.five_pct, sevenDayPct: r.week_pct }));
      }
    };
  }
});

// server/lines.ts
import fs3 from "node:fs/promises";
function classifyPrefix(head) {
  if (head[0] !== 123 || head[1] !== 34) return null;
  const p = head.subarray(0, 24).toString("latin1");
  if (p.startsWith('{"type":"api-request') || p.startsWith('{"type":"file-history-')) return "skip";
  return null;
}
async function readLines(file, start, sink, maxBytes = Infinity) {
  const fh = await fs3.open(file, "r");
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
import fs4 from "node:fs";
import path5 from "node:path";
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
  const rel = path5.relative(projectsDir, file).split(path5.sep);
  if (rel.length < 2 || rel[0] === ".." || !file.endsWith(".jsonl")) return null;
  const projectDir = rel[0];
  if (rel.length === 2) return { sessionId: path5.basename(rel[1], ".jsonl"), agentId: null, projectDir };
  const base = path5.basename(file, ".jsonl");
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
    const m = JSON.parse(fs4.readFileSync(metaPath, "utf8"));
    const wf = path5.basename(path5.dirname(file));
    return {
      agentType: m.agentType || "general-purpose",
      description: m.description ?? null,
      spawnDepth: typeof m.spawnDepth === "number" ? m.spawnDepth : 1,
      toolUseId: m.toolUseId ?? null,
      finished: typeof m.finished === "boolean" ? m.finished : null,
      workflow: wf.startsWith("wf_") ? wf : null,
      worktreePath: m.worktreePath ?? null
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
function detectPlugin(texts, known) {
  for (const t of texts) {
    if (!t) continue;
    const m = /plugins\/(?:cache|marketplaces)\/[^/\s"]+\/([^/\s"]+)\//.exec(t);
    if (m) return m[1];
  }
  let best = null;
  let bestN = 0;
  for (const p of known) {
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
async function scanFile(projectsDir, file, prev, opts, onEvent) {
  let st;
  try {
    st = fs4.statSync(file);
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
var RECENT_REQ, MAX_PENDING, MAX_TOOLNAMES, BIG_RESULT, MAX_BIG, LABELS, ENV_TYPES, FileScanner;
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
            c.lastCtx = t[0] + t[2] + t[3];
            if (c.lastCtx > c.maxCtx) c.maxCtx = c.lastCtx;
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
          if (blk.type === "tool_use") this.toolUse(blk, ts, sidechain);
          else if (blk.type === "text" && typeof blk.text === "string" && blk.text.trim() && !sidechain) {
            c.lastText = trimText(blk.text, 240);
            c.lastTextTs = ts;
            this.onEvent?.({ kind: "text", ts, text: c.lastText });
          }
        }
        if (!sidechain && msg.stop_reason === "end_turn") this.onEvent?.({ kind: "end", ts });
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
        if (!hasResult && !d.isMeta && !sidechain && d.type === "user" && !d.sourceToolUseID) {
          const isText = typeof content === "string" || Array.isArray(content) && content.some((x) => x?.type === "text");
          if (isText) {
            c.lastPromptTs = ts;
            c.lastStop = null;
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
              for (const ln of a.content.split("\n")) {
                const m = /^- ([^:\s]+):([^:\s]+):/.exec(ln);
                const key = m ? m[1] : OWN_SKILLS;
                s.skillsByPlugin[key] = (s.skillsByPlugin[key] ?? 0) + ln.length + 1;
              }
            }
            return;
          }
          case "mcp_instructions_delta": {
            this.addStartup(LABELS.mcp, size);
            const names = Array.isArray(a.addedNames) ? a.addedNames : [];
            const blocks = Array.isArray(a.addedBlocks) ? a.addedBlocks : [];
            names.forEach((n, i) => {
              const k = mcpKey(String(n));
              if (!s.mcpSeen.includes(k)) s.mcpSeen.push(k);
              if (!c.startupDone) s.mcpBlocks[String(n)] = (s.mcpBlocks[String(n)] ?? 0) + (typeof blocks[i] === "string" ? blocks[i].length : 0);
            });
            return;
          }
          case "deferred_tools_record":
          case "deferred_tools_delta": {
            this.addStartup(LABELS.deferred, size);
            const names = Array.isArray(a.addedNames) ? a.addedNames : Array.isArray(a.entries) ? a.entries.map((e) => e?.name).filter(Boolean) : [];
            for (const n of names) {
              const m = mcpSplit(String(n));
              if (m && !s.mcpSeen.includes(m.server)) s.mcpSeen.push(m.server);
            }
            return;
          }
          case "agent_listing_delta":
            this.addStartup(LABELS.agents, size);
            return;
          case "instructions":
          case "nested_memory":
            this.addStartup(LABELS.claudeMd, size);
            return;
          case "prompt_snapshot": {
            const sp = Array.isArray(a.systemPrompt) ? a.systemPrompt : [];
            const chars = sp.reduce((n, x) => n + (typeof x === "string" ? x.length : 0), 0) || lineLen;
            if (chars > (s.startup[LABELS.system] ?? 0)) s.startup[LABELS.system] = chars;
            if (Array.isArray(a.tools) && a.tools.length) {
              const tc = JSON.stringify(a.tools).length;
              if (tc > (s.startup[LABELS.toolDefs] ?? 0)) s.startup[LABELS.toolDefs] = tc;
            }
            return;
          }
          default:
            if (ENV_TYPES.has(a.type)) this.addStartup(LABELS.env, rendered);
            else if (rendered) this.addStartup(LABELS.other, rendered);
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
import fs5 from "node:fs";
import os2 from "node:os";
import path6 from "node:path";
import { Worker } from "node:worker_threads";
function listTranscripts(projectsDir) {
  const out = [];
  let dirs = [];
  try {
    dirs = fs5.readdirSync(projectsDir);
  } catch {
    return out;
  }
  for (const d of dirs) {
    const pd = path6.join(projectsDir, d);
    let entries;
    try {
      entries = fs5.readdirSync(pd, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (e.isFile() && e.name.endsWith(".jsonl")) out.push(path6.join(pd, e.name));
      else if (e.isDirectory()) {
        const sub = path6.join(pd, e.name, "subagents");
        let se;
        try {
          se = fs5.readdirSync(sub, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const x of se) {
          if (x.isFile() && x.name.startsWith("agent-") && x.name.endsWith(".jsonl")) out.push(path6.join(sub, x.name));
          else if (x.isDirectory() && x.name === "workflows") {
            let wfs = [];
            try {
              wfs = fs5.readdirSync(path6.join(sub, "workflows"));
            } catch {
              continue;
            }
            for (const wf of wfs) {
              let af = [];
              try {
                af = fs5.readdirSync(path6.join(sub, "workflows", wf));
              } catch {
                continue;
              }
              for (const f of af) if (f.startsWith("agent-") && f.endsWith(".jsonl")) out.push(path6.join(sub, "workflows", wf, f));
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
    init_scanner();
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
      constructor(projectsDir, db2, opts) {
        super();
        this.projectsDir = projectsDir;
        this.db = db2;
        this.opts = opts;
      }
      projectsDir;
      db;
      opts;
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
      put(s, bump = true, persist = true) {
        this.files.set(s.path, s);
        let set = this.bySession.get(s.sessionId);
        if (!set) this.bySession.set(s.sessionId, set = /* @__PURE__ */ new Set());
        set.add(s.path);
        if (persist) {
          this.missing.delete(s.path);
          this.dirtyPaths.add(s.path);
        }
        if (bump) this.version++;
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
      async coldScan(threads = Math.max(2, Math.min(8, os2.cpus().length - 2))) {
        const st = this.stats;
        st.startedAt = Date.now();
        const list = listTranscripts(this.projectsDir);
        const withM = list.map((f) => {
          try {
            const s = fs5.statSync(f);
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
          if (prev && prev.size === x.size && prev.mtimeMs === x.m) {
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
          if (!fs5.existsSync(file)) {
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
function agentStatus(s, now) {
  const pend = pendingList(s).filter((p) => p.name !== "Agent" && p.name !== "Task");
  const quiet = now - s.lastTs;
  if (pend.length && quiet > WAIT_MS && pend.some((p) => now - p.ts > WAIT_MS)) return "waiting";
  if (quiet < WORKING_MS) return "working";
  if (pendingList(s).length) return "working";
  if (s.carry.lastStop === "tool_use") return "working";
  return "idle";
}
function buildTree(main, subs, now, sessionAlive, includeDone) {
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
  const rootStatus = !main ? "idle" : !sessionAlive ? "done" : agentStatus(main, now);
  const root = mkNode(main, "main", 0, rootStatus);
  const nodes = /* @__PURE__ */ new Map();
  const finished = [];
  let active = 0;
  let working = 0;
  for (const s of subs) {
    const done = subagentDone(s, now, sessionAlive);
    const st = done ? "done" : agentStatus(s, now);
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
function sessionStatus(main, subs, tree, now, alive, pidStatus) {
  if (!alive) return { status: "stopped", reason: { k: "processEnded" } };
  if (!main) return { status: "idle", reason: { k: "justStarted" } };
  const lastAct = Math.max(main.lastTs, ...subs.map((s) => s.lastTs));
  const pend = Object.values(main.carry.pending).filter((p) => p.name !== "Agent" && p.name !== "Task");
  const oldest = pend.reduce((m, p) => Math.min(m, p.ts), Infinity);
  const asks = main.permissionMode !== "bypassPermissions";
  if (asks && pend.length && now - oldest > WAIT_MS && now - lastAct > WAIT_MS) {
    const p = pend.find((x) => x.ts === oldest);
    return { status: "waiting", reason: { k: "probablyPermission", a: p.name } };
  }
  if (pidStatus && /wait|permission|input/i.test(pidStatus)) return { status: "waiting", reason: { k: "waitingYou" } };
  if (now - main.lastTs < WORKING_MS) return { status: "working", reason: main.carry.lastTool && pend.length ? { k: "running", a: main.carry.lastTool } : { k: "working" } };
  if (tree.working > 0) return { status: "working", reason: { k: "subagentsWorking", a: tree.working } };
  if (pend.length) return { status: "working", reason: { k: "running", a: pend[pend.length - 1].label } };
  if (pidStatus === "busy") return { status: "working", reason: { k: "working" } };
  if (main.carry.lastStop === "end_turn") return { status: "idle", reason: { k: "answerReady" } };
  return { status: "idle", reason: null };
}
var WORKING_MS, WAIT_MS, SUB_QUIET_MS, SUB_STALE_MS;
var init_tree = __esm({
  "server/tree.ts"() {
    "use strict";
    init_util();
    WORKING_MS = 2e4;
    WAIT_MS = 1e4;
    SUB_QUIET_MS = 10 * 6e4;
    SUB_STALE_MS = 30 * 6e4;
  }
});

// server/live.ts
import { EventEmitter as EventEmitter2 } from "node:events";
import fs6 from "node:fs";
import path7 from "node:path";
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
  let names = [];
  try {
    names = fs6.readdirSync(dir);
  } catch {
    return out;
  }
  for (const n of names) {
    if (!/^\d+\.json$/.test(n)) continue;
    try {
      const j = JSON.parse(fs6.readFileSync(path7.join(dir, n), "utf8"));
      const pid = Number(j.pid ?? n.split(".")[0]);
      if (!j.sessionId) continue;
      const info = {
        pid,
        sessionId: String(j.sessionId),
        cwd: j.cwd ?? null,
        startedAt: typeof j.startedAt === "number" ? j.startedAt : null,
        name: j.name ?? null,
        status: j.status ?? null,
        alive: isAlive(pid)
      };
      const prev = out.get(info.sessionId);
      if (!prev || !prev.alive && info.alive) out.set(info.sessionId, info);
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
function readLimits() {
  try {
    const file = fs6.existsSync(STATUSLINE_FILE) || !fs6.existsSync(LEGACY_STATUSLINE_FILE) ? STATUSLINE_FILE : LEGACY_STATUSLINE_FILE;
    const st = fs6.statSync(file);
    const j = JSON.parse(fs6.readFileSync(file, "utf8"));
    const rl = j.rate_limits ?? {};
    const num = (v) => typeof v === "number" && Number.isFinite(v) ? v : null;
    const sec = (v) => num(v) === null ? null : v < 1e12 ? v * 1e3 : v;
    return {
      capture: true,
      limits: {
        fiveHourPct: num(rl.five_hour?.used_percentage),
        fiveHourResetsAt: sec(rl.five_hour?.resets_at),
        sevenDayPct: num(rl.seven_day?.used_percentage),
        sevenDayResetsAt: sec(rl.seven_day?.resets_at),
        updatedAt: Math.round(st.mtimeMs)
      }
    };
  } catch {
    return { limits: null, capture: false };
  }
}
var DAY_MS, Live;
var init_live = __esm({
  "server/live.ts"() {
    "use strict";
    init_config();
    init_i18n();
    init_store();
    init_tree();
    init_util();
    DAY_MS = 24 * 36e5;
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
      statusMem = /* @__PURE__ */ new Map();
      finishedMem = /* @__PURE__ */ new Map();
      cache = null;
      timers = [];
      watchers = [];
      pending = /* @__PURE__ */ new Map();
      baseline = false;
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
          const w = fs6.watch(PROJECTS_DIR, { recursive: true }, (_ev, name) => {
            if (!name) return;
            const f = String(name);
            if (f.endsWith(".jsonl")) this.schedule(path7.join(PROJECTS_DIR, f));
            else if (f.endsWith(".meta.json")) this.schedule(path7.join(PROJECTS_DIR, f.replace(/\.meta\.json$/, ".jsonl")));
          });
          this.watchers.push(w);
        } catch (e) {
          console.warn("[clorbit] fs.watch on projects is unavailable:", e.message);
        }
        try {
          const w = fs6.watch(SESSIONS_DIR, () => this.schedule("__sessions__"));
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
            const st = fs6.statSync(s.path);
            if (st.size !== s.size || st.mtimeMs !== s.mtimeMs) void this.store.refresh(s.path);
          } catch {
          }
        }
        if (this.store.scanDone) {
          for (const p of this.pids.values()) {
            if (!p.alive) continue;
            const main = this.store.mainOf(p.sessionId);
            const dir = main ? path7.join(path7.dirname(main.path), p.sessionId, "subagents") : null;
            if (!dir) continue;
            try {
              for (const f of fs6.readdirSync(dir)) {
                if (f.startsWith("agent-") && f.endsWith(".jsonl")) {
                  const full = path7.join(dir, f);
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
        for (const f of listTranscripts(PROJECTS_DIR)) if (!this.store.files.has(f)) void this.store.refresh(f);
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
          const known = this.finishedMem.get(ls.sessionId) ?? /* @__PURE__ */ new Set();
          const subs = this.store.sessionFiles(ls.sessionId).filter((s) => s.agentId);
          const alive = ls.alive;
          for (const s of subs) {
            if (known.has(s.agentId)) continue;
            if (subagentDone(s, snap.now, alive)) {
              known.add(s.agentId);
              if (emit && snap.now - s.lastTs < 15 * 6e4) {
                const parent = s.meta?.toolUseId ? this.parentOf(ls.sessionId, s.meta.toolUseId) : "main";
                this.emit("event", { kind: "finish", ts: snap.now, sessionId: ls.sessionId, agentId: s.agentId, parentId: parent, tokens: sumT4(s.total) });
              }
            }
          }
          this.finishedMem.set(ls.sessionId, known);
        }
        if (this.store.scanDone) this.baseline = true;
      }
      parentOf(sessionId, toolUseId) {
        for (const s of this.store.sessionFiles(sessionId)) if (s.spawns[toolUseId]) return s.agentId ?? "main";
        return "main";
      }
      /** The live snapshot with status reasons rendered in the given language. */
      snapshot(lang = "en") {
        const { v, reasons } = this.compute();
        return { ...v, sessions: v.sessions.map((s) => ({ ...s, statusReason: reasonText(reasons.get(s.sessionId), lang) })) };
      }
      compute() {
        const now = Date.now();
        if (this.cache && now - this.cache.at < 500) return this.cache;
        const reasons = /* @__PURE__ */ new Map();
        const cutoff = now - DAY_MS;
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
        for (const sid of sessionIds) {
          const files = this.store.sessionFiles(sid);
          const main = files.find((f) => f.agentId === null) ?? null;
          const subs = files.filter((f) => f.agentId !== null);
          const pid = this.pids.get(sid) ?? null;
          const isAlive2 = !!pid?.alive;
          const tree = buildTree(main, subs, now, isAlive2, false);
          let st = sessionStatus(main, subs, tree, now, isAlive2, pid?.status ?? null);
          const lastActivity = Math.max(main?.lastTs ?? 0, ...subs.map((s) => s.lastTs), pid?.startedAt ?? 0);
          const hs = this.hooks.bySession.get(sid);
          if (hs && isAlive2 && hs.ts + 3e3 >= lastActivity) st = { status: hs.status, reason: hs.reason };
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
          const project = projectOf(cwd, main?.projectDir ?? subs[0]?.projectDir);
          if (sumT4(s24) > 0) projects.add(project);
          for (const f of subs) if (f.lastTs >= cutoff && subagentDone(f, now, isAlive2)) finished24++;
          if (isAlive2) alive++;
          if (st.status === "working") working++;
          if (st.status === "waiting") waiting++;
          workingSubs += tree.working;
          sessions2.push({
            sessionId: sid,
            pid: pid?.pid ?? null,
            alive: isAlive2,
            title: main?.title ?? null,
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
            root: tree.root
          });
        }
        const order = { waiting: 0, working: 1, idle: 2, stopped: 3 };
        sessions2.sort((a, b) => order[a.status] - order[b.status] || b.lastActivity - a.lastActivity);
        const lim = readLimits();
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
          // Hooks count as installed when the clorbit plugin (or legacy fleet-hooks) is enabled, or events already arrived.
          hooksInstalled: hookPluginEnabled() || this.hooks.installed,
          statuslineCapture: lim.capture,
          scan: { done: this.store.scanDone, filesTotal: this.store.stats.filesTotal, filesDone: this.store.stats.filesDone }
        };
        this.cache = { at: now, v, reasons };
        return this.cache;
      }
    };
  }
});

// server/session-detail.ts
async function sessionDetail(store2, sessionId, alive, lang = "en") {
  const files = store2.sessionFiles(sessionId);
  if (!files.length) return null;
  const sig = files.map((f) => `${f.path}:${f.size}:${store2.isMissing(f.path) ? "gone" : ""}`).sort().join("|") + `:${alive}:${lang}`;
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
  const tree = buildTree(main, subs, now, alive, true);
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

// server/index.ts
var index_exports = {};
import fs7 from "node:fs";
import http from "node:http";
import path8 from "node:path";
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
  const safe = path8.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
  let file = path8.join(DIST_DIR, safe);
  if (!file.startsWith(DIST_DIR) || !fs7.existsSync(file) || fs7.statSync(file).isDirectory()) file = path8.join(DIST_DIR, "index.html");
  if (!fs7.existsSync(file)) {
    res.writeHead(404);
    res.end("dist is not built: run pnpm build");
    return;
  }
  res.writeHead(200, { "content-type": MIME[path8.extname(file)] ?? "application/octet-stream", "cache-control": file.endsWith("index.html") ? "no-store" : "public, max-age=3600" });
  fs7.createReadStream(file).pipe(res);
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
var t0, migratedFrom, db, store, hooks, hookLog, limitsLog, live, clients, broadcast, MIME, server, PID_FILE, ownsPidFile, shutdown;
var init_index = __esm({
  "server/index.ts"() {
    "use strict";
    init_analytics();
    init_config();
    init_db();
    init_hook_log();
    init_hooks();
    init_i18n();
    init_insights();
    init_limits_log();
    init_live();
    init_session_detail();
    init_store();
    t0 = Date.now();
    migratedFrom = migrateLegacyDb();
    if (migratedFrom) console.log(`[clorbit] copied the database from ${migratedFrom} to ${DB_FILE} (one-time migration; the old file is left untouched)`);
    db = null;
    try {
      db = ClorbitDb.open(DB_FILE);
    } catch (e) {
      console.error(`[clorbit] could not open ${DB_FILE}, running without persistence:`, e.message);
    }
    store = new Store(PROJECTS_DIR, db, { knownPlugins: knownPlugins() });
    store.loadCache(CACHE_DIR);
    if (store.persist.imported) console.log(`[clorbit] imported ${store.persist.imported.count} summaries from ${store.persist.imported.file}`);
    hooks = new Hooks();
    hookLog = new HookLog(db);
    limitsLog = new LimitsLog(db, () => readLimits().limits);
    live = new Live(store, hooks);
    clients = /* @__PURE__ */ new Map();
    broadcast = (e) => {
      const byLang = /* @__PURE__ */ new Map();
      for (const [c, lang] of clients) {
        let data = byLang.get(lang);
        if (!data) byLang.set(lang, data = `data: ${JSON.stringify(localizeEvent(e, lang))}

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
        if (req.method !== "GET" && req.method !== "HEAD") return json(res, 405, { error: err.getOnly });
        if (p === "/api/health") return json(res, 200, { app: "clorbit", version: VERSION, pid: process.pid, port: PORT, dataDir: DATA_DIR, uptimeMs: Date.now() - t0 });
        if (p === "/api/live") return json(res, 200, live.snapshot(lang));
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
        if (p.startsWith("/api/session/")) {
          const id = decodeURIComponent(p.slice("/api/session/".length));
          if (!/^[\w-]{8,64}$/.test(id)) return json(res, 400, { error: err.badSession });
          const alive = !!live.pids.get(id)?.alive;
          const d = await sessionDetail(store, id, alive, lang);
          return d ? json(res, 200, d) : json(res, 404, { error: err.notFound });
        }
        if (p === "/api/insights") return json(res, 200, insights(store, parseRange(url.searchParams), hookLog, lang));
        if (p === "/api/limits/history") {
          const r = parseTsRange(url.searchParams);
          return json(res, 200, limitsLog.history(r.from, r.to));
        }
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
        return PID_FILE && JSON.parse(fs7.readFileSync(PID_FILE, "utf8")).pid === process.pid;
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
          fs7.writeFileSync(PID_FILE, JSON.stringify({ pid: process.pid, port: PORT, version: VERSION, startedAt: (/* @__PURE__ */ new Date()).toISOString() }) + "\n");
        } catch (e) {
          console.error(`[clorbit] could not write ${PID_FILE}:`, e.message);
        }
      }
      const lock = env("START_LOCK");
      if (lock) try {
        fs7.rmSync(lock, { force: true });
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
        fs7.unlinkSync(PID_FILE);
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
