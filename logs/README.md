# Logs

Build and release output, kept out of git except for this file.

- `publish-<version>.log` - full `make publish` output for that release: version bump, `python -m build`, `npm publish`, `twine upload`, and the post-publish commit
- `galata-<time>.log` - one `jlpm playwright test` run of the ui-tests suite, with the test server's own output interleaved
- `unit-<time>.log` - one `jlpm test` run: prettier, eslint, stylelint and jest
- `devbuild-<time>.log` - one `jlpm build` of the development labextension
- `mutation-<name>-<time>.log` - a deliberate break of one rule, built and installed before the test runs, to show which test catches it
- `fresh-clone-build.log` - `make build` in a clone with no toolchain, to show `check_dependencies` installs what is missing
- `lint-<time>.log` - one `jlpm lint:check` run: prettier, eslint and stylelint without fixes
- `uitests-install-<time>.log` - `jlpm install` and `jlpm playwright install chromium` in `ui-tests/`
- `probe-<name>-<time>.log` - a throwaway Galata spec that records what the running lab does, deleted after the run
