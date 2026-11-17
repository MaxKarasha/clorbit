---
name: clorbit
description: Open the Clorbit dashboard, or start, stop or check the local Clorbit server
argument-hint: "[open|start|stop|status]"
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/app/cli.mjs" *)
disable-model-invocation: true
---

Output of the Clorbit CLI (`clorbit $ARGUMENTS`, default `open`):

!`node "${CLAUDE_PLUGIN_ROOT}/app/cli.mjs" $ARGUMENTS --slash`

Relay this to the user in one to three short lines: whether Clorbit is running and its URL as a link. Only if the output reports a problem, name it and the fix it suggests. Do not run other commands or add anything else.
