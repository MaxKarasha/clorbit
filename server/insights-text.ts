// Insight texts in English and Ukrainian. insights.ts computes the facts; this file words them.
import { fmtDuration, fmtNum, plural, type Lang } from './i18n';

const pct = (x: number) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`;

function en() {
  const N = (n: number) => fmtNum(n, 'en');
  const D = (ms: number) => fmtDuration(ms, 'en');
  const times = (n: number) => `${n} ${plural(n, 'en', ['time', 'times'])}`;
  return {
    pct,
    unknownTool: 'unknown tool',
    noPlugin: 'no plugin',
    quote: (s: string) => `“${s}”`,
    toolFix: {
      Read: 'Read large files in chunks (offset/limit) or locate the spot with Grep first, so only the needed fragment lands in context.',
      Bash: 'Limit command output: `| head -n 50`, `| tail -n 50`, `--quiet`/`-q`, `grep` for key lines; for test logs, only failing tests.',
      Grep: 'Narrow searches: `glob`/`type`, `head_limit`, files_with_matches mode instead of content.',
      WebFetch: 'Ask WebFetch for a specific answer rather than the whole page.',
      Agent: 'Ask subagents to return a concise report (findings, paths, short snippets), not raw file dumps.',
    } as Record<string, string>,
    toolFixBrowser: 'For the browser, prefer get_page_text or find over full read_page/screenshots; close extra tabs — the tab list goes into context too.',
    toolFixMcp: (server: string) => `Narrow requests to the ${server} MCP server: filters, limits, only the fields you need.`,
    toolFixGeneric: 'Limit the size of this tool\'s results (filters, limits, a compact format).',

    waits: {
      title: (total: number, longest: number) => `You kept agents waiting for ${D(total)} in this period; the longest wait was ${D(longest)}`,
      detail: (n: number, perm: { n: number; ms: number } | null, input: { n: number; ms: number } | null, where: string, date: string, capH: number) =>
        `According to hooks, sessions waited for you ${times(n)}: ${[
          perm ? `for tool permission ${times(perm.n)} (${D(perm.ms)})` : '',
          input ? `for your reply ${times(input.n)} (${D(input.ms)})` : '',
        ].filter(Boolean).join(', ')}. The longest wait: ${where}, ${date}. A single wait over ${capH} h counts as ${capH} h.`,
      toolLine: (tool: string, n: number, ms: number) => `${tool}: ${n} permission ${plural(n, 'en', ['request', 'requests'])}, ${D(ms)} in total`,
      inputLine: (n: number, ms: number) => `Waiting for your reply: ${times(n)}, ${D(ms)} in total`,
      fixPerm: (allow: string) => `Pre-approve safe, frequent tools: "permissions": { "allow": [${allow}] } in the project's .claude/settings.json (for Bash — specific commands only). Long waits for replies are a reason to enable notifications or give agents longer autonomous tasks.`,
      fixInput: 'Long waits for replies are a reason to enable notifications or give agents longer autonomous tasks with a clear definition of done.',
    },

    skillListing: {
      title: (per: number, perSub: number) => `Skill listing: ~${N(per)} tokens per session${perSub ? ` and ~${N(perSub)} per subagent` : ''}`,
      detail: (perSub: boolean, total: number) => `Descriptions of all available skills are injected at the start of every session${perSub ? ' and every subagent' : ''}. In total ≈ ${N(total)} tokens in this period.`,
      evidence: (p: string, tok: number) => `${p}: ≈ ${N(tok)} tokens in total`,
      fix: 'Disable plugins whose skills you do not use (enabledPlugins in ~/.claude/settings.json), remove unneeded skills from ~/.claude/skills, and shorten your own skills\' descriptions to one sentence.',
    },

    startupTotal: {
      title: (perMain: number, perSub: number) => `Startup context: ~${N(perMain)} tokens per session${perSub ? `, ~${N(perSub)} per subagent` : ''}`,
      detail: (total: number) => `Before the first prompt, the context already holds the system prompt, tool definitions, skill and agent listings, CLAUDE.md and more. In total ≈ ${N(total)} tokens in this period (estimated from text length); after that they are read from cache on every turn.`,
      evidence: (label: string, per: number, perSub: number) => `${label}: ≈ ${N(per)} per session${perSub ? `, ≈ ${N(perSub)} per subagent` : ''}`,
      fix: 'The easiest wins: shorten the skill listing (disable unused plugins, remove unneeded skills) and CLAUDE.md; do small tasks without a separate subagent — each subagent pays this startup cost again.',
    },


    bigResults: {
      example: (label: string, tok: number, project: string) => `${label} — ${N(tok)} tokens (${project})`,
      title: (tool: string, n: number, max: number) => `${tool}: ${n} oversized ${plural(n, 'en', ['result', 'results'])} (up to ${N(max)} tokens)`,
      detail: (sum: number) => `Results over 20K tokens bloat the context at once and are then re-read on every turn. ≈ ${N(sum)} tokens in total in this period.`,
    },

    repeatedReads: {
      title: (n: number) => `Repeated reads: ${n} ${plural(n, 'en', ['file was', 'files were'])} read ≥ 3 times within a session`,
      detail: (sessions: number, extra: number, avg: number) => `In ${sessions} sessions the same files were read again; that is ≈ ${N(extra)} extra Read calls (${N(avg)} tokens each on average).`,
      fix: 'After the first read, keep the needed fragments in notes or the plan, and pass subagents a path and a specific line range. Frequently re-read reference files are worth shortening or splitting.',
    },

    autoCompactions: {
      title: (total: number, sessions: number) => `${total} auto-${plural(total, 'en', ['compaction', 'compactions'])} in ${sessions} ${plural(sessions, 'en', ['session', 'sessions'])}`,
      detail: 'Auto-compaction means the context hit its limit: some details are lost, and the compaction itself costs an extra large turn.',
      fix: (pctEnv: string | undefined) => `Split big tasks into stages: after each stage, write a short summary into the plan file and /clear; hand research and bulk reads to subagents (Explore) so raw results stay out of the main context.${pctEnv ? ` Current threshold: CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=${pctEnv}.` : ''}`,
    },

    skillShare: {
      title: (key: string, share: number, loads: number) => `Skill ${key}: ${pct(share)} of all tokens${loads ? `, ${loads} loads` : ''}`,
      detail: (key: string, total: number, sessions: number, perLoad: number | null) => `Turns attributed to ${key} used ≈ ${N(total)} tokens in ${sessions} sessions${perLoad !== null ? ` (≈ ${N(perLoad)} per load)` : ''}. That is not necessarily bad — but make sure the skill does not pull in more than it needs.`,
      turns: (turns: number, sessions: number) => `Turns: ${N(turns)}, sessions: ${sessions}`,
      tokens: (out: number, write: number) => `Output tokens: ${N(out)}, cache writes: ${N(write)}`,
      fix: 'Check SKILL.md: move reference sections into separate files the skill reads only when needed; sharpen the description so the skill does not trigger where it is not needed.',
    },

    skillLoads: {
      title: 'Most frequently loaded skills',
      detail: 'How many times Skill was invoked and what share of tokens the turns under that skill took.',
      evidence: (key: string, loads: number | string, share: number) => `${key}: ${loads}× — ${pct(share)} of tokens`,
    },

    lowCache: {
      title: (n: number, avg: number) => `${n} ${plural(n, 'en', ['day', 'days'])} with a low cache hit rate (average ${pct(avg)})`,
      detail: 'On these days a large part of the context was written to the cache again instead of being read from it. Cache writes cost more than reads and burn through limits faster.',
      evidence: (date: string, rate: number, write: number, input: number) => `${date}: cache ${pct(rate)}, cache writes ${N(write)}, uncached ${N(input)}`,
      fix: 'The prompt cache lives for a limited time: after a long pause, start a new session with a short summary instead of continuing a large one. Do not switch model/effort or change CLAUDE.md or the MCP set in the middle of a long session — that resets the cache.',
    },

    hooks: {
      title: (plugin: string | null, n: number, min: number, err: number | null) => `Hooks ${plugin ? `of plugin ${plugin}` : 'without a plugin'}: ${N(n)} runs, ${min} min of execution${err !== null ? `, ${pct(err)} with an error or stderr` : ''}`,
      detail: (names: string, min: number, err: number | null) => `Hooks (${names}) run as a separate process on every such event; their total execution time is ≈ ${min} min.${err !== null ? ` ${pct(err)} of runs ended with an error or wrote to stderr.` : ''}`,
      runs: (n: number) => `Runs: ${N(n)}`,
      time: (sec: number) => `Total time: ${sec}s`,
      errors: (n: number) => `With error/stderr: ${N(n)}`,
      fix: (plugin: string, key: string) => `If plugin ${plugin} is not needed in this environment, disable it: "enabledPlugins": { "${key}": false } in ~/.claude/settings.json.`,
      fixNoPlugin: 'Review the hook commands in ~/.claude/settings.json: are they needed on every event?',
    },

    // Recommendations (recommend-*.ts). Prompt items reuse `why` lines, so they read well on their own.
    rec: {
      lastUsed: (days: number) => (days === 0 ? 'last used today' : `last used ${days} ${plural(days, 'en', ['day', 'days'])} ago`),
      never: (since: string | null) => (since ? `never used (listed since ${since})` : 'never used'),
      perSession: (tok: number) => `≈ ${N(tok)} tokens of context per session`,
      parts: (p: { skills: number; hook: number; mcp: number }) => [
        p.skills ? `skill descriptions ${N(p.skills)}` : '',
        p.hook ? `SessionStart hook ${N(p.hook)}` : '',
        p.mcp ? `MCP instructions ${N(p.mcp)}` : '',
      ].filter(Boolean).join(' + '),
      unusedPlugins: {
        titleOne: (name: string, last: string) => `Plugin ${name} is enabled but ${last}`,
        titleMany: (n: number, days: number) => `${n} enabled plugins have not been used for ${days}+ days`,
        detail: (days: number) => `No skill calls, MCP tool calls or attributed turns in the whole stored history for at least ${days} days (archived sessions included). They still load into every new session and every subagent that gets the skill listing.`,
        evidence: (name: string, last: string, per: number, parts: string) => `${name}: ${last}; ≈ ${N(per)} tokens per session${parts ? ` (${parts})` : ''}`,
        why: (last: string, per: number) => `${last}; ≈ ${N(per)} tokens of context per session`,
        summary: (n: number, days: number) => `${n} enabled ${plural(n, 'en', ['plugin has', 'plugins have'])} not been used for ${days}+ days but still add to the startup context of every session.`,
      },
      hookContext: {
        title: (plugin: string, per: number) => `Plugin ${plugin} adds ~${N(per)} tokens to every session, also where it is not used`,
        detail: (plugin: string, used: number, total: number, projects: string[]) =>
          `Its SessionStart hook injects a block of text at the start of every session, yet the skills or tools of ${plugin} were used in ${used} of ${total} such sessions in this period${projects.length ? ` (projects: ${projects.join(', ')})` : ''}. Disable it globally and enable it only where you use it.`,
        sessions: (used: number, total: number) => `Used in ${used} of ${total} sessions that carried the hook block`,
        perSession: (per: number) => `Hook block: ≈ ${N(per)} tokens per session`,
        why: (per: number, used: number, total: number) => `its SessionStart hook adds ≈ ${N(per)} tokens to every session, but it was used in ${used} of ${total} sessions`,
        whyEnable: (project: string) => `you use it in ${project}`,
        skillsUnused: (n: number, total: number, days: number) => `${n} of its ${total} skills not used for ${days}+ days`,
        summary: (plugin: string, per: number) => `plugin ${plugin} injects ≈ ${N(per)} tokens into every session through its SessionStart hook, but is used only in a few projects.`,
        fix: (plugin: string, key: string) => `If ${plugin} is not needed in every project, disable it globally (claude plugin disable ${key} --scope user) and enable it where you use it (claude plugin enable ${key} --scope local inside that project).`,
      },
      unusedSkills: {
        title: (plugin: string, n: number, total: number, days: number) => `Plugin ${plugin}: ${n} of ${total} skills not used for ${days}+ days`,
        detail: (plugin: string, unusedTok: number, totalTok: number) =>
          `Their descriptions take ≈ ${N(unusedTok)} of the ≈ ${N(totalTok)} listing tokens of ${plugin} in every session. A plugin's skills cannot be turned off one by one, so the choice is the whole plugin: disable it if you can do without the skills you still use.`,
        stillUsed: (list: string) => `Still in use: ${list}`,
        noneUsed: 'None of its listed skills was used recently; only its hooks or MCP tools were',
        mcpUsed: (last: string) => `Its MCP tools: ${last}`,
        why: (n: number, total: number, used: string) => `${n} of its ${total} skills not used recently${used ? `; still in use: ${used}` : ''}`,
        summary: (plugin: string, n: number, total: number, days: number) => `${n} of the ${total} skills of plugin ${plugin} have not been used for ${days}+ days.`,
      },
      unusedOwn: {
        title: (n: number, days: number) => `${n} of your own ${plural(n, 'en', ['skills has', 'skills have'])} not been used for ${days}+ days`,
        detail: (dir: string) => `Skills in ${dir} are listed in every session and every subagent that gets the skill listing. Moving a folder to a "-disabled" folder next to it takes it out of the listing and keeps it safe to bring back.`,
        evidence: (name: string, last: string, per: number) => `${name}: ${last}; ≈ ${N(per)} tokens per session`,
        why: (last: string, per: number) => `${last}; ≈ ${N(per)} tokens of context per session`,
        summary: (n: number, days: number) => `${n} of my own ${plural(n, 'en', ['skills has', 'skills have'])} not been used for ${days}+ days.`,
      },
      duplicates: {
        title: (n: number) => `${n} ${plural(n, 'en', ['skill name appears', 'skill names appear'])} more than once in the skill listing`,
        detail: 'The same name in several plugins, or your own skill next to a plugin skill of the same name: both descriptions are paid for in every session, and the model may pick the wrong one.',
        own: 'your own',
        copy: (label: string, last: string) => `${label} — ${last}`,
        evidence: (name: string, copies: string) => `${name}: ${copies}`,
        whyMove: (keep: string, keepLast: string) => `the same skill also comes from ${keep} (${keepLast})`,
        reviewAction: (key: string, keep: string) => `Compare the skill ${key} with ${keep}`,
        whyReview: (plugin: string) => `a plugin skill cannot be turned off alone; tell me whether disabling ${plugin} as a whole makes sense, and which copy to keep`,
        summary: (n: number) => `${n} skill ${plural(n, 'en', ['name is', 'names are'])} listed more than once.`,
      },

      // ---------- MCP (recommend-mcp.ts) ----------
      mcpParts: (p: { instr: number; defs: number; names: number }) => [
        p.instr ? `instructions ${N(p.instr)}` : '',
        p.defs ? `tool definitions ${N(p.defs)}` : '',
        p.names ? `tool names ${N(p.names)}` : '',
      ].filter(Boolean).join(' + '),
      mcpSource: {
        user: (file: string) => `user config (${file})`,
        local: (dirs: string[]) => `local config of ${dirs.join(', ')}`,
        project: (dirs: string[]) => `.mcp.json of ${dirs.join(', ')}`,
        plugin: (plugin: string) => `plugin ${plugin}`,
        claudeai: 'claude.ai connector',
        unknown: 'configured elsewhere',
      },
      unusedMcp: {
        titleOne: (name: string, last: string) => `MCP server ${name} is connected but ${last}`,
        titleMany: (n: number, days: number) => `${n} connected MCP ${plural(n, 'en', ['server has', 'servers have'])} not been used for ${days}+ days`,
        detail: (days: number) => `No calls of their tools in the whole stored history for at least ${days} days (archived sessions included), yet every new session and subagent loads them: their instructions and their tools. With tool search on, only tool names are listed at the start (schemas load when a tool is used), so the saving is mostly the instructions and the names.`,
        evidence: (name: string, source: string, last: string, per: number, parts: string) => `${name} (${source}): ${last}; ≈ ${N(per)} tokens per session${parts ? ` (${parts})` : ''}`,
        noSize: 'size not measured (older transcripts)',
        why: (last: string, per: number) => `${last}${per ? `; ≈ ${N(per)} tokens of context per session` : ''}`,
        summary: (n: number, days: number) => `${n} connected MCP ${plural(n, 'en', ['server has', 'servers have'])} not been used for ${days}+ days but still load into every session.`,
        alsoFailed: (n: number) => `also failed to connect in ${n} ${plural(n, 'en', ['session', 'sessions'])}`,
        pluginAction: (name: string, plugin: string) => `MCP server ${name} comes with the plugin ${plugin}`,
        pluginUnusedWhy: (server: string, last: string) => `its MCP server ${server} is unused, and so is the plugin as a whole: ${last}`,
        pluginWhy: (last: string, key: string) => `${last}. The plugin itself is still in use, and its server cannot be turned off alone: in a project that does not need it, turn it off in /mcp (that project only); or, if you can do without the whole plugin, disable it (claude plugin disable ${key} --scope user). Tell me which you prefer`,
        connectorAction: (name: string) => `Disconnect the claude.ai connector ${name}`,
        connectorWhy: (last: string) => `${last}. Claude Code cannot do this for me: disconnect it on claude.ai → Settings → Connectors (it then disappears everywhere), or turn it off for one project in /mcp`,
        connectorsAllWhy: (n: number, days: number) => `none of the ${n} claude.ai ${plural(n, 'en', ['connector', 'connectors'])} Claude Code loads was used for ${days}+ days`,
        unknownAction: (name: string) => `Find where the MCP server ${name} is configured`,
        unknownWhy: (last: string) => `${last}. It is not in ~/.claude.json or a project's .mcp.json (managed settings, --mcp-config, an IDE or a plugin?): run claude mcp get with its name and tell me how it could be turned off`,
      },
      mcpFailing: {
        titleOne: (name: string) => `MCP server ${name} keeps failing`,
        titleMany: (n: number) => `${n} MCP servers keep failing to connect or erroring`,
        detail: 'In this period these servers failed to connect, needed you to sign in, or most of their calls returned errors. A failing server is still tried at every start, and its tools are missing when a task needs them. Connection failures are recorded by recent Claude Code versions only.',
        failed: (a: number, b: number, err: string | null) => `failed to connect in ${a} of ${b} sessions${err ? ` (last error: ${err})` : ''}`,
        auth: (a: number) => `needed sign-in in ${a} ${plural(a, 'en', ['session', 'sessions'])}`,
        errors: (e: number, c: number) => `${e} of ${c} tool calls returned an error`,
        evidence: (name: string, facts: string) => `${name}: ${facts}`,
        authAction: (name: string) => `Sign in to the MCP server ${name} again`,
        authWhy: (facts: string, connector: boolean, name: string) => `${facts}. ${connector ? 'Reconnect it on claude.ai → Settings → Connectors, or ' : ''}run /mcp in Claude Code and choose Authenticate (or claude mcp login ${name} in a terminal); I have to do the sign-in myself — tell me what to click`,
        fixAction: (name: string) => `Find out why the MCP server ${name} fails`,
        fixWhy: (facts: string, name: string) => `${facts}. claude mcp get ${name} shows its status and the error; suggest a fix for the command, URL or credentials. If I no longer need it, tell me how to turn it off instead`,
        summary: (n: number) => `${n} MCP ${plural(n, 'en', ['server keeps', 'servers keep'])} failing to connect or returning errors.`,
      },
      mcpHeavy: {
        title: (server: string, n: number, max: number) => `MCP server ${server}: ${n} ${plural(n, 'en', ['result', 'results'])} over 20K tokens (up to ${N(max)})`,
        detail: (sum: number) => `Each oversized result lands in the context at once and is re-read on every following turn. ≈ ${N(sum)} tokens in this period; the estimate assumes ≈ 5K would have been enough per call.`,
        tipBrowser: 'Browser: take screenshots at a lower scale or zoom into a region, read the page with a filter (interactive elements) or get_page_text / find instead of the full tree, close tabs you do not need.',
        tipGithub: 'GitHub: narrower queries (per_page, filters, a path), a line range instead of whole files, the list of changed files before full diffs.',
        tipFigma: 'Figma: get_metadata first, then design context for specific node ids instead of whole pages; avoid full-page screenshots.',
        tipGeneric: (server: string) => `Ask ${server} for less: filters, limits, only the fields you need, pagination.`,
        action: (server: string, tools: string) => `Review how I call ${server} (${tools})`,
        why: (n: number, max: number, tip: string) => `${n} results over 20K tokens, up to ${N(max)}. ${tip} Suggest concrete call patterns; if a short line in a project CLAUDE.md would help, propose it, but do not add it unless I agree`,
        summary: (server: string, n: number) => `${n} results of the ${server} MCP server were over 20K tokens.`,
      },
      mcpProjects: {
        title: (name: string, used: number, loaded: number) => `MCP server ${name} loads in every project, used in ${used} of ${loaded}`,
        detail: (name: string, projects: string[]) => `It is configured for the user (~/.claude.json), so every session in every project loads its instructions and tools, but ${name} was used only in ${projects.join(', ')}. Configure it just for those projects (local scope, not committed) and remove it from the user scope.`,
        perSession: (per: number) => `≈ ${N(per)} tokens per session`,
        usedIn: (list: string) => `Used in: ${list}`,
        idle: (n: number, sessions: number) => `Loaded but unused in ${n} other ${plural(n, 'en', ['project', 'projects'])} (${sessions} ${plural(sessions, 'en', ['session', 'sessions'])} in the last 30 days)`,
        why: (per: number, used: string) => `≈ ${N(per)} tokens in every session of every project; used only in ${used}`,
        summary: (name: string) => `the MCP server ${name} is configured for the user, so it loads everywhere, but is used only in a few projects.`,
      },

      // ---------- Startup context (recommend-startup.ts) ----------
      fileKind: {
        user: 'your global CLAUDE.md',
        project: 'project CLAUDE.md',
        local: 'CLAUDE.local.md',
        rules: 'rules file',
        memory: 'auto-memory index',
      } as Record<string, string>,
      bigInstructions: {
        titleOne: (file: string, tok: number) => `${file} adds ~${N(tok)} tokens to every session`,
        titleMany: (n: number, min: number) => `${n} instruction files over ${N(min)} tokens each`,
        detail: (pct: number) => `These files load at the start of every session in their scope, and of the subagents that get CLAUDE.md. Compressing them and moving rarely needed parts into files read on demand usually cuts about ${pct}% — that is the estimate below.`,
        evidence: (file: string, kind: string, tok: number, sessions: number) => `${file} (${kind}): ≈ ${N(tok)} tokens, loaded in ${sessions} ${plural(sessions, 'en', ['session', 'sessions'])} in the last 30 days`,
        why: (kind: string, tok: number) => `${kind}, ≈ ${N(tok)} tokens loaded at every start`,
        summary: (n: number) => `${n} instruction ${plural(n, 'en', ['file is', 'files are'])} large and ${n === 1 ? 'loads' : 'load'} into every session.`,
      },
      bigMemory: {
        title: (tok: number) => `Auto-memory adds ~${N(tok)} tokens to every session`,
        detail: (pct: number) => `Claude Code loads the MEMORY.md index of a project's auto-memory at every start. Merging duplicates, keeping one short line per entry and archiving outdated memories usually cuts about ${pct}% — that is the estimate below.`,
        evidence: (file: string, tok: number, sessions: number) => `${file}: ≈ ${N(tok)} tokens, loaded in ${sessions} ${plural(sessions, 'en', ['session', 'sessions'])} in the last 30 days`,
        why: (tok: number) => `≈ ${N(tok)} tokens loaded at every start`,
        summary: (n: number) => `the auto-memory index of ${n} ${plural(n, 'en', ['project has', 'projects have'])} grown large.`,
      },
      hookEvent: {
        unnamed: 'unnamed',
        titleOne: (name: string, per: number) => `The ${name} hook adds ~${N(per)} tokens to every session`,
        titleMany: (n: number, per: number) => `${n} hooks add ~${N(per)} tokens to every session`,
        detail: 'These hooks come from your settings files, not from a plugin that Clorbit recognized, and the text they print is added to the context at the start of every session (and subagent). Plugin hooks are covered on the Skills & plugins tab.',
        evidence: (name: string, per: number, sessions: number) => `${name}: ≈ ${N(per)} tokens per session, in ${sessions} ${plural(sessions, 'en', ['session', 'sessions'])} in the last 30 days`,
        action: (name: string) => `Review the ${name} hook that adds context at startup`,
        why: (per: number, settingsFile: string) => `it adds ≈ ${N(per)} tokens to every session. Find it in ${settingsFile} or in a project's .claude/settings.json / settings.local.json, and suggest how to shorten its output or print it only when needed. If it belongs to a plugin, tell me which`,
        summary: (n: number) => `${n} ${plural(n, 'en', ['hook adds', 'hooks add'])} text to the context at the start of every session.`,
      },
      skillListing: {
        actionable: (per: number) => `Acting on the Skills & plugins recommendations would save ≈ ${N(per)} tokens of startup context per session`,
      },
      startupTotal: {
        subagents: (n: number, per: number, total: number) => `Subagents start with their own startup context: ${N(n)} in this period × ≈ ${N(per)} ≈ ${N(total)} tokens`,
        titleSubs: (n: number, total: number) => `Subagents paid the startup context ${N(n)} times: ≈ ${N(total)} tokens in this period`,
      },
    },
  };
}

