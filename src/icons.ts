/**
 * Icon mappings for file extensions using vscode-icons
 */

import iconsData from '@iconify-json/vscode-icons/icons.json';
import { customIcons } from './custom-icons';

interface IIconMapping {
  [key: string]: string;
}

/**
 * Map file extensions to vscode icon names
 * Based on common file type associations
 */
export const extensionToIcon: IIconMapping = {
  // Programming languages
  js: 'file-type-js-official',
  jsx: 'file-type-reactjs',
  ts: 'file-type-typescript-official',
  tsx: 'file-type-reactts',
  py: 'file-type-python',
  pyc: 'file-type-python',
  pyd: 'file-type-python',
  pyo: 'file-type-python',
  pyw: 'file-type-python',
  pyx: 'file-type-cython',
  ipynb: 'file-type-jupyter',
  java: 'file-type-java-hexagon',
  class: 'file-type-class',
  jar: 'file-type-jar',
  c: 'file-type-c-mauve',
  h: 'file-type-c-mauve',
  cpp: 'file-type-cpp-large',
  cc: 'file-type-cpp-large',
  cxx: 'file-type-cpp-large',
  hpp: 'file-type-cpp-large',
  hh: 'file-type-cpp-large',
  hxx: 'file-type-cpp-large',
  'h++': 'file-type-cpp-large',
  mm: 'file-type-cpp-large',
  cs: 'file-type-csharp2',
  cu: 'file-type-cuda-hexagon',
  cuh: 'file-type-cuda-hexagon',
  go: 'file-type-go',
  rs: 'file-type-rust-hexagon',
  rb: 'file-type-ruby',
  php: 'file-type-php',
  swift: 'file-type-swift',
  kt: 'file-type-kotlin',
  kts: 'file-type-kotlin',
  r: 'file-type-r',
  R: 'file-type-r',
  jl: 'file-type-julia',
  scala: 'file-type-scala',
  lua: 'file-type-lua',
  pl: 'file-type-perl',
  pm: 'file-type-perl',
  sh: 'file-type-shell',
  bash: 'file-type-shell',
  zsh: 'file-type-shell',
  fish: 'file-type-shell',
  bat: 'file-type-shell',
  cmd: 'file-type-shell',
  ps1: 'file-type-powershell',
  vbs: 'file-type-vba',
  vbe: 'file-type-vba',
  sql: 'file-type-sql',

  // Web
  html: 'file-type-html',
  htm: 'file-type-html',
  css: 'file-type-css',
  scss: 'file-type-scss',
  sass: 'file-type-sass',
  less: 'file-type-less',
  vue: 'file-type-vue',
  svelte: 'file-type-svelte',

  // Data formats
  json: 'file-type-json',
  yaml: 'file-type-yaml',
  yml: 'file-type-yaml',
  toml: 'file-type-toml',
  xml: 'file-type-xml',
  csv: 'file-type-csv',
  tsv: 'file-type-csv',

  // Documentation
  md: 'file-type-markdown',
  mdx: 'file-type-mdx',
  rst: 'file-type-rst',
  txt: 'file-type-text',
  pdf: 'file-type-pdf',

  // Config files
  gitignore: 'file-type-git',
  gitattributes: 'file-type-git',
  gitmodules: 'file-type-git',
  '.git': 'file-type-git',
  '.gitignore': 'file-type-git',
  '.gitattributes': 'file-type-git',
  '.gitmodules': 'file-type-git',
  dockerignore: 'file-type-docker',
  dockerfile: 'file-type-docker',
  env: 'file-type-dotenv',
  ini: 'file-type-ini',
  cfg: 'file-type-config',
  conf: 'file-type-config',

  // Package managers
  'package.json': 'file-type-npm',
  'package-lock.json': 'file-type-npm',
  'yarn.lock': 'file-type-yarn',
  'requirements.txt': 'file-type-python',
  'pyproject.toml': 'file-type-python',
  'setup.py': 'file-type-python',
  Pipfile: 'file-type-python',
  'Cargo.toml': 'file-type-rust',
  'Cargo.lock': 'file-type-rust',
  Gemfile: 'file-type-ruby',
  'pom.xml': 'file-type-maven',
  'build.gradle': 'file-type-gradle',

  // Build tools
  LICENSE: 'file-type-license',
  LICENCE: 'file-type-license',
  license: 'file-type-license',
  licence: 'file-type-license',
  webpack: 'file-type-webpack',
  rollup: 'file-type-rollup',
  vite: 'file-type-vite',

  // CI/CD
  'gitlab-ci.yml': 'file-type-gitlab',
  '.travis.yml': 'file-type-travis',
  'circle.yml': 'file-type-circleci',
  Jenkinsfile: 'file-type-jenkins',

  // Images
  png: 'file-type-image',
  jpg: 'file-type-image',
  jpeg: 'file-type-image',
  gif: 'file-type-image',
  svg: 'file-type-svg',
  ico: 'file-type-image',
  webp: 'file-type-image',
  bmp: 'file-type-image',

  // Archives
  zip: 'file-type-zip',
  tar: 'file-type-zip',
  gz: 'file-type-zip',
  bz2: 'file-type-zip',
  '7z': 'file-type-zip',
  rar: 'file-type-zip',

  // Windows specific
  lnk: 'file-type-lnk',

  // Other
  lock: 'file-type-lock',
  log: 'file-type-log',
  wasm: 'file-type-wasm',
  proto: 'file-type-protobuf',
  graphql: 'file-type-graphql',
  gql: 'file-type-graphql'
};

