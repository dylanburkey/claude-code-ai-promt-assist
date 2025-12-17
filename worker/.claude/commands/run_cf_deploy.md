Deploy the Claude Prompt Helper to Cloudflare Workers.

Execute these commands in order from the worker directory:

1. Apply D1 database migrations:
   ```
   cd /Users/dylanburkey/dev/claude-prompt-helper/worker && wrangler d1 migrations apply prompt-workstation-db --remote
   ```

2. Deploy the Worker:
   ```
   cd /Users/dylanburkey/dev/claude-prompt-helper/worker && wrangler deploy
   ```

Report the results of each command.
