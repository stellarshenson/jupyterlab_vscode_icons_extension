"""Exercise the real Make dependency graph without build or upload commands."""
from pathlib import Path
import subprocess
import tempfile
import unittest


MAKEFILE = Path(__file__).parents[2] / "Makefile"


class MakeOrderTests(unittest.TestCase):
    def run_make(self, target, jobs, failing=None):
        recipes = {
            "check_dependencies": "@true",
            "install_dependencies": "@true",
            "uninstall": "@true",
            "clean": "@true",
            "test": "@sleep 0.1; echo TEST",
            "increment_version": "@sleep 0.1; echo VERSION",
            "build": "@echo BUILD",
            "install": "@echo INSTALL",
            "publish": "@echo UPLOAD",
        }
        if failing:
            recipes[failing] += "; exit 1"
        source = MAKEFILE.read_text() + "\n" + "\n".join(
            f"{name}:\n\t{recipe}\n" for name, recipe in recipes.items()
        )
        with tempfile.TemporaryDirectory() as directory:
            return subprocess.run(
                ["make", "--no-print-directory", "-f", "-", f"-j{jobs}", target], input=source,
                cwd=directory, text=True, capture_output=True, timeout=10,
            )

    def test_failed_tests_prevent_version_change_build_install_and_upload(self):
        for jobs in (1, 4):
            with self.subTest(jobs=jobs):
                result = self.run_make("publish", jobs, failing="test")
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(result.stdout.split(), ["TEST"])

    def test_install_orders_one_version_change_before_build(self):
        for jobs in (1, 4):
            with self.subTest(jobs=jobs):
                result = self.run_make("install", jobs)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(result.stdout.split(), ["VERSION", "BUILD", "INSTALL"])

    def test_successful_publish_runs_every_stage_once_in_order(self):
        result = self.run_make("publish", 4)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.split(), ["TEST", "VERSION", "BUILD", "INSTALL", "UPLOAD"])

    def test_failed_build_prevents_install_and_upload(self):
        result = self.run_make("publish", 4, failing="build")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout.split(), ["TEST", "VERSION", "BUILD"])