export type InsightText = ReturnType<typeof en>;

function uk(): InsightText {
  const N = (n: number) => fmtNum(n, 'uk');
  const D = (ms: number) => fmtDuration(ms, 'uk');
  const times = (n: number) => `${n} ${plural(n, 'uk', ['раз', 'рази', 'разів'])}`;
  return {
    pct,
    unknownTool: 'невідомий інструмент',
    noPlugin: 'без плагіна',
    quote: (s: string) => `«${s}»`,
    toolFix: {
      Read: 'Читай великі файли частинами (параметри offset/limit) або спершу знайди потрібне місце через Grep — тоді в контекст потрапляє лише потрібний фрагмент.',
      Bash: 'Обмежуй вивід команд: `| head -n 50`, `| tail -n 50`, `--quiet`/`-q`, `grep` по ключових рядках; для логів тестів — лише невдалі тести.',
      Grep: 'Звужуй пошук: `glob`/`type`, `head_limit`, режим files_with_matches замість content.',
      WebFetch: 'Проси в запиті WebFetch конкретну відповідь, а не весь вміст сторінки.',
      Agent: 'Проси субагентів повертати стислий звіт (висновки, шляхи, короткі фрагменти), а не сирі дампи файлів.',
    },
    toolFixBrowser: 'Для браузера бери get_page_text або find замість повного read_page/скриншотів; закривай зайві вкладки — список вкладок теж іде в контекст.',
    toolFixMcp: (server) => `Звузь запити до MCP-сервера ${server}: фільтри, ліміти, лише потрібні поля.`,
    toolFixGeneric: 'Обмеж обсяг результату цього інструмента (фільтри, ліміти, стислий формат).',

    waits: {
      title: (total, longest) => `Ти тримав агентів у очікуванні ${D(total)} за період, найдовше — ${D(longest)}`,
      detail: (n, perm, input, where, date, capH) =>
        `За даними хуків сесії чекали на тебе ${times(n)}: ${[
          perm ? `дозволу на інструмент — ${times(perm.n)} (${D(perm.ms)})` : '',
          input ? `на відповідь — ${times(input.n)} (${D(input.ms)})` : '',
        ].filter(Boolean).join(', ')}. Найдовше очікування — ${where}, ${date}. Окреме очікування понад ${capH} год рахується як ${capH} год.`,
      toolLine: (tool, n, ms) => `${tool}: ${n} ${plural(n, 'uk', ['запит', 'запити', 'запитів'])} дозволу, разом ${D(ms)}`,
      inputLine: (n, ms) => `Очікування відповіді: ${times(n)}, разом ${D(ms)}`,
      fixPerm: (allow) => `Дозволь безпечні часті інструменти заздалегідь: "permissions": { "allow": [${allow}] } у .claude/settings.json проєкту (для Bash — лише конкретні команди). Довгі очікування відповіді — привід увімкнути сповіщення або давати агентам довші автономні задачі.`,
      fixInput: 'Довгі очікування відповіді — привід увімкнути сповіщення або давати агентам довші автономні задачі з чітким критерієм готовності.',
    },

    skillListing: {
      title: (per, perSub) => `Список скілів: ~${N(per)} токенів на сесію${perSub ? ` і ~${N(perSub)} на кожного субагента` : ''}`,
      detail: (perSub, total) => `Описи всіх доступних скілів вставляються на старті кожної сесії${perSub ? ' і кожного субагента' : ''}. Разом за період ≈ ${N(total)} токенів.`,
      evidence: (p, tok) => `${p}: ≈ ${N(tok)} токенів сумарно`,
      fix: 'Вимкни плагіни, скілами яких не користуєшся (enabledPlugins у ~/.claude/settings.json), прибери зайві скіли з ~/.claude/skills, а описи (description) власних скілів скороти до одного речення.',
    },

    startupTotal: {
      title: (perMain, perSub) => `Стартовий контекст: ~${N(perMain)} токенів на сесію${perSub ? `, ~${N(perSub)} на субагента` : ''}`,
      detail: (total) => `Ще до першого запиту в контекст потрапляють системний промпт, визначення інструментів, списки скілів і агентів, CLAUDE.md тощо. Разом за період ≈ ${N(total)} токенів (оцінка за довжиною тексту); далі вони щоходу читаються з кешу.`,
      evidence: (label, per, perSub) => `${label}: ≈ ${N(per)} на сесію${perSub ? `, ≈ ${N(perSub)} на субагента` : ''}`,
      fix: 'Найпростіше скоротити список скілів (вимкнути зайві плагіни, прибрати непотрібні скіли) і CLAUDE.md; дрібні задачі краще робити без окремого субагента — кожен субагент платить цей стартовий внесок заново.',
    },


    bigResults: {
      example: (label, tok, project) => `${label} — ${N(tok)} токенів (${project})`,
      title: (tool, n, max) => `${tool}: ${n} завеликих результатів (до ${N(max)} токенів)`,
      detail: (sum) => `Результати понад 20 тис. токенів одразу роздувають контекст і далі перечитуються щоходу. Разом ≈ ${N(sum)} токенів за період.`,
    },

    repeatedReads: {
      title: (n) => `Повторні читання: ${n} файлів читались ≥ 3 разів у межах сесії`,
      detail: (sessions, extra, avg) => `У ${sessions} сесіях ті самі файли перечитувались; це ≈ ${N(extra)} зайвих викликів Read (у середньому ${N(avg)} токенів кожен).`,
      fix: 'Після першого читання тримай потрібні фрагменти в нотатках/плані, а субагентам передавай шлях і конкретний діапазон рядків. Часто перечитувані довідкові файли варто скоротити або розбити.',
    },

    autoCompactions: {
      title: (total, sessions) => `${total} автокомпакцій у ${sessions} сесіях`,
      detail: 'Автокомпакція означає, що контекст дійшов до межі: частина подробиць губиться, а сама компакція коштує окремого великого ходу.',
      fix: (pctEnv) => `Розбивай великі задачі на етапи: після етапу — короткий підсумок у файл плану і /clear; дослідження та масові читання віддавай субагентам (Explore), щоб сирі результати не потрапляли в головний контекст.${pctEnv ? ` Поріг зараз: CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=${pctEnv}.` : ''}`,
    },

    skillShare: {
      title: (key, share, loads) => `Скіл ${key}: ${pct(share)} усіх токенів${loads ? `, ${loads} завантажень` : ''}`,
      detail: (key, total, sessions, perLoad) => `Ходи під атрибуцією скіла ${key} забрали ≈ ${N(total)} токенів у ${sessions} сесіях${perLoad !== null ? ` (≈ ${N(perLoad)} на одне завантаження)` : ''}. Це не обов'язково погано — але варто переконатися, що скіл не тягне зайвого.`,
      turns: (turns, sessions) => `Ходів: ${N(turns)}, сесій: ${sessions}`,
      tokens: (out, write) => `Вихідних токенів: ${N(out)}, запис у кеш: ${N(write)}`,
      fix: 'Перевір SKILL.md: довідкові розділи винеси в окремі файли, які скіл читає лише за потреби; уточни description, щоб скіл не спрацьовував там, де не потрібен.',
    },

    skillLoads: {
      title: 'Найчастіше завантажувані скіли',
      detail: 'Скільки разів викликали Skill і яку частку токенів дали ходи під цим скілом.',
      evidence: (key, loads, share) => `${key}: ${loads}× — ${pct(share)} токенів`,
    },

    lowCache: {
      title: (n, avg) => `${n} дн. з низькою часткою кешу (середня ${pct(avg)})`,
      detail: 'У ці дні значна частина контексту записувалась у кеш заново замість читання з нього. Запис у кеш дорожчий за читання і швидше з\'їдає ліміт.',
      evidence: (date, rate, write, input) => `${date}: кеш ${pct(rate)}, запис у кеш ${N(write)}, без кешу ${N(input)}`,
      fix: 'Кеш промпта живе обмежений час: після довгої паузи краще почати нову сесію з коротким підсумком, ніж продовжувати велику. Не перемикай модель/ефорт і не змінюй CLAUDE.md чи набір MCP посеред довгої сесії — це скидає кеш.',
    },

    hooks: {
      title: (plugin, n, min, err) => `Хуки ${plugin ? `плагіна ${plugin}` : 'без плагіна'}: ${N(n)} запусків, ${min} хв виконання${err !== null ? `, ${pct(err)} з помилкою чи stderr` : ''}`,
      detail: (names, min, err) => `Хуки (${names}) запускаються окремим процесом на кожну таку подію; сумарний час їх виконання ≈ ${min} хв.${err !== null ? ` ${pct(err)} запусків завершились з помилкою або писали в stderr.` : ''}`,
      runs: (n) => `Запусків: ${N(n)}`,
      time: (sec) => `Сумарний час: ${sec} с`,
      errors: (n) => `З помилкою/stderr: ${N(n)}`,
      fix: (plugin, key) => `Якщо плагін ${plugin} не потрібен у цьому середовищі — вимкни: "enabledPlugins": { "${key}": false } у ~/.claude/settings.json.`,
      fixNoPlugin: 'Перевір команди хуків у ~/.claude/settings.json: чи вони потрібні на кожну подію.',
    },

    rec: {
      lastUsed: (days) => (days === 0 ? 'востаннє використано сьогодні' : `востаннє використано ${days} ${plural(days, 'uk', ['день', 'дні', 'днів'])} тому`),
      never: (since) => (since ? `жодного разу не використано (у списку з ${since})` : 'жодного разу не використано'),
      perSession: (tok) => `≈ ${N(tok)} токенів контексту на сесію`,
      parts: (p) => [
        p.skills ? `описи скілів ${N(p.skills)}` : '',
        p.hook ? `хук SessionStart ${N(p.hook)}` : '',
        p.mcp ? `інструкції MCP ${N(p.mcp)}` : '',
      ].filter(Boolean).join(' + '),
      unusedPlugins: {
        titleOne: (name, last) => `Плагін ${name} увімкнено, але ${last}`,
        titleMany: (n, days) => `${n} ${plural(n, 'uk', ['увімкнений плагін не використовувався', 'увімкнені плагіни не використовувались', 'увімкнених плагінів не використовувались'])} ${days}+ дн.`,
        detail: (days) => `Жодного виклику скілів, MCP-інструментів чи атрибутованих ходів за всю збережену історію щонайменше ${days} дн. (з архівними сесіями). Проте вони й далі завантажуються в кожну нову сесію і кожного субагента, що отримує список скілів.`,
        evidence: (name, last, per, parts) => `${name}: ${last}; ≈ ${N(per)} токенів на сесію${parts ? ` (${parts})` : ''}`,
        why: (last, per) => `${last}; ≈ ${N(per)} токенів контексту на сесію`,
        summary: (n, days) => `${n} ${plural(n, 'uk', ['увімкнений плагін не використовувався', 'увімкнені плагіни не використовувались', 'увімкнених плагінів не використовувались'])} ${days}+ дн., але й далі додають стартовий контекст у кожну сесію.`,
      },
      hookContext: {
        title: (plugin, per) => `Плагін ${plugin} додає ~${N(per)} токенів у кожну сесію, навіть там, де він не потрібен`,
        detail: (plugin, used, total, projects) =>
          `Його хук SessionStart вставляє блок тексту на старті кожної сесії, а скіли чи інструменти ${plugin} знадобились у ${used} з ${total} таких сесій за період${projects.length ? ` (проєкти: ${projects.join(', ')})` : ''}. Вимкни його глобально й увімкни лише там, де він потрібен.`,
        sessions: (used, total) => `Використано в ${used} з ${total} сесій із блоком хука`,
        perSession: (per) => `Блок хука: ≈ ${N(per)} токенів на сесію`,
        why: (per, used, total) => `його хук SessionStart додає ≈ ${N(per)} токенів у кожну сесію, а використано його в ${used} з ${total} сесій`,
        whyEnable: (project) => `він потрібен у ${project}`,
        skillsUnused: (n, total, days) => `${n} з ${total} його скілів не використовувались ${days}+ дн.`,
        summary: (plugin, per) => `плагін ${plugin} через хук SessionStart вставляє ≈ ${N(per)} токенів у кожну сесію, але потрібен лише в кількох проєктах.`,
        fix: (plugin, key) => `Якщо ${plugin} потрібен не в кожному проєкті — вимкни його глобально (claude plugin disable ${key} --scope user) і увімкни там, де він потрібен (claude plugin enable ${key} --scope local у теці проєкту).`,
      },
      unusedSkills: {
        title: (plugin, n, total, days) => `Плагін ${plugin}: ${n} з ${total} скілів не використовувались ${days}+ дн.`,
        detail: (plugin, unusedTok, totalTok) =>
          `Їхні описи займають ≈ ${N(unusedTok)} з ≈ ${N(totalTok)} токенів списку скілів ${plugin} у кожній сесії. Скіли плагіна не вимикаються поодинці, тож вибір — увесь плагін: вимкни його, якщо обійдешся без скілів, якими ще користуєшся.`,
        stillUsed: (list) => `Ще використовуються: ${list}`,
        noneUsed: 'Жоден зі скілів у списку останнім часом не використовувався — лише хуки чи MCP-інструменти',
        mcpUsed: (last) => `Його MCP-інструменти: ${last}`,
        why: (n, total, used) => `${n} з ${total} його скілів давно не використовувались${used ? `; ще використовуються: ${used}` : ''}`,
        summary: (plugin, n, total, days) => `${n} з ${total} скілів плагіна ${plugin} не використовувались ${days}+ дн.`,
      },
      unusedOwn: {
        title: (n, days) => `${n} ${plural(n, 'uk', ['власний скіл не використовувався', 'власні скіли не використовувались', 'власних скілів не використовувались'])} ${days}+ дн.`,
        detail: (dir) => `Скіли з ${dir} потрапляють у список скілів кожної сесії та кожного субагента, що його отримує. Якщо перенести теку в сусідню теку «-disabled», скіл зникне зі списку, а повернути його буде просто.`,
        evidence: (name, last, per) => `${name}: ${last}; ≈ ${N(per)} токенів на сесію`,
        why: (last, per) => `${last}; ≈ ${N(per)} токенів контексту на сесію`,
        summary: (n, days) => `${n} ${plural(n, 'uk', ['мій власний скіл не використовувався', 'мої власні скіли не використовувались', 'моїх власних скілів не використовувались'])} ${days}+ дн.`,
      },
      duplicates: {
        title: (n) => `${n} ${plural(n, 'uk', ['назва скіла трапляється', 'назви скілів трапляються', 'назв скілів трапляються'])} у списку скілів більше одного разу`,
        detail: 'Та сама назва в кількох плагінах або власний скіл поруч зі скілом плагіна з тією ж назвою: обидва описи оплачуються в кожній сесії, і модель може обрати не той.',
        own: 'власний',
        copy: (label, last) => `${label} — ${last}`,
        evidence: (name, copies) => `${name}: ${copies}`,
        whyMove: (keep, keepLast) => `той самий скіл є і в ${keep} (${keepLast})`,
        reviewAction: (key, keep) => `Порівняти скіл ${key} з ${keep}`,
        whyReview: (plugin) => `скіл плагіна не вимикається окремо; скажи, чи є сенс вимкнути ${plugin} повністю і яку копію залишити`,
        summary: (n) => `${n} ${plural(n, 'uk', ['назва скіла трапляється', 'назви скілів трапляються', 'назв скілів трапляються'])} у списку більше одного разу.`,
      },

      mcpParts: (p) => [
        p.instr ? `інструкції ${N(p.instr)}` : '',
        p.defs ? `визначення інструментів ${N(p.defs)}` : '',
        p.names ? `назви інструментів ${N(p.names)}` : '',
      ].filter(Boolean).join(' + '),
      mcpSource: {
        user: (file) => `конфігурація користувача (${file})`,
        local: (dirs) => `локальна конфігурація ${dirs.join(', ')}`,
        project: (dirs) => `.mcp.json у ${dirs.join(', ')}`,
        plugin: (plugin) => `плагін ${plugin}`,
        claudeai: 'конектор claude.ai',
        unknown: 'налаштовано деінде',
      },
      unusedMcp: {
        titleOne: (name, last) => `MCP-сервер ${name} підключено, але ${last}`,
        titleMany: (n, days) => `${n} ${plural(n, 'uk', ['підключений MCP-сервер не використовувався', 'підключені MCP-сервери не використовувались', 'підключених MCP-серверів не використовувались'])} ${days}+ дн.`,
        detail: (days) => `Жодного виклику їхніх інструментів за всю збережену історію щонайменше ${days} дн. (з архівними сесіями), а кожна нова сесія і кожен субагент їх завантажує: інструкції та інструменти. З увімкненим пошуком інструментів на старті перелічено лише назви (схеми завантажуються, коли інструмент потрібен), тож економія — здебільшого інструкції й назви.`,
        evidence: (name, source, last, per, parts) => `${name} (${source}): ${last}; ≈ ${N(per)} токенів на сесію${parts ? ` (${parts})` : ''}`,
        noSize: 'розмір не виміряно (старіші транскрипти)',
        why: (last, per) => `${last}${per ? `; ≈ ${N(per)} токенів контексту на сесію` : ''}`,
        summary: (n, days) => `${n} ${plural(n, 'uk', ['підключений MCP-сервер не використовувався', 'підключені MCP-сервери не використовувались', 'підключених MCP-серверів не використовувались'])} ${days}+ дн., але й далі завантажуються в кожну сесію.`,
        alsoFailed: (n) => `ще й не зміг підключитися в ${n} ${plural(n, 'uk', ['сесії', 'сесіях', 'сесіях'])}`,
        pluginAction: (name, plugin) => `MCP-сервер ${name} іде разом із плагіном ${plugin}`,
        pluginUnusedWhy: (server, last) => `його MCP-сервер ${server} не використовується, як і плагін загалом: ${last}`,
        pluginWhy: (last, key) => `${last}. Сам плагін ще використовується, а його сервер окремо не вимикається: у проєкті, де він не потрібен, вимкни його в /mcp (лише для цього проєкту); або, якщо обійдешся без усього плагіна, вимкни плагін (claude plugin disable ${key} --scope user). Скажи, що обираєш`,
        connectorAction: (name) => `Відключити конектор claude.ai ${name}`,
        connectorWhy: (last) => `${last}. Claude Code цього за мене не зробить: відключи його на claude.ai → Settings → Connectors (тоді він зникне всюди) або вимкни для одного проєкту в /mcp`,
        connectorsAllWhy: (n, days) => `жоден з ${n} ${plural(n, 'uk', ['конектора', 'конекторів', 'конекторів'])} claude.ai, які завантажує Claude Code, не використовувався ${days}+ дн.`,
        unknownAction: (name) => `З'ясувати, де налаштовано MCP-сервер ${name}`,
        unknownWhy: (last) => `${last}. Його немає в ~/.claude.json чи .mcp.json проєкту (керовані налаштування, --mcp-config, IDE чи плагін?): виконай claude mcp get з його назвою і скажи, як його можна вимкнути`,
      },
      mcpFailing: {
        titleOne: (name) => `MCP-сервер ${name} постійно збоїть`,
        titleMany: (n) => `${n} ${plural(n, 'uk', ['MCP-сервер постійно не підключається', 'MCP-сервери постійно не підключаються', 'MCP-серверів постійно не підключаються'])} або повертають помилки`,
        detail: 'За період ці сервери не змогли підключитися, вимагали входу або більшість їхніх викликів закінчилась помилкою. Сервер, що збоїть, однаково пробують підключити на кожному старті, а його інструментів бракує саме тоді, коли вони потрібні. Збої підключення записують лише новіші версії Claude Code.',
        failed: (a, b, err) => `не підключився в ${a} з ${b} сесій${err ? ` (остання помилка: ${err})` : ''}`,
        auth: (a) => `вимагав входу в ${a} ${plural(a, 'uk', ['сесії', 'сесіях', 'сесіях'])}`,
        errors: (e, c) => `${e} з ${c} викликів інструментів завершились помилкою`,
        evidence: (name, facts) => `${name}: ${facts}`,
        authAction: (name) => `Знову увійти в MCP-сервер ${name}`,
        authWhy: (facts, connector, name) => `${facts}. ${connector ? 'Перепідключи його на claude.ai → Settings → Connectors або ' : ''}запусти /mcp у Claude Code і вибери Authenticate (або claude mcp login ${name} у терміналі); вхід мушу зробити я сам — підкажи, що натиснути`,
        fixAction: (name) => `З'ясувати, чому збоїть MCP-сервер ${name}`,
        fixWhy: (facts, name) => `${facts}. claude mcp get ${name} покаже його стан і помилку; запропонуй виправлення команди, URL чи облікових даних. Якщо він мені вже не потрібен — скажи, як його вимкнути`,
        summary: (n) => `${n} ${plural(n, 'uk', ['MCP-сервер постійно не підключається', 'MCP-сервери постійно не підключаються', 'MCP-серверів постійно не підключаються'])} або повертають помилки.`,
      },
      mcpHeavy: {
        title: (server, n, max) => `MCP-сервер ${server}: ${n} ${plural(n, 'uk', ['результат', 'результати', 'результатів'])} понад 20 тис. токенів (до ${N(max)})`,
        detail: (sum) => `Кожен завеликий результат одразу потрапляє в контекст і далі перечитується щоходу. ≈ ${N(sum)} токенів за період; оцінка виходить з того, що ≈ 5 тис. на виклик вистачило б.`,
        tipBrowser: 'Браузер: роби скриншоти з меншим масштабом або наближенням до ділянки, читай сторінку з фільтром (інтерактивні елементи) або через get_page_text / find замість повного дерева, закривай зайві вкладки.',
        tipGithub: 'GitHub: вужчі запити (per_page, фільтри, шлях), діапазон рядків замість цілих файлів, спершу список змінених файлів, потім повні дифи.',
        tipFigma: 'Figma: спершу get_metadata, потім контекст дизайну для конкретних id вузлів замість цілих сторінок; уникай скриншотів усієї сторінки.',
        tipGeneric: (server) => `Проси в ${server} менше: фільтри, ліміти, лише потрібні поля, пагінація.`,
        action: (server, tools) => `Переглянути, як я викликаю ${server} (${tools})`,
        why: (n, max, tip) => `${n} результатів понад 20 тис. токенів, до ${N(max)}. ${tip} Запропонуй конкретні способи викликів; якщо допоможе короткий рядок у CLAUDE.md проєкту — запропонуй його, але не додавай без моєї згоди`,
        summary: (server, n) => `${n} результатів MCP-сервера ${server} були понад 20 тис. токенів.`,
      },
      mcpProjects: {
        title: (name, used, loaded) => `MCP-сервер ${name} завантажується в кожному проєкті, а потрібен у ${used} з ${loaded}`,
        detail: (name, projects) => `Його налаштовано для користувача (~/.claude.json), тож кожна сесія в кожному проєкті завантажує його інструкції та інструменти, а ${name} використовувався лише в ${projects.join(', ')}. Налаштуй його тільки для цих проєктів (локально, без коміту) і прибери з рівня користувача.`,
        perSession: (per) => `≈ ${N(per)} токенів на сесію`,
        usedIn: (list) => `Використовується в: ${list}`,
        idle: (n, sessions) => `Завантажується без потреби ще в ${n} ${plural(n, 'uk', ['проєкті', 'проєктах', 'проєктах'])} (${sessions} ${plural(sessions, 'uk', ['сесія', 'сесії', 'сесій'])} за останні 30 днів)`,
        why: (per, used) => `≈ ${N(per)} токенів у кожній сесії кожного проєкту; використовується лише в ${used}`,
        summary: (name) => `MCP-сервер ${name} налаштовано для користувача, тож він завантажується всюди, а потрібен лише в кількох проєктах.`,
      },

      fileKind: {
        user: 'твій глобальний CLAUDE.md',
        project: 'CLAUDE.md проєкту',
        local: 'CLAUDE.local.md',
        rules: 'файл правил',
        memory: 'індекс автопам\'яті',
      },
      bigInstructions: {
        titleOne: (file, tok) => `${file} додає ~${N(tok)} токенів у кожну сесію`,
        titleMany: (n, min) => `${n} ${plural(n, 'uk', ['файл інструкцій', 'файли інструкцій', 'файлів інструкцій'])} понад ${N(min)} токенів кожен`,
        detail: (pct) => `Ці файли завантажуються на старті кожної сесії у своїй області дії, а також субагентів, що отримують CLAUDE.md. Якщо їх стиснути, а рідко потрібне винести в окремі файли, які читаються за потреби, зазвичай виходить мінус ${pct}% — це й оцінка нижче.`,
        evidence: (file, kind, tok, sessions) => `${file} (${kind}): ≈ ${N(tok)} токенів, завантажувався в ${sessions} ${plural(sessions, 'uk', ['сесії', 'сесіях', 'сесіях'])} за останні 30 днів`,
        why: (kind, tok) => `${kind}, ≈ ${N(tok)} токенів на кожному старті`,
        summary: (n) => `${n} ${plural(n, 'uk', ['файл інструкцій завеликий', 'файли інструкцій завеликі', 'файлів інструкцій завеликі'])} і ${n === 1 ? 'завантажується' : 'завантажуються'} в кожну сесію.`,
      },
      bigMemory: {
        title: (tok) => `Автопам'ять додає ~${N(tok)} токенів у кожну сесію`,
        detail: (pct) => `Claude Code завантажує індекс MEMORY.md автопам'яті проєкту на кожному старті. Якщо об'єднати дублікати, лишити по одному короткому рядку на запис і перенести застаріле в архів, зазвичай виходить мінус ${pct}% — це й оцінка нижче.`,
        evidence: (file, tok, sessions) => `${file}: ≈ ${N(tok)} токенів, завантажувався в ${sessions} ${plural(sessions, 'uk', ['сесії', 'сесіях', 'сесіях'])} за останні 30 днів`,
        why: (tok) => `≈ ${N(tok)} токенів на кожному старті`,
        summary: (n) => `індекс автопам'яті ${n} ${plural(n, 'uk', ['проєкту', 'проєктів', 'проєктів'])} розрісся.`,
      },
      hookEvent: {
        unnamed: 'без назви',
        titleOne: (name, per) => `Хук ${name} додає ~${N(per)} токенів у кожну сесію`,
        titleMany: (n, per) => `${n} ${plural(n, 'uk', ['хук додає', 'хуки додають', 'хуків додають'])} ~${N(per)} токенів у кожну сесію`,
        detail: 'Ці хуки походять з твоїх файлів налаштувань, а не з плагіна, який Clorbit розпізнав, і текст, який вони друкують, додається в контекст на старті кожної сесії (і субагента). Хуки плагінів — на вкладці «Скіли й плагіни».',
        evidence: (name, per, sessions) => `${name}: ≈ ${N(per)} токенів на сесію, у ${sessions} ${plural(sessions, 'uk', ['сесії', 'сесіях', 'сесіях'])} за останні 30 днів`,
        action: (name) => `Переглянути хук ${name}, що додає контекст на старті`,
        why: (per, settingsFile) => `він додає ≈ ${N(per)} токенів у кожну сесію. Знайди його в ${settingsFile} або в .claude/settings.json / settings.local.json проєкту й запропонуй, як скоротити його вивід або друкувати його лише за потреби. Якщо він належить плагіну — скажи якому`,
        summary: (n) => `${n} ${plural(n, 'uk', ['хук додає', 'хуки додають', 'хуків додають'])} текст у контекст на старті кожної сесії.`,
      },
      skillListing: {
        actionable: (per) => `Рекомендації на вкладці «Скіли й плагіни» заощадили б ≈ ${N(per)} токенів стартового контексту на сесію`,
      },
      startupTotal: {
        subagents: (n, per, total) => `Субагенти стартують зі своїм стартовим контекстом: ${N(n)} за період × ≈ ${N(per)} ≈ ${N(total)} токенів`,
        titleSubs: (n, total) => `Субагенти сплатили стартовий контекст ${N(n)} разів: ≈ ${N(total)} токенів за період`,
      },
    },
  };
}

const cache: Partial<Record<Lang, InsightText>> = {};
export function insightText(lang: Lang): InsightText {
  return (cache[lang] ??= lang === 'uk' ? uk() : en());
}
