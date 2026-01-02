# Gotchas & Pitfalls

Things to watch out for in this codebase.

## [2026-01-01 17:50]
npm, npx, and tsc commands are blocked by a callback hook in this environment. TypeScript build verification must be done through manual code review or an external process.

_Context: Subtask 1-1 verification - attempting to run npm run build_
