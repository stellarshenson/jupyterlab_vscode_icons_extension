# Defects - jupyterlab_vscode_icons_extension

Defects in the extension frontend and in its build and release tooling.

## Authors

- `@kj` Konrad Jelen

## Build and release tooling `BUILD`

The shared Makefile template, the lockfiles and the release path

- [ ] `DEF-BUILD-1` **jlpm test dirties the tree** - MEDIUM; `jlpm test` rewrites the tracked `junit.xml` on every run, so running tests leaves the tree dirty for a release that must end clean; `uv.lock` is tracked the same way; fix: untrack both and gitignore them
  - related: ACC-BUILD-26 - the clean-tree criterion this breaks
  - repro: jlpm test, then git status --porcelain
  - test-tags: MANUAL
  - log: 2026-10-13T21:25:38Z @kj added
- [ ] `DEF-BUILD-2` **package-lock.json tracked but unmaintained** - MINOR; `package-lock.json` is tracked yet no target regenerates it and the publish target stages only package.json and yarn.lock, so it drifts silently; cause: template 1.41 dropped `npm install` from build and dropped the file from the staged list; fix: untrack it, or restore a step that writes it
  - related: ACC-BUILD-21 - the version agreement this could undermine
  - repro: compare git log -1 on package-lock.json against the last release commit
  - test-tags: MANUAL
  - log: 2026-10-13T21:25:38Z @kj added
- [ ] `DEF-BUILD-6` **CONTRIBUTING.md never mentions the Makefile** - MINOR; CONTRIBUTING.md:17 documents a .venv plus `pip install --editable` dev path that never names the Makefile, and :11 invites `npm ci` against the unmaintained package-lock.json; cause: template text taken verbatim at v4.6.5; fix: one orienting line at the top of `## Development install`
  - repro: read CONTRIBUTING.md ## Development install against the Makefile targets
  - test-tags: MANUAL
  - log: 2026-10-13T22:32:44Z @kj added
- [ ] `DEF-BUILD-7` **prettier is not verified anywhere** - MINOR; `jlpm test` runs eslint and stylelint but not `prettier:check`, so only three of four lint gates run before a release; `make build` applies formatting instead of verifying it; fix: add the gate call plus two .prettierignore entries for the pm registers in one commit
  - related: ACC-BUILD-23 - the gate criterion this leaves three quarters closed
  - repro: PATH=$PWD/.nodeenv/bin:$PATH jlpm prettier:check
  - test-tags: MANUAL
  - log: 2026-10-13T22:32:44Z @kj added
- [ ] `DEF-BUILD-8` **update-snapshots-checkout@v1 tag unconfirmed** - MINOR; update-integration-tests.yml pins `update-snapshots-checkout@v1` on local evidence only - the v4.6.5 sibling ships that exact reference - with no network to confirm the tag resolves; if it does not, the comment-triggered snapshot job errors at start; fix: confirm the tag online
  - repro: comment please update snapshots on a pull request and watch the job start
  - test-tags: MANUAL
  - log: 2026-10-13T22:32:44Z @kj added

## Test suite `TEST`

Jest, the Playwright ui-tests and their output

- [ ] `DEF-TEST-3` **jest haste module naming collision** - MINOR; `jlpm test` prints `jest-haste-map: Haste module naming collision: jupyterlab_vscode_icons_extension` for the root package.json against jupyterlab_vscode_icons_extension/labextension/package.json; cause: the built labextension output sits inside the jest roots; fix: add that directory to modulePathIgnorePatterns
  - repro: run jlpm test after a build has populated the labextension directory
  - test-tags: MANUAL
  - log: 2026-10-13T21:25:38Z @kj added

## Lint and static analysis `LINT`

Warnings and errors from eslint, stylelint and prettier

- [ ] `DEF-LINT-4` **prefer-lazy-imports warning on the icons import** - MINOR; lint:check warns `'./icons' is imported at the top of a plugin module and used in activate()`; cause: @jupyter/eslint-plugin rules arrived with template v4.6.5, never addressed; fix: import it in the callback that needs it, or disable the rule there; `src/index.ts:9`
  - related: ACC-BUILD-23 - the lint gate these warnings sit in
  - repro: PATH=$PWD/.nodeenv/bin:$PATH jlpm run lint:check
  - test-tags: MANUAL
  - log: 2026-10-13T21:25:51Z @kj added
- [ ] `DEF-LINT-5` **no-pageconfig-base-url warning** - MINOR; lint:check warns `PageConfig.getBaseUrl() should not be called outside of makeSettings()`; cause: the same new plugin rules; fix: hold a ServerConnection.ISettings and read .baseUrl from it, or disable the rule there; `src/index.ts:1002`
  - repro: PATH=$PWD/.nodeenv/bin:$PATH jlpm run lint:check
  - test-tags: MANUAL
  - log: 2026-10-13T21:25:51Z @kj added

