"""Run the actual publish recipe with local stand-ins for every external command."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).parents[2]


class PublishContractTests(unittest.TestCase):
    def simulate_publish(self, pypi_status):
        version = json.loads((ROOT / "package.json").read_text())["version"]
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            binaries = root / ".nodeenv" / "bin"
            binaries.mkdir(parents=True)
            command_log = root / "commands"
            scripts = {
                "node": f"#!/bin/sh\necho '{version}'\n",
                "git": '#!/bin/sh\nprintf "git:%s\\n" "$*" >> "$COMMAND_LOG"\n',
                "npm": '#!/bin/sh\n[ "$1" = publish ] || exit 99\nprintf "npm:%s\\n" "$*" >> "$COMMAND_LOG"\n',
                "python": '#!/bin/sh\n[ "$1 $2 $3" = "-m twine upload" ] || exit 99\nprintf "pypi:%s\\n" "$*" >> "$COMMAND_LOG"\nexit "$PYPI_STATUS"\n',
            }
            for name, script in scripts.items():
                path = binaries / name
                path.write_text(script)
                path.chmod(0o755)
            dist = root / "dist"
            dist.mkdir()
            for suffix in ("-py3-none-any.whl", ".tar.gz"):
                (dist / f"jupyterlab_vscode_icons_extension-{version}{suffix}").touch()
            # Preserve publish's real recipe and dependency graph. All preceding
            # stages become no-ops; every git/registry executable above is local.
            source = (ROOT / "Makefile").read_text() + "\n"
            for target in ("check_dependencies", "install_dependencies", "uninstall", "clean", "test", "increment_version", "build", "install"):
                source += f"{target}:\n\t@true\n"
            environment = dict(os.environ, COMMAND_LOG=str(command_log), PYPI_STATUS=str(pypi_status))
            result = subprocess.run(
                ["make", "--no-print-directory", "-f", "-", "publish"],
                input=source, cwd=root, env=environment, text=True,
                capture_output=True, timeout=10,
            )
            return result, command_log.read_text().splitlines(), version

    def test_success_uploads_one_version_to_both_registries(self):
        result, commands, version = self.simulate_publish(0)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(sum(line.startswith("npm:") for line in commands), 1)
        uploads = [line for line in commands if line.startswith("pypi:")]
        self.assertEqual(len(uploads), 1)
        self.assertIn(f"-{version}-py3-none-any.whl", uploads[0])
        self.assertIn(f"-{version}.tar.gz", uploads[0])
        self.assertNotIn("PyPI does not", result.stdout + result.stderr)

    def test_partial_publication_fails_and_prints_recovery(self):
        result, commands, version = self.simulate_publish(1)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(sum(line.startswith("npm:") for line in commands), 1)
        self.assertEqual(sum(line.startswith("pypi:") for line in commands), 1)
        self.assertIn(f"npm holds {version} and PyPI does not", result.stderr)
        self.assertIn("python -m twine upload dist/*", result.stderr)
        self.assertIn("Do NOT re-run publish", result.stderr)
