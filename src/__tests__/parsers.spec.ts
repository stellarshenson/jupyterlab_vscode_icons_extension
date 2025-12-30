/**
 * Tests for Python package configuration file parsers
 */

import { parsePyprojectToml, parseSetupPy } from '../parsers';

describe('parsePyprojectToml', () => {
  describe('project name parsing', () => {
    it('should parse project name with double quotes', () => {
      const content = `
[project]
name = "my-package"
version = "1.0.0"
`;
      const result = parsePyprojectToml(content);
      expect(result.has('my-package')).toBe(true);
      expect(result.has('my_package')).toBe(true);
    });

    it('should parse project name with single quotes', () => {
      const content = `
[project]
name = 'my-package'
version = '1.0.0'
`;
      const result = parsePyprojectToml(content);
      expect(result.has('my-package')).toBe(true);
      expect(result.has('my_package')).toBe(true);
    });

    it('should handle name without hyphens', () => {
      const content = `
[project]
name = "mypackage"
`;
      const result = parsePyprojectToml(content);
      expect(result.has('mypackage')).toBe(true);
      // underscore variant is same as original
      expect(result.size).toBe(1);
    });

    it('should handle name with multiple hyphens', () => {
      const content = `
[project]
name = "my-awesome-package"
`;
      const result = parsePyprojectToml(content);
      expect(result.has('my-awesome-package')).toBe(true);
      expect(result.has('my_awesome_package')).toBe(true);
    });

    it('should handle whitespace around equals sign', () => {
      const content = `
[project]
name="my-package"
`;
      const result = parsePyprojectToml(content);
      expect(result.has('my-package')).toBe(true);
    });

    it('should handle extra whitespace', () => {
      const content = `
[project]
name   =   "my-package"
`;
      const result = parsePyprojectToml(content);
      expect(result.has('my-package')).toBe(true);
    });
  });

  describe('packages array parsing', () => {
    it('should parse packages array with double quotes', () => {
      const content = `
[tool.setuptools]
packages = ["pkg1", "pkg2", "pkg3"]
`;
      const result = parsePyprojectToml(content);
      expect(result.has('pkg1')).toBe(true);
      expect(result.has('pkg2')).toBe(true);
      expect(result.has('pkg3')).toBe(true);
    });

    it('should parse packages array with single quotes', () => {
      const content = `
[tool.setuptools]
packages = ['pkg1', 'pkg2']
`;
      const result = parsePyprojectToml(content);
      expect(result.has('pkg1')).toBe(true);
      expect(result.has('pkg2')).toBe(true);
    });

    it('should parse packages array with mixed quotes', () => {
      const content = `
packages = ["pkg1", 'pkg2']
`;
      const result = parsePyprojectToml(content);
      expect(result.has('pkg1')).toBe(true);
      expect(result.has('pkg2')).toBe(true);
    });

    it('should parse multiline packages array', () => {
      const content = `
packages = [
    "pkg1",
    "pkg2",
    "pkg3"
]
`;
      const result = parsePyprojectToml(content);
      expect(result.has('pkg1')).toBe(true);
      expect(result.has('pkg2')).toBe(true);
      expect(result.has('pkg3')).toBe(true);
    });

    it('should parse single package in array', () => {
      const content = `
packages = ["single_pkg"]
`;
      const result = parsePyprojectToml(content);
      expect(result.has('single_pkg')).toBe(true);
    });
  });

  describe('combined parsing', () => {
    it('should parse both project name and packages array', () => {
      const content = `
[project]
name = "main-package"
version = "1.0.0"

[tool.setuptools]
packages = ["subpkg1", "subpkg2"]
`;
      const result = parsePyprojectToml(content);
      expect(result.has('main-package')).toBe(true);
      expect(result.has('main_package')).toBe(true);
      expect(result.has('subpkg1')).toBe(true);
      expect(result.has('subpkg2')).toBe(true);
    });

    it('should handle real-world pyproject.toml', () => {
      const content = `
[build-system]
requires = ["hatchling>=1.5.0", "jupyterlab>=4.0.0,<5"]
build-backend = "hatchling.build"

[project]
name = "jupyterlab_vscode_icons_extension"
version = "1.1.9"
description = "VSCode-style file icons for JupyterLab"
readme = "README.md"
license = { file = "LICENSE" }
requires-python = ">=3.8"
classifiers = [
    "Framework :: Jupyter",
    "Framework :: Jupyter :: JupyterLab",
    "Framework :: Jupyter :: JupyterLab :: 4",
    "License :: OSI Approved :: BSD License",
    "Programming Language :: Python",
    "Programming Language :: Python :: 3",
]

[tool.hatch.build.targets.wheel.shared-data]
"jupyterlab_vscode_icons_extension/labextension" = "share/jupyter/labextensions/jupyterlab_vscode_icons_extension"
`;
      const result = parsePyprojectToml(content);
      expect(result.has('jupyterlab_vscode_icons_extension')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should return empty set for empty content', () => {
      const result = parsePyprojectToml('');
      expect(result.size).toBe(0);
    });

    it('should return empty set for content without project section', () => {
      const content = `
[build-system]
requires = ["hatchling"]
`;
      const result = parsePyprojectToml(content);
      expect(result.size).toBe(0);
    });

    it('should not match name outside [project] section', () => {
      const content = `
[other-section]
name = "wrong-package"

[project]
version = "1.0.0"
`;
      const result = parsePyprojectToml(content);
      expect(result.has('wrong-package')).toBe(false);
    });
  });
});

describe('parseSetupPy', () => {
  describe('name parsing', () => {
    it('should parse name with double quotes', () => {
      const content = `
from setuptools import setup

setup(
    name="my-package",
    version="1.0.0",
)
`;
      const result = parseSetupPy(content);
      expect(result.has('my-package')).toBe(true);
      expect(result.has('my_package')).toBe(true);
    });

    it('should parse name with single quotes', () => {
      const content = `
setup(
    name='my-package',
)
`;
      const result = parseSetupPy(content);
      expect(result.has('my-package')).toBe(true);
    });

    it('should handle name without hyphens', () => {
      const content = `
setup(name="mypackage")
`;
      const result = parseSetupPy(content);
      expect(result.has('mypackage')).toBe(true);
    });
  });

  describe('packages array parsing', () => {
    it('should parse packages array inline', () => {
      const content = `
setup(
    packages=["pkg1", "pkg2", "pkg3"],
)
`;
      const result = parseSetupPy(content);
      expect(result.has('pkg1')).toBe(true);
      expect(result.has('pkg2')).toBe(true);
      expect(result.has('pkg3')).toBe(true);
    });

    it('should parse packages array multiline', () => {
      const content = `
setup(
    packages=[
        "pkg1",
        "pkg2",
    ],
)
`;
      const result = parseSetupPy(content);
      expect(result.has('pkg1')).toBe(true);
      expect(result.has('pkg2')).toBe(true);
    });

    it('should parse packages with single quotes', () => {
      const content = `
packages=['pkg1', 'pkg2']
`;
      const result = parseSetupPy(content);
      expect(result.has('pkg1')).toBe(true);
      expect(result.has('pkg2')).toBe(true);
    });
  });

  describe('combined parsing', () => {
    it('should parse both name and packages', () => {
      const content = `
from setuptools import setup

setup(
    name="main-package",
    version="1.0.0",
    packages=["subpkg1", "subpkg2"],
)
`;
      const result = parseSetupPy(content);
      expect(result.has('main-package')).toBe(true);
      expect(result.has('main_package')).toBe(true);
      expect(result.has('subpkg1')).toBe(true);
      expect(result.has('subpkg2')).toBe(true);
    });

    it('should handle real-world setup.py', () => {
      const content = `
#!/usr/bin/env python
from setuptools import setup, find_packages

setup(
    name="my-awesome-lib",
    version="2.0.0",
    author="Developer",
    author_email="dev@example.com",
    description="An awesome library",
    packages=find_packages(),
    python_requires=">=3.8",
    install_requires=[
        "numpy>=1.0",
        "pandas>=1.0",
    ],
)
`;
      const result = parseSetupPy(content);
      expect(result.has('my-awesome-lib')).toBe(true);
      expect(result.has('my_awesome_lib')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should return empty set for empty content', () => {
      const result = parseSetupPy('');
      expect(result.size).toBe(0);
    });

    it('should return empty set for content with find_packages() only', () => {
      const content = `
setup(
    packages=find_packages(),
)
`;
      const result = parseSetupPy(content);
      // find_packages() is dynamic, not a literal array
      expect(result.size).toBe(0);
    });

    it('should handle whitespace variations', () => {
      const content = `
setup(name  =  "my-pkg",packages  =  ["pkg1"])
`;
      const result = parseSetupPy(content);
      expect(result.has('my-pkg')).toBe(true);
      expect(result.has('pkg1')).toBe(true);
    });
  });
});
