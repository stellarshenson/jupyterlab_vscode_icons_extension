# Makefile for Jupyterlab extensions version 1.37
# changelog:
#   1.37 - pin the global install prefix to the nodeenv when installing yarn + rimraf.
#          `npm install -g` honours a user-level `prefix=` in ~/.npmrc even when run
#          from the nodeenv's own npm, so on any machine that sets one the binaries
#          landed in that prefix instead of $(NODEENV)/bin. check_dependencies tests
#          for $(NODEENV)/bin/yarn, which then never became true, so every make
#          invocation re-ran install_dependencies and reinstalled yarn - it never
#          reported "All dependencies are installed". Passing --prefix explicitly
#          overrides the config for that one command and leaves ~/.npmrc untouched.
#   1.36 - `test` runs the Python suite too, not just jlpm. It ran `jlpm test` alone,
#          so on any extension with a server side a Python regression passed local
#          verification and only failed in CI. pytest now runs whenever the package
#          has a tests/ directory, and is skipped with a message when it does not,
#          so frontend-only extensions are unaffected. No --cov: coverage is a CI
#          concern, and requiring pytest-cov would make `make test` fail on an
#          otherwise working dev env. Also corrects the author address to the
#          +github alias used everywhere else.
#   1.35 - resolve node and npm exclusively from the project-local nodeenv via $(NODE)
#          and $(NPM) instead of bare names, and read VERSION lazily at recipe time
#          rather than at parse time. VERSION := $(shell command -v node ...) was
#          evaluated before any target ran, so on a fresh clone (no .nodeenv yet) it
#          fell back to 0.0.0, increment_version's sed matched nothing, and the build
#          published the already-published version while printing a successful bump.
#          It only appeared to work where an ambient node happened to be on PATH.
#          increment_version now depends on check_dependencies and fails loudly when
#          the version cannot be read or does not actually change.
#   1.34 - build formats the lockfiles with `jlpm prettier` (the project's pinned
#          toolchain) instead of `npx prettier`, which fails with "prettier: Permission
#          denied" against a yarn-berry node_modules where the .cjs lacks the exec bit
#   1.33 - check_dependencies now also treats a missing/empty node_modules as a missing
#          dependency, and install_dependencies runs `jlpm install` to populate it, so
#          `make install`/`test` self-heal a fresh env without needing a full build first
#   1.32 - use a project-local nodeenv at .nodeenv/ instead of overwriting the python
#          prefix via `nodeenv -p` (which used to fail with "Text file busy" when the
#          existing node binary was held open). PATH=.nodeenv/bin:$PATH is exported so
#          every target transparently picks up the pinned local node + npm + yarn.
#          install_dependencies now guards each install step - only what's missing
#          gets installed. mrproper removes .nodeenv too.
#   1.31 - mrproper now removes ui-tests/node_modules (Playwright browser binaries)
#   1.30 - check twine in check_dependencies, ensure publish doesn't fail on missing twine
#   1.29 - replace yarn with jlpm, add prettier format, auto-commit and push after publish
#   1.28 - initial versioned Makefile
# author: Stellars Henson <konrad.jelen+github@gmail.com>
# License: MIT Open Source License

.PHONY: build install clean uninstall publish dependencies mrproper increment_version install_dependencies check_dependencies upgrade help test
.DEFAULT_GOAL := help

# Project-local node environment - keeps node/npm/yarn pinned per project and out of
# the python prefix. Created by `install_dependencies` and torn down by `mrproper`.
NODEENV := $(CURDIR)/.nodeenv
NODE := $(NODEENV)/bin/node
NPM := $(NODEENV)/bin/npm
export PATH := $(NODEENV)/bin:$(PATH)

# Read the current version from package.json using the project-local node only.
# Deliberately lazy (`=`, not `:=`): a parse-time read happens before check_dependencies
# has created the nodeenv, and an ambient node on PATH would silently mask that.
VERSION = $(shell $(NODE) -p "require('./package.json').version" 2>/dev/null)

# Python package name, taken from the labextension output dir. Lazy for the same
# reason as VERSION: $(NODE) does not exist until check_dependencies has run.
PYTHON_NAME = $(shell $(NODE) -p "require('./package.json').jupyterlab.outputDir.split('/')[0]" 2>/dev/null)

## increment project version
increment_version: check_dependencies
	@CURRENT_VERSION="$(VERSION)"; \
	if [ -z "$$CURRENT_VERSION" ]; then \
		echo "increment_version: cannot read version from package.json via $(NODE)" >&2; \
		exit 1; \
	fi; \
	echo "Current version: $$CURRENT_VERSION"; \
	NEW_VERSION="$${CURRENT_VERSION%.*}.$$(( $${CURRENT_VERSION##*.} + 1 ))"; \
	sed -i "s/\"version\": \"$$CURRENT_VERSION\"/\"version\": \"$$NEW_VERSION\"/" package.json; \
	if ! grep -q "\"version\": \"$$NEW_VERSION\"" package.json; then \
		echo "increment_version: package.json still reports $$CURRENT_VERSION - not bumped" >&2; \
		exit 1; \
	fi; \
	echo "New version: $$NEW_VERSION"