/**
 * Get icon name for a file
 * @param filename - The file name
 * @returns The icon name or default-file if not found
 */
export function getIconForFile(filename: string): string {
  const lowerFilename = filename.toLowerCase();

  // Check exact filename matches first
  if (extensionToIcon[lowerFilename]) {
    return extensionToIcon[lowerFilename];
  }

  // Check for extension
  const parts = filename.split('.');
  if (parts.length > 1) {
    const ext = parts[parts.length - 1].toLowerCase();
    if (extensionToIcon[ext]) {
      return extensionToIcon[ext];
    }
  }

  // Check for special prefixes (dot files)
  if (filename.startsWith('.')) {
    const nameWithoutDot = filename.slice(1);
    if (extensionToIcon[nameWithoutDot]) {
      return extensionToIcon[nameWithoutDot];
    }
  }

  return 'default-file';
}

/**
 * Get SVG content for an icon
 * @param iconName - The icon name
 * @returns The SVG body content
 */
export function getIconSVG(iconName: string): string {
  if (customIcons[iconName]) {
    return customIcons[iconName];
  }
  const icons = iconsData.icons as {
    [key: string]: { body?: string; parent?: string };
  };
  const aliases = (iconsData as any).aliases as {
    [key: string]: { parent?: string };
  };

  let icon: { body?: string; parent?: string } | undefined;

  // First check if it's an alias
  const alias = aliases?.[iconName];
  if (alias?.parent) {
    // Resolve alias to actual icon
    icon = icons[alias.parent];
  } else {
    // Not an alias, check regular icons
    icon = icons[iconName];
  }

  if (!icon) {
    icon = icons['default-file'];
  }

  // Resolve parent reference if present
  if (icon?.parent) {
    const parentIcon = icons[icon.parent];
    return parentIcon?.body || icons['default-file']?.body || '';
  }

  return icon?.body || icons['default-file']?.body || '';
}

/**
 * Generate complete SVG element for an icon
 * @param iconName - The icon name
 * @param className - Optional CSS class name
 * @returns Complete SVG string
 */
export function generateIconSVG(iconName: string, className = ''): string {
  const body = getIconSVG(iconName);
  const classAttr = className ? ` class="${className}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${getIconViewBox(
    iconName
  )}"${classAttr}>${body}</svg>`;
}

/**
 * The drawing box an icon's body is written in.
 *
 * Most of the set is 32x32, the collection default, but 38 entries carry their
 * own width and height - file-type-go is 254.5x225 - and a body written in that
 * space draws nothing inside a 32x32 window. Every bundled svg this extension
 * builds reads its box from the record rather than assuming the default; the
 * five custom bodies declare the 32x32 box in src/custom-icons.ts.
 *
 * @param iconName - The icon name
 * @returns The viewBox attribute value
 */
export function getIconViewBox(iconName: string): string {
  if (customIcons[iconName]) {
    return '0 0 32 32';
  }
  const icons = iconsData.icons as {
    [key: string]: {
      body?: string;
      parent?: string;
      width?: number;
      height?: number;
    };
  };
  const aliases = (iconsData as any).aliases as {
    [key: string]: { parent?: string };
  };

  const alias = aliases?.[iconName];
  let icon = alias?.parent ? icons[alias.parent] : icons[iconName];
  if (icon?.parent) {
    icon = icons[icon.parent];
  }

  const defaults = iconsData as unknown as { width?: number; height?: number };
  const width = icon?.width ?? defaults.width ?? 32;
  const height = icon?.height ?? defaults.height ?? 32;
  return `0 0 ${width} ${height}`;
}
