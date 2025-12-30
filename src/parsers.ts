/**
 * Python package configuration file parsers
 * Extracts package names from pyproject.toml and setup.py files
 */

/**
 * Parse pyproject.toml content to extract Python package names
 * @param content - The content of pyproject.toml file
 * @returns Set of package names found in the file
 */
export function parsePyprojectToml(content: string): Set<string> {
  const packages = new Set<string>();

  // Parse [project] name = "package_name"
  const nameMatch = content.match(
    /\[project\][^[]*name\s*=\s*["']([^"']+)["']/s
  );
  if (nameMatch) {
    packages.add(nameMatch[1]);
    // Also add underscore variant (package-name -> package_name)
    packages.add(nameMatch[1].replace(/-/g, '_'));
  }

  // Parse packages = ["pkg1", "pkg2"]
  const packagesMatch = content.match(/packages\s*=\s*\[([^\]]+)\]/);
  if (packagesMatch) {
    const pkgList = packagesMatch[1].match(/["']([^"']+)["']/g);
    pkgList?.forEach(p => packages.add(p.replace(/["']/g, '')));
  }

  return packages;
}

/**
 * Parse setup.py content to extract Python package names
 * @param content - The content of setup.py file
 * @returns Set of package names found in the file
 */
export function parseSetupPy(content: string): Set<string> {
  const packages = new Set<string>();

  // Parse packages=["pkg1", "pkg2"]
  const packagesMatch = content.match(/packages\s*=\s*\[([^\]]+)\]/);
  if (packagesMatch) {
    const pkgList = packagesMatch[1].match(/["']([^"']+)["']/g);
    pkgList?.forEach(p => packages.add(p.replace(/["']/g, '')));
  }

  // Parse name="package_name"
  const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/);
  if (nameMatch) {
    packages.add(nameMatch[1]);
    packages.add(nameMatch[1].replace(/-/g, '_'));
  }

  return packages;
}