## build packages
build: clean check_dependencies increment_version
	$(NPM) install
	jlpm install
	jlpm prettier
	python -m build

## install package
install: build
	pip install dist/*.whl --force-reinstall

## run tests
test: check_dependencies
	jlpm test
	@if [ -d "$(PYTHON_NAME)/tests" ]; then \
		pytest -vv -r ap; \
	else \
		echo "test: no $(PYTHON_NAME)/tests directory - skipping pytest"; \
	fi

## clean builds and installables
clean: uninstall  check_dependencies
	@[ -x "$(NPM)" ] && $(NPM) run clean || true
	@[ -x "$(NPM)" ] && $(NPM) run clean:labextension || true
	rm -rf dist lib || true

## uninstall package
uninstall:  check_dependencies
	pip uninstall -y dist/*.whl 2>/dev/null || true

## check if required dependencies are installed in the project-local nodeenv
check_dependencies:
	@echo "Checking dependencies..."
	@MISSING=""; \
	[ -x "$(NODEENV)/bin/node" ] || MISSING="$$MISSING node"; \
	[ -x "$(NODEENV)/bin/npm" ] || MISSING="$$MISSING npm"; \
	[ -x "$(NODEENV)/bin/yarn" ] || MISSING="$$MISSING yarn"; \
	python -m twine --version >/dev/null 2>&1 || MISSING="$$MISSING twine"; \
	{ [ -d node_modules ] && [ -n "$$(ls -A node_modules 2>/dev/null)" ]; } || MISSING="$$MISSING node_modules"; \
	if [ -n "$$MISSING" ]; then \
		echo "Missing dependencies:$$MISSING"; \
		echo "Installing missing dependencies..."; \
		$(MAKE) install_dependencies; \
	else \
		echo "All dependencies are installed."; \
	fi

## publish package to public repository
publish: check_dependencies install
	$(NPM) publish --access public
	python -m twine upload dist/*
	git add package.json package-lock.json
	git commit -m "chore: post-publish $$($(NODE) -p "require('./package.json').version") package metadata"
	git push

## install required build dependencies into the project-local nodeenv (only what's missing)
install_dependencies:
	@if ! python -m twine --version >/dev/null 2>&1; then \
		echo "Installing twine..."; \
		pip install twine; \
	fi
	@if [ ! -x "$(NODEENV)/bin/node" ] || [ ! -x "$(NODEENV)/bin/npm" ]; then \
		echo "Creating project-local node environment at $(NODEENV)..."; \
		python -c "import nodeenv" >/dev/null 2>&1 || pip install nodeenv; \
		nodeenv --node=lts --prebuilt "$(NODEENV)"; \
	fi
	@if [ ! -x "$(NODEENV)/bin/yarn" ]; then \
		echo "Installing yarn + rimraf into $(NODEENV)..."; \
		"$(NODEENV)/bin/npm" install -g --prefix "$(NODEENV)" yarn rimraf; \
	fi
	@if [ ! -d node_modules ] || [ -z "$$(ls -A node_modules 2>/dev/null)" ]; then \
		echo "Installing project node_modules (jlpm install)..."; \
		jlpm install; \
	fi
	@echo "node:  $$($(NODEENV)/bin/node --version 2>/dev/null) ($(NODEENV)/bin/node)"
	@echo "npm:   $$($(NODEENV)/bin/npm --version 2>/dev/null)"
	@echo "yarn:  $$($(NODEENV)/bin/yarn --version 2>/dev/null)"

## upgrade all npm and yarn dependencies
upgrade: check_dependencies
	jlpm up

## cleanup all build and metabuild artefacts (including the project-local nodeenv)
mrproper: clean uninstall
	rm -rf node_modules .yarn ui-tests/node_modules .nodeenv || true

## prints the list of available commands
help:
	@echo ""
	@echo "$$(tput bold)Available rules:$$(tput sgr0)"
	@sed -n -e "/^## / { \
		h; \
		s/.*//; \
		:doc" \
		-e "H; \
		n; \
		s/^## //; \
		t doc" \
		-e "s/:.*//; \
		G; \
		s/\\n## /---/; \
		s/\\n/ /g; \
		p; \
	}" ${MAKEFILE_LIST} \
	| LC_ALL='C' sort --ignore-case \
	| awk -F '---' \
		-v ncol=$$(tput cols) \
		-v indent=19 \
		-v col_on="$$(tput setaf 6)" \
		-v col_off="$$(tput sgr0)" \
	'{ \
		printf "%s%*s%s ", col_on, -indent, $$1, col_off; \
		n = split($$2, words, " "); \
		line_length = ncol - indent; \
		for (i = 1; i <= n; i++) { \
			line_length -= length(words[i]) + 1; \
			if (line_length <= 0) { \
				line_length = ncol - indent - length(words[i]) - 1; \
				printf "\n%*s ", -indent, " "; \
			} \
			printf "%s ", words[i]; \
		} \
		printf "\n"; \
	}' 
	@echo ""


# EOF

