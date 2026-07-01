# Preview Workflow

Use this workflow for local preview server startup, restart, health checks, and developer-facing verification.

## Goal

Make it easy to get from source changes to a working local URL with minimal confusion.

## Process

1. Detect the project's preview command from repository context.
2. Check whether a preview server is already running.
3. Start, stop, restart, or verify the server as requested.
4. Resolve port conflicts explicitly instead of guessing.
5. Report the local URL and basic health status.

## Typical Tasks

- start preview
- restart after config changes
- confirm current local URL
- check that the changed route renders

## Output Shape

- command used
- port
- local URL
- health status or failure reason
