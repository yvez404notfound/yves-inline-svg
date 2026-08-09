# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Contributor workflow and codebase ownership are documented in `CONTRIBUTING.md`; check it before changing package behavior, sanitizer rules, or tests.
- Use root scripts from `package.json` for package validation (`npm run build`, `npm run test`, `npm run typecheck`, `npm run lint`); sanitizer/bundle changes should also run `npm run bundle:size`. There is no in-repository playground in the current package shape.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
