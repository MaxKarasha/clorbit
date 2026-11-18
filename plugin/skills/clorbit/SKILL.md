---
name: clorbit
description: Open the Clorbit dashboard, start, stop or check the local Clorbit server, or connect subscription limits to your status line
argument-hint: "[open|start|stop|status|statusline [--apply] [--remove] [--create]]"
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/app/cli.mjs" *)
disable-model-invocation: true
---

Output of the Clorbit CLI (`clorbit $ARGUMENTS`, default `open`):

!`node "${CLAUDE_PLUGIN_ROOT}/app/cli.mjs" $ARGUMENTS --slash`

If the output starts with "Settings:" (the `statusline` command): show it to the user as it is, in a code block, without shortening the Before/After commands. If it was a dry run, end with the exact apply command it prints and say that nothing was written. Never run that command or any other command yourself, and never add `--apply`: settings.json changes only when the user types `/clorbit statusline --apply` themselves.

Otherwise, relay this to the user in one to three short lines: whether Clorbit is running and its URL as a link. Only if the output reports a problem, name it and the fix it suggests. Do not run other commands or add anything else.
