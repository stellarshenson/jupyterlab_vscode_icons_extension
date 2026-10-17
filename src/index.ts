import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { URLExt } from '@jupyterlab/coreutils';
import { Contents, ServerConnection } from '@jupyterlab/services';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { FileBrowserModel, IDefaultFileBrowser } from '@jupyterlab/filebrowser';
import { fileIcon, LabIcon, markdownIcon } from '@jupyterlab/ui-components';

import { needsOutlineOn } from './contrast';
// Loaded eagerly on purpose: activate() registers every mapped file type up
// front, so the icon map is needed before the application starts. The directive
// must sit on the line immediately above the import to attach to it.
// eslint-disable-next-line jupyter/prefer-lazy-imports
import { generateIconSVG, getIconForFile, getIconSVG } from './icons';
import { parsePyprojectToml, parseSetupPy } from './parsers';
import { applyJupytext1191Hotfix } from './hotfixes';

const PLUGIN_ID = 'jupyterlab_vscode_icons_extension:plugin';

// The square's edge spans 8.0..15.8 once its 0.8 stroke is counted, inside the
// 16 viewBox, so no edge leaves the canvas the way the earlier 8..16 circle
// did. Alpha lets the artwork under it read through instead of stamping a
// solid tile.
const symlinkBadgeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect x="8.4" y="8.4" width="7" height="7" fill="#263447" fill-opacity="0.72" stroke="#fff" stroke-opacity="0.5" stroke-width="0.8"/><path d="M10.3 13.5 13.5 10.3m-2.2 0h2.2v2.2" fill="none" stroke="#fff" stroke-opacity="0.95" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// Icon groups for settings
interface IIconSettings {
  enableLanguageIcons: boolean;
  enableWebIcons: boolean;
  enableDataIcons: boolean;
  enableConfigIcons: boolean;
  enableDocIcons: boolean;
  enableImageIcons: boolean;
  enableExecutableIcons: boolean;
}

/**
 * A listing entry as the server contents manager returns it: the contents
 * model, plus the link fact the server half adds to every entry.
 */
interface IListedItem extends Contents.IModel {
  symlink?: boolean;
  executable?: boolean;
}

/**
 * The package names a manifest contributes to the folder icons.
 *
 * The local parsers are regexes and would take a name out of a pyproject.toml
 * or setup.py that does not parse at all (DEF-ICONS-55). The source already
 * fetched for the directory pass goes to the server's validation route first,
 * and an invalid answer drops every name. A failed call means a frontend-only
 * install with no route to answer, so the local result stands, silently, as it
 * did before. A cacheKey makes the answer stick for one revision of one
 * manifest.
 */
const manifestVerdicts = new Map<string, Set<string>>();

export async function packageNamesFromManifest(
  source: string,
  kind: 'toml' | 'python',
  cacheKey?: string
): Promise<Set<string>> {
  // The browser refreshes the listing on its poll, and every refresh re-reads
  // the manifests of the directory, so the same source would otherwise be
  // posted and parsed every few seconds. The key carries the manifest's own
  // stamp, and its length where a provider omits one, so an edit is seen.
  const cached = cacheKey ? manifestVerdicts.get(cacheKey) : undefined;
  if (cached) {
    return cached;
  }
  const serverSettings = ServerConnection.makeSettings();
  const url = URLExt.join(
    serverSettings.baseUrl,
    'vscode-icons',
    'validate-manifest'
  );
  let valid = true;
  try {
    const response = await ServerConnection.makeRequest(
      url,
      {
        method: 'POST',
        body: JSON.stringify({ kind, source }),
        headers: { 'Content-Type': 'application/json' }
      },
      serverSettings
    );
    if (response.ok) {
      const answer = await response.json();
      valid = answer?.valid !== false;
    }
  } catch {
    // The call failed; the local parse keeps its names.
  }
  const names = valid
    ? kind === 'toml'
      ? parsePyprojectToml(source)
      : parseSetupPy(source)
    : new Set<string>();
  if (cacheKey) {
    manifestVerdicts.set(cacheKey, names);
  }
  return names;
}

/**
 * Create a LabIcon from vscode-icons SVG data
 */
function createLabIcon(iconName: string): LabIcon {
  // generateIconSVG reads the icon's own drawing box; 38 keys in the bundled
  // set are not 32x32 and draw nothing inside one.
  return new LabIcon({
    name: `vscode-icons:${iconName}`,
    svgstr: generateIconSVG(iconName)
  });
}

/**
 * File type registration configuration
 */
interface IFileTypeConfig {
  extensions: string[];
  pattern?: string;
  iconName: string;
  mimeTypes?: string[];
  group: keyof IIconSettings;
}

// Comprehensive file type configurations grouped by category
const fileTypeConfigs: IFileTypeConfig[] = [
  // Programming Languages
  {
    extensions: ['.js', '.mjs', '.cjs'],
    iconName: 'file-type-js-official',
    group: 'enableLanguageIcons'
  },
  {
    extensions: ['.jsx'],
    iconName: 'file-type-reactjs',
    group: 'enableLanguageIcons'
  },
  {
    extensions: ['.ts', '.mts', '.cts'],
    iconName: 'file-type-typescript-official',
    group: 'enableLanguageIcons'
  },
  {
    extensions: ['.tsx'],
    iconName: 'file-type-reactts',
    group: 'enableLanguageIcons'
  },
  {
    extensions: ['.py', '.pyw', '.pyx'],
    iconName: 'file-type-python',
    group: 'enableLanguageIcons'
  },
  {
    extensions: ['.ipynb'],
    iconName: 'file-type-jupyter',
    group: 'enableLanguageIcons'
  },
  {
    extensions: ['.java'],
    iconName: 'file-type-java-hexagon',
    group: 'enableLanguageIcons'
  },
  {
    extensions: ['.c'],
    iconName: 'file-type-c-mauve',
    group: 'enableLanguageIcons'
  },
  {
    extensions: ['.cpp', '.cc', '.cxx', '.ino', '.mm'],
    iconName: 'file-type-cpp-large',
    group: 'enableLanguageIcons'
  },
  {
    extensions: ['.h'],
    iconName: 'file-type-c-mauve',
    group: 'enableLanguageIcons'
  },
  {
    extensions: ['.hpp', '.hh', '.hxx', '.h++'],
    iconName: 'file-type-cpp-large',
    group: 'enableLanguageIcons'
  },
  {
    extensions: ['.cs'],
    iconName: 'file-type-csharp2',
    group: 'enableLanguageIcons'
  },
  {
    extensions: ['.cu', '.cuh'],
    iconName: 'file-type-cuda-hexagon',
    group: 'enableLanguageIcons'
  },
  {
    extensions: ['.go'],
    iconName: 'file-type-go',
    group: 'enableLanguageIcons'
  },
  {
    extensions: ['.rs'],
    iconName: 'file-type-rust-hexagon',
    group: 'enableLanguageIcons'
  },
  {
    extensions: ['.rb'],
    iconName: 'file-type-ruby',
    group: 'enableLanguageIcons'
  },
  {
    extensions: ['.php'],
    iconName: 'file-type-php',
    group: 'enableLanguageIcons'
  },
  {
    extensions: ['.swift'],
    iconName: 'file-type-swift',
    group: 'enableLanguageIcons'
  },
  {
    extensions: ['.kt', '.kts'],
    iconName: 'file-type-kotlin',
    group: 'enableLanguageIcons'
  },
  {
    extensions: ['.r', '.R'],
    iconName: 'file-type-r',
    group: 'enableLanguageIcons'
  },
  {
    extensions: ['.jl'],
    iconName: 'file-type-julia',
    group: 'enableLanguageIcons'
  },
  {
    extensions: ['.scala'],
    iconName: 'file-type-scala',
    group: 'enableLanguageIcons'
  },
  {
    extensions: ['.lua'],
    iconName: 'file-type-lua',
    group: 'enableLanguageIcons'
  },
  {
    extensions: ['.pl', '.pm'],
    iconName: 'file-type-perl',
    group: 'enableLanguageIcons'
  },
  // Shell scripts (.sh, .bash, .zsh, .fish, .csh, .nu) and batch files (.bat, .cmd) use custom icons with black backgrounds
  // Registered separately below with custom SVGs
  {
    extensions: ['.ps1'],
    iconName: 'file-type-powershell',
    group: 'enableLanguageIcons'
  },
  {
    extensions: ['.vbs', '.vbe'],
    iconName: 'file-type-vba',
    group: 'enableLanguageIcons'
  },
  {
    extensions: ['.sql'],
    iconName: 'file-type-sql',
    group: 'enableLanguageIcons'
  },

  // Web Development
  {
    extensions: ['.html', '.htm'],
    iconName: 'file-type-html',
    group: 'enableWebIcons'
  },
  {
    extensions: ['.css'],
    iconName: 'file-type-css',
    group: 'enableWebIcons'
  },
  {
    extensions: ['.scss'],
    iconName: 'file-type-scss',
    group: 'enableWebIcons'
  },
  {
    extensions: ['.sass'],
    iconName: 'file-type-sass',
    group: 'enableWebIcons'
  },
  {
    extensions: ['.less'],
    iconName: 'file-type-less',
    group: 'enableWebIcons'
  },
  {
    extensions: ['.vue'],
    iconName: 'file-type-vue',
    group: 'enableWebIcons'
  },
  {
    extensions: ['.svelte'],
    iconName: 'file-type-svelte',
    group: 'enableWebIcons'
  },

  // Data Formats
  {
    extensions: ['.json'],
    iconName: 'file-type-json',
    group: 'enableDataIcons'
  },
  {
    extensions: ['.toml'],
    iconName: 'file-type-toml',
    group: 'enableDataIcons'
  },
  {
    extensions: ['.xml'],
    iconName: 'file-type-xml',
    group: 'enableDataIcons'
  },
  {
    extensions: ['.csv', '.tsv'],
    iconName: 'file-type-csv',
    group: 'enableDataIcons'
  },
  // Declaration-only rows, the `custom-` convention: registerFileTypes skips
  // them because their icons are registered by hand further down, but groupFor
  // reads this table, so without a row here the family has no group and the
  // fallback painter treats it as ungoverned - measured: with
  // enableLanguageIcons off, a .sh row still painted file-type-shell and a .bat
  // row painted the unix shell glyph (DEF-CONFIG-26).
  {
    extensions: [],
    pattern: '^\\.mcp\\.json(\\..*)?$',
    iconName: 'custom-mcp',
    group: 'enableConfigIcons'
  },
  {
    extensions: ['.sh', '.bash', '.zsh', '.fish', '.csh', '.nu'],
    iconName: 'custom-shell',
    group: 'enableLanguageIcons'
  },
  {
    extensions: ['.bat', '.cmd'],
    iconName: 'custom-batch',
    group: 'enableLanguageIcons'
  },
  {
    extensions: [],
    pattern: '^(LICENSE|LICENCE|license|licence)(\\..*)?$',
    iconName: 'custom-license',
    group: 'enableDocIcons'
  },
  {
    extensions: ['.onnx'],
    iconName: 'custom-onnx',
    group: 'enableDataIcons'
  },
  {
    extensions: ['.pt', '.pth'],
    iconName: 'custom-pytorch',
    group: 'enableDataIcons'
  },
  {
    extensions: ['.joblib'],
    iconName: 'custom-joblib',
    group: 'enableDataIcons'
  },

  // Documentation
  {
    extensions: ['.md'],
    iconName: 'file-type-markdown',
    group: 'enableDocIcons'
  },
  {
    extensions: ['.mdx'],
    iconName: 'file-type-mdx',
    group: 'enableDocIcons'
  },
  {
    extensions: ['.rst'],
    iconName: 'file-type-rst',
    group: 'enableDocIcons'
  },
  {
    extensions: ['.txt'],
    iconName: 'custom-txt',
    group: 'enableDocIcons'
  },
  {
    extensions: ['.pdf'],
    iconName: 'file-type-pdf',
    group: 'enableDocIcons'
  },
  {
    extensions: ['.doc', '.docx'],
    iconName: 'file-type-word',
    group: 'enableDocIcons'
  },
  {
    extensions: ['.xls', '.xlsx', '.xlsm'],
    iconName: 'file-type-excel',
    group: 'enableDocIcons'
  },
  {
    extensions: ['.ppt', '.pptx'],
    iconName: 'file-type-powerpoint',
    group: 'enableDocIcons'
  },

  // Config Files
  {
    extensions: ['.env'],
    pattern:
      '^(\\.env|\\.env\\.(?!zip|tar|gz|bz2|xz|7z|rar)[^.]+|[^.]+\\.env)$',
    iconName: 'file-type-dotenv',
    mimeTypes: ['text/x-sh'],
    group: 'enableConfigIcons'
  },
  {
    extensions: ['.ini'],
    iconName: 'file-type-ini',
    group: 'enableConfigIcons'
  },
  {
    extensions: ['.cfg', '.conf'],
    iconName: 'file-type-config',
    group: 'enableConfigIcons'
  },
  {
    pattern: '^(Dockerfile|dockerfile).*$',
    extensions: [],
    iconName: 'file-type-docker',
    group: 'enableConfigIcons'
  },
  {
    pattern: '^\\.git(ignore|modules|attributes|keep)?$',
    extensions: [],
    iconName: 'file-type-git',
    group: 'enableConfigIcons'
  },
  {
    pattern: '^\\.dockerignore$',
    extensions: [],
    iconName: 'file-type-docker',
    group: 'enableConfigIcons'
  },
  {
    pattern: '^package\\.json$',
    extensions: [],
    iconName: 'file-type-npm',
    group: 'enableConfigIcons'
  },
  {
    pattern: '^package-lock\\.json$',
    extensions: [],
    iconName: 'file-type-npm',
    group: 'enableConfigIcons'
  },
  {
    pattern: '^tsconfig\\..+$',
    extensions: [],
    iconName: 'file-type-tsconfig-official',
    group: 'enableConfigIcons'
  },
  {
    pattern:
      '^(\\.prettierrc(\\..*)?|prettier\\.config\\..+|\\.prettierignore)$',
    extensions: [],
    iconName: 'custom-prettier',
    group: 'enableConfigIcons'
  },
  {
    pattern: '^yarn\\.lock$',
    extensions: [],
    iconName: 'file-type-yarn',
    group: 'enableConfigIcons'
  },
  {
    pattern: '^requirements([_-].*?)?\\.txt$',
    extensions: [],
    iconName: 'file-type-python',
    group: 'enableConfigIcons'
  },
  {
    pattern: '^pyproject\\.toml$',
    extensions: [],
    iconName: 'file-type-toml',
    group: 'enableConfigIcons'
  },
  {
    pattern: '^setup\\.py$',
    extensions: [],
    iconName: 'file-type-python',
    group: 'enableConfigIcons'
  },
  {
    pattern: '^Cargo\\.(toml|lock)$',
    extensions: [],
    iconName: 'file-type-rust',
    group: 'enableConfigIcons'
  },
  {
    pattern: '^Gemfile$',
    extensions: [],
    iconName: 'file-type-ruby',
    group: 'enableConfigIcons'
  },

  {
    extensions: ['.lnk'],
    iconName: 'file-type-lnk',
    group: 'enableConfigIcons'
  },
  {
    extensions: ['.tf', '.tfvars', '.tfstate'],
    iconName: 'file-type-terraform',
    group: 'enableConfigIcons'
  },
  {
    pattern:
      '^(terraform\\.tfvars\\..*|\\.terraform\\.lock\\..*|\\.terraform\\.tfstate\\.lock\\..*)$',
    extensions: [],
    iconName: 'file-type-terraform',
    group: 'enableConfigIcons'
  },
  // Draw.io diagrams (custom icon registered separately)
  {
    extensions: ['.drawio', '.dio'],
    iconName: 'custom-drawio',
    group: 'enableConfigIcons'
  },
  {
    extensions: ['.bpmn'],
    iconName: 'custom-bpmn',
    group: 'enableConfigIcons'
  },

  // Images
  {
    extensions: ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.bmp'],
    iconName: 'file-type-image',
    group: 'enableImageIcons'
  },
  {
    extensions: ['.svg'],
    iconName: 'file-type-svg',
    group: 'enableImageIcons'
  }
];

// BPMN process mark. Defined here, not at the file-type registration
// below, because three readers need it: the row ::before override, the
// tab painter's artwork table and the LabIcon handed to docRegistry.
//
// The maintainer drew this one himself. style/bpmn-icon.svg is his working
// copy; this constant is that file with the Inkscape metadata stripped and
// every coordinate kept. A diagonal process reads better at 16px than the
// horizontal row it replaced: start event top left, two right-angled
// sequence flows, the task in the centre, the filled end event bottom
// right. The whole mark is inset to 87.5 percent of the box, the share of
// its own box the bundled image glyph fills, so the tile is the same size
// as the image icon. The tile is a square in a paler orange than the
// camunda #fc5d0d it started from - both his decisions, and ACC-COLOUR-12
// records the measured cost of the paler tile.
const bpmnSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <g transform="translate(6.25,6.25) scale(0.875)">
    <path fill="#fd7430" d="M -0.25177813,-0.44507674 H 99.748212 V 99.554923 H -0.25177813 Z"/>
    <g fill="none" stroke="#ffffff" stroke-linecap="round" transform="matrix(0.91132727,0,0,0.91132727,0.12629147,-20.843682)">
      <circle cx="27.524347" cy="50" r="9" stroke-width="6"/>
      <path d="M 36.639252,50 H 55.726081" stroke-width="5.44281"/>
      <path d="M 55.231087,50.132831 V 73.327594" stroke-width="6"/>
    </g>
    <g fill="none" stroke="#ffffff" stroke-linecap="round" transform="matrix(-0.91132727,0,0,-0.91132727,100.25208,120.71562)">
      <circle cx="27.91214" cy="49.612206" r="9" stroke-width="6" fill="#ffffff"/>
      <path d="M 32,50 H 55.194763" stroke-width="6"/>
      <path d="M 55.231087,50.132831 V 73.327594" stroke-width="6"/>
    </g>
    <rect x="36.083298" y="36.081635" width="28" height="27.253645" rx="5" fill="#ffffff"/>
  </g>
</svg>`;

const plugin: JupyterFrontEndPlugin<void> = {
  id: PLUGIN_ID,
  description:
    'Jupyterlab extension with a shameless rip-off of the vscode-icons into our beloved environment',
  autoStart: true,
  optional: [ISettingRegistry, IDefaultFileBrowser],
  activate: (
    app: JupyterFrontEnd,
    settingRegistry: ISettingRegistry | null,
    defaultFileBrowser: IDefaultFileBrowser | null
  ) => {
    const { docRegistry } = app;

    // Function to inject CSS that overrides Jupytext icons
    const injectIconOverrideCSS = () => {
      // Get icons: Claude (VSCode), Office (VSCode)
      const claudeIcon = createLabIcon('file-type-claude');
      const wordIcon = createLabIcon('file-type-word');
      const excelIcon = createLabIcon('file-type-excel');
      const powerpointIcon = createLabIcon('file-type-powerpoint');

      // Custom Markdown icon (from markdown.svg - purple M with arrow, #8a2ea5)
      const markdownSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 309 327">
        <path fill="#8a2ea5" opacity="1" stroke="none" d="m 138.68393,230.48651 c 36.58836,3.1e-4 72.68422,3.1e-4 108.78008,3.1e-4 0.13988,0.49669 0.0821,0.12537 -3.34406,3.81472 -27.34165,24.16766 -54.43119,49.41695 -81.72391,73.62893 -2.65146,2.35216 -4.5582,3.21609 -7.64686,0.37229 -26.89754,-24.76539 -75.191307,-68.40096 -80.889724,-74.12425 -0.744118,-0.74735 -1.274501,-1.57204 -2.95867,-3.69233 23.309236,0 45.299954,0 67.783144,3.3e-4 z"/>
        <path fill="#8a2ea5" transform="translate(0,66.719382) scale(1,0.648)" d="m 61.156397,14.443673 h 69.176263 q 14.81059,56.661581 23.29958,97.452667 l 5.96036,-27.150338 q 3.61233,-15.870486 7.76652,-30.954008 l 10.6564,-39.348321 H 248.6367 L 276.09047,189.5437 H 221.90541 L 207.27544,69.137838 173.50009,189.5437 H 136.47364 L 101.07273,68.875516 86.984609,189.5437 H 35.147571 Z"/>
      </svg>`;

      // Custom PDF icon (document with folded corner and red PDF banner)
      const pdfSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 16">
        <g transform="matrix(.046 0 0 .046 -.67 -.73)">
          <polygon points="52 357 52 24 205 24 283 102 283 357" fill="#e8e8e8"/>
          <path d="m198 32v76h76v240H52V32h146m10-16H36v365h247V98z"/>
          <polygon points="258 88 220 88 220 49 258 86"/>
        </g>
        <g transform="matrix(.046 0 0 .046 -.67 -.73)">
          <polygon points="312 284 23 284 23 168 37 153 37 171 297 171 297 153 312 168" fill="#ed1c24"/>
          <path d="m304 169l2 2v108H24V171l2-2v9h278v-9m-13-31v28H43v-28l-28 28v126h302V166z"/>
        </g>
        <g transform="matrix(.046 0 0 .046 1.72 11.73)" fill="#fff">
          <path d="M9-83h30q7 0 13 1 6 1 11 5 5 3 7 9 3 5 3 13 0 8-3 13-3 6-7 9-5 4-11 5-6 2-13 2h-9v26H9zm22 39h8q7 0 10-3 3-3 3-9t-4-8-10-2h-7z"/>
          <path d="M87-83h25q9 0 17 2 8 3 14 8 6 5 9 13 3 8 3 19t-3 19-9 13q-6 5-13 8-8 2-17 2H87zm22 66h1q5 0 9-1 4-1 7-4 3-3 5-8 2-4 2-12t-2-12-5-7q-3-3-7-4-4-1-9-1h-1z"/>
          <path d="M169-83h54v18h-32v16h28v18h-28v31h-22z"/>
        </g>
      </svg>`;

      // Custom Python icon (simplified official logo - 50% reduced fidelity)
      const pythonSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 110">
        <defs>
          <linearGradient id="py-b" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0" stop-color="#387EB8"/>
            <stop offset="100" stop-color="#366994"/>
          </linearGradient>
          <linearGradient id="py-y" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0" stop-color="#FFE052"/>
            <stop offset="100" stop-color="#FFC331"/>
          </linearGradient>
        </defs>
        <path fill="url(#py-b)" d="M55,0C29,0,29,10,29,12v13h27v4H19C11,29,0,34,0,55c0,20,8,27,16,27h9V69c0-6,3-16,16-16h26c4,0,15-2,15-14V14C82,11,82,0,55,0zM40,8c3,0,5,2,5,5s-2,5-5,5-5-2-5-5S37,8,40,8z"/>
        <path fill="url(#py-y)" d="M55,110c26,0,26-10,26-12V85H54v-4h37c8,0,18-5,18-26 0-23-11-27-16-27h-9v13c0,6-3,16-16,16H42c-4,0-15,2-15,14v24c0,3,0,14,28,14zM70,101c-3,0-5-2-5-5s2-5,5-5 5,2,5,5S73,101,70,101z"/>
      </svg>`;

      // Custom README icon
      // One README artwork, drawn once: this is the same circle the registered
      // vscode-readme icon uses further down, so a README.md row looks the same
      // whether or not jupytext is installed and claiming the row (DEF-ICONS-28).
      const readmeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="11" fill="#9826c8"/>
        <text x="16" y="22" font-size="18" font-weight="bold" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif">i</text>
      </svg>`;

      // Get SVG content from VSCode icons
      const claudeSvg = claudeIcon.svgstr;
      const wordSvg = wordIcon?.svgstr || '';
      const excelSvg = excelIcon?.svgstr || '';
      const powerpointSvg = powerpointIcon?.svgstr || '';
      // 1.1.110 painted the generic picture glyph here. The vscode svg tile
      // (createLabIcon('file-type-svg')) is what the registered file type uses,
      // so switching this constant would make the row and the tab agree - but it
      // changes an icon the project already had, which is the maintainer's call
      // (DEF-ICONS-25).
      const svgFileIcon = createLabIcon('file-type-image');
      const svgFileSvg = svgFileIcon?.svgstr || '';
      // Database icon - one cylinder for every database format. Derived from the
      // bundled vscode-icons `file-type-db` by dropping its third band and pulling
      // the base up one band pitch (6.705), giving 3 slices instead of 4 and a
      // shorter cylinder, then re-centred in the viewBox (translate 3.35).
      // Recoloured from the stock light gray (#c4c7ce, only 1.69:1 on white) to a
      // blue clearing 3:1 on both light (3.36:1) and dark (4.80:1) - so unlike the
      // stock icon it needs no separate light-theme variant.
      const dbSvg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g transform="translate(0,3.35)"><ellipse cx="16" cy="5.894" rx="9.963" ry="3.894" fill="#5890ca"/><path fill="#5890ca" d="M8.562 15.256A21.2 21.2 0 0 0 16 16.449a21.2 21.2 0 0 0 7.438-1.194c1.864-.727 2.525-1.535 2.525-2V9.7a10.4 10.4 0 0 1-2.084 1.076A22.3 22.3 0 0 1 16 12.078a22.4 22.4 0 0 1-7.879-1.3A10.3 10.3 0 0 1 6.037 9.7v3.55c0 .474.663 1.278 2.525 2.006M16 23.295c5.5 0 9.963-1.744 9.963-3.894v-2.837a10.5 10.5 0 0 1-1.535.762l-.157.063A23.5 23.5 0 0 1 16 18.74a23.4 23.4 0 0 1-8.271-1.351l-.157-.063a10.5 10.5 0 0 1-1.535-.762v2.837C6.037 21.551 10.5 23.295 16 23.295"/></g></svg>';

      // Create base64 encoded data URIs
      const pythonDataUri = `data:image/svg+xml;base64,${btoa(pythonSvg)}`;
      const markdownDataUri = `data:image/svg+xml;base64,${btoa(markdownSvg)}`;
      const claudeDataUri = `data:image/svg+xml;base64,${btoa(claudeSvg)}`;
      const readmeDataUri = `data:image/svg+xml;base64,${btoa(readmeSvg)}`;
      const pdfDataUri = `data:image/svg+xml;base64,${btoa(pdfSvg)}`;
      const txtSvg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3800 4800"><g><path fill="#c9cac6" d="M0 4800h3800V840L2960 0H0"/><path fill="#BBB" d="M2960 840h840L2960 0"/><path fill="#888" d="M3800 1680V840h-840"/></g><g transform="translate(-32,-508.44444)"><path fill="#555555" d="M 900,1976 H 2900 V 1764 H 900 m 0,657 H 2900 V 2209 H 900 m 0,635 H 2100 V 2668 H 900"/></g><g transform="translate(350,130) scale(0.82,0.95)"><path fill="#555555" stroke="#555555" stroke-width="100" stroke-linejoin="round" d="M 1162,3508 H 795 V 4491 H 491 V 3508 H 124 V 3272 H 1162 Z"/><path fill="#555555" stroke="#555555" stroke-width="100" stroke-linejoin="round" transform="translate(50,0)" d="M 2511,4491 h -351 l -254,-401 -258,401 h -335 l 417,-614 -409,-605 h 350 l 245,380 252,-380 h 336 l -411,593 z"/><path fill="#555555" stroke="#555555" stroke-width="100" stroke-linejoin="round" transform="translate(100,0)" d="M 3701,3508 h -367 v 983 h -304 v -983 h -367 v -236 h 1038 z"/></g></svg>';
      const txtDataUri = `data:image/svg+xml;base64,${btoa(txtSvg)}`;
      const wordDataUri = wordSvg
        ? `data:image/svg+xml;base64,${btoa(wordSvg)}`
        : '';
      const excelDataUri = excelSvg
        ? `data:image/svg+xml;base64,${btoa(excelSvg)}`
        : '';
      const powerpointDataUri = powerpointSvg
        ? `data:image/svg+xml;base64,${btoa(powerpointSvg)}`
        : '';
      const svgFileDataUri = svgFileSvg
        ? `data:image/svg+xml;base64,${btoa(svgFileSvg)}`
        : '';
      const dbDataUri = `data:image/svg+xml;base64,${btoa(dbSvg)}`;
      // Selected-row variant. The file browser paints --jp-brand-color1 behind a
      // selected item (#2196f3 dark, #1976d2 light) and the blue cylinder measures
      // only 1.07:1 against it - it disappears into the highlight. JupyterLab
      // handles this for its own icons with
      // `.jp-mod-selected .jp-icon-selectable[fill] { fill: #fff }`, which a
      // background-image cannot inherit, so swap in a white recolour of the same
      // artwork instead (3.12:1 on dark, 4.60:1 on light).
      const dbSelectedDataUri = `data:image/svg+xml;base64,${btoa(
        dbSvg.replace(/#5890ca/g, '#ffffff')
      )}`;
      const uvSvg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 330 330"><rect height="100%" width="100%" rx="66" fill="#26102f"/><path fill="#d256dc" d="M 65,65 h92 v130 h16 v-130 h92 v200 h-16 v-20 h-8 a20,20 0 0 1 -20,20 h-136 a20,20 0 0 1 -20,-20 z"/></svg>';
      const uvDataUri = `data:image/svg+xml;base64,${btoa(uvSvg)}`;
      const pytestSvg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 474 542"><path fill="#696969" d="M21,43h431c12,0 21,9 21,21c0,12-9,21-21,21H21c-12,0-21-9-21-21c0-12,9-21,21-21z"/><path fill="#009fe3" d="M25,0h87v20H25z"/><path fill="#c7d302" d="M138,0h87v20h-87z"/><path fill="#f07e16" d="M250,0h87v20h-87z"/><path fill="#df2815" d="M362,0h87v20h-87z"/><path fill="#df2815" d="M362,107h87v147h-87z"/><path fill="#f07e16" d="M250,107h87v238h-87z"/><path fill="#c7d302" d="M138,107h87v357h-87z"/><path fill="#009fe3" d="M25,107h87v435h-87z"/></svg>';
      const pytestDataUri = `data:image/svg+xml;base64,${btoa(pytestSvg)}`;
      const pythonPackageSvg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="ppa" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0" stop-color="#387eb8"/><stop offset="1" stop-color="#366994"/></linearGradient><linearGradient id="ppb" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0" stop-color="#ffe052"/><stop offset="1" stop-color="#ffc331"/></linearGradient></defs><g transform="scale(-1,1) translate(-32,0)"><path d="M27.4,5.5H18.1L16,9.7H4.3V26.5H29.5V5.5Zm0,4.2H19.2l1.1-2.1h7.1Z" fill="#58af7b"/><path d="M20.9,11c-5.1,0-4.8,2.2-4.8,2.2v2.3H21v.7H14.2S11,15.8,11,21s2.9,5,2.9,5h1.7V23.6a2.7,2.7,0,0,1,2.8-2.9h4.8a2.6,2.6,0,0,0,2.7-2.6V13.7S26.2,11,20.9,11Zm-2.7,1.5a.9.9,0,1,1-.8.9.9.9,0,0,1,.8-.9Z" fill="url(#ppa)"/><path d="M21.1,31c5.1,0,4.8-2.2,4.8-2.2V26.5H21v-.7h6.8S31,26.1,31,21s-2.9-5-2.9-5h-1.7v2.4a2.7,2.7,0,0,1-2.8,2.9H18.8a2.6,2.6,0,0,0-2.7,2.6v4.4S15.7,31,21,31Zm2.7-1.5a.9.9,0,1,1,.8-.9.9.9,0,0,1-.8.9Z" fill="url(#ppb)"/></g></svg>';
      const pythonPackageDataUri = `data:image/svg+xml;base64,${btoa(pythonPackageSvg)}`;
      const venvSvg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g transform="scale(-1,1) translate(-32,0)"><path d="M27.4,5.5H18.1L16,9.7H4.3V26.5H29.5V5.5Zm0,4.2H19.2l1.1-2.1h7.1Z" fill="#9575cd"/><g transform="translate(22,22) scale(1.25)" fill="#bababa"><path d="M-1.2,-6 L1.2,-6 L1.5,-4.5 L2.8,-4 L4,-5 L5.5,-3.5 L4.5,-2.3 L5,-1 L6.5,-0.8 L6.5,1.2 L5,1.5 L4.5,2.8 L5.5,4 L4,5.5 L2.8,4.5 L1.5,5 L1.2,6.5 L-1.2,6.5 L-1.5,5 L-2.8,4.5 L-4,5.5 L-5.5,4 L-4.5,2.8 L-5,1.5 L-6.5,1.2 L-6.5,-0.8 L-5,-1 L-4.5,-2.3 L-5.5,-3.5 L-4,-5 L-2.8,-4 L-1.5,-4.5 Z"/><circle cx="0" cy="0" r="2.5" fill="#9575cd"/></g></g></svg>';
      const venvDataUri = `data:image/svg+xml;base64,${btoa(venvSvg)}`;
      // Src/test folder icons: dark mode (light glyphs) and light mode (black glyphs)
      const srcFolderDarkSvg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g transform="scale(-1,1) translate(-32,0)"><path d="M27.4,5.5H18.1L16,9.7H4.3V26.5H29.5V5.5Zm0,4.2H19.2l1.1-2.1h7.1Z" fill="#2979b8"/><g transform="translate(22,22) scale(1.25)" fill="none" stroke="#d4d4d4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="-4,-4 -7,0 -4,4"/><polyline points="4,-4 7,0 4,4"/></g></g></svg>';
      const srcFolderDarkDataUri = `data:image/svg+xml;base64,${btoa(srcFolderDarkSvg)}`;
      const srcFolderLightSvg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g transform="scale(-1,1) translate(-32,0)"><path d="M27.4,5.5H18.1L16,9.7H4.3V26.5H29.5V5.5Zm0,4.2H19.2l1.1-2.1h7.1Z" fill="#2979b8"/><g transform="translate(22,22) scale(1.25)" fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="-4,-4 -7,0 -4,4"/><polyline points="4,-4 7,0 4,4"/></g></g></svg>';
      const srcFolderLightDataUri = `data:image/svg+xml;base64,${btoa(srcFolderLightSvg)}`;
      const testFolderDarkSvg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g transform="scale(-1,1) translate(-32,0)"><path d="M27.4,5.5H18.1L16,9.7H4.3V26.5H29.5V5.5Zm0,4.2H19.2l1.1-2.1h7.1Z" fill="#c07818"/><g transform="translate(22,22) scale(1.25)" fill="none" stroke="#d4d4d4" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="-5,0 -2,4 5,-4"/></g></g></svg>';
      const testFolderDarkDataUri = `data:image/svg+xml;base64,${btoa(testFolderDarkSvg)}`;
      const testFolderLightSvg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g transform="scale(-1,1) translate(-32,0)"><path d="M27.4,5.5H18.1L16,9.7H4.3V26.5H29.5V5.5Zm0,4.2H19.2l1.1-2.1h7.1Z" fill="#c07818"/><g transform="translate(22,22) scale(1.25)" fill="none" stroke="#000000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="-5,0 -2,4 5,-4"/></g></g></svg>';
      const testFolderLightDataUri = `data:image/svg+xml;base64,${btoa(testFolderLightSvg)}`;
      // Standalone play glyph for executable overlay (not a full icon replacement)
      const playGlyphSvg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12"><path fill="#00e676" stroke="#1b5e20" stroke-width="0.5" d="M1,0 L11,6 L1,12 Z"/></svg>';
      const playGlyphDataUri = `data:image/svg+xml;base64,${btoa(playGlyphSvg)}`;

      const bpmnDataUri = `data:image/svg+xml;base64,${btoa(bpmnSvg)}`;

      // Inject CSS that overrides icons for .py and .md files
      // Note: Jupytext marks .py and .md files with data-file-type="notebook" or
      // "jupytext-notebook-file", so we use [*="notebook"] to match both
      const style = document.createElement('style');
      style.id = 'vscode-icons-jupytext-override';
      style.textContent = `
        /* Override Python file icons (.py files shown as notebooks by Jupytext) */
        .jp-DirListing-item[data-file-type*="notebook"][data-jupytext-py] .jp-DirListing-itemIcon svg,
        .jp-DirListing-item[data-file-type*="notebook"][data-jupytext-py] .jp-DirListing-itemIcon img:not(.vscode-exec-badge) {
          display: none !important;
        }
        .jp-DirListing-item[data-file-type*="notebook"][data-jupytext-py] .jp-DirListing-itemIcon::before {
          content: '';
          display: inline-block;
          width: calc(var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5));
          height: calc(var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5));
          background-image: url('${pythonDataUri}');
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
        }

        /* Override Markdown file icons (.md files shown as notebooks by Jupytext) with JupyterLab native markdown icon */
        .jp-DirListing-item[data-file-type*="notebook"][data-jupytext-md] .jp-DirListing-itemIcon svg,
        .jp-DirListing-item[data-file-type*="notebook"][data-jupytext-md] .jp-DirListing-itemIcon img:not(.vscode-exec-badge) {
          display: none !important;
        }
        .jp-DirListing-item[data-file-type*="notebook"][data-jupytext-md] .jp-DirListing-itemIcon::before {
          content: '';
          display: inline-block;
          width: calc(var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5));
          height: calc(var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5));
          background-image: url('${markdownDataUri}');
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
        }

        /* Override CLAUDE.md file icon with VSCode Claude icon (Claude orange/coral color #c77c5e) */
        .jp-DirListing-item[data-file-type*="notebook"][data-claude-md] .jp-DirListing-itemIcon svg,
        .jp-DirListing-item[data-file-type*="notebook"][data-claude-md] .jp-DirListing-itemIcon img:not(.vscode-exec-badge) {
          display: none !important;
        }
        .jp-DirListing-item[data-file-type*="notebook"][data-claude-md] .jp-DirListing-itemIcon::before {
          content: '';
          display: inline-block;
          width: calc(var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5));
          height: calc(var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5));
          background-image: url('${claudeDataUri}');
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
          filter: brightness(0) saturate(100%) invert(64%) sepia(35%) saturate(647%) hue-rotate(327deg) brightness(91%) contrast(87%);
        }

        /* Override README.md file icon with custom info icon */
        .jp-DirListing-item[data-file-type*="notebook"][data-readme-md] .jp-DirListing-itemIcon svg,
        .jp-DirListing-item[data-file-type*="notebook"][data-readme-md] .jp-DirListing-itemIcon img:not(.vscode-exec-badge) {
          display: none !important;
        }
        .jp-DirListing-item[data-file-type*="notebook"][data-readme-md] .jp-DirListing-itemIcon {
          display: flex !important;
          justify-content: center !important;
          align-items: center !important;
        }
        .jp-DirListing-item[data-file-type*="notebook"][data-readme-md] .jp-DirListing-itemIcon::before {
          content: '';
          display: block;
          width: calc(var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5));
          height: calc(var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5));
          background-image: url('${readmeDataUri}');
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
        }

        /* Override PDF file icon with VSCode PDF icon */
        .jp-DirListing-item[data-vscode-pdf] .jp-DirListing-itemIcon svg,
        .jp-DirListing-item[data-vscode-pdf] .jp-DirListing-itemIcon img:not(.vscode-exec-badge) {
          display: none !important;
        }
        .jp-DirListing-item[data-vscode-pdf] .jp-DirListing-itemIcon::before {
          content: '';
          display: inline-block;
          width: calc(var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5));
          height: calc(var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5));
          background-image: url('${pdfDataUri}');
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
        }

        /* Override database file icons with a single VSCode database cylinder.
           jupyterlab_tabular_data_viewer_extension claims .db/.db3/.sqlite/.sqlite3
           with an icon and an iconClass. LabIcon drops the iconClass whenever the
           icon resolves, so that viewer renders an svg child and no background:
           clearing the background here is a guard against an iconClass-only
           provider, not a live fix. */
        .jp-DirListing-item[data-vscode-db] .jp-DirListing-itemIcon {
          background-image: none !important;
        }
        .jp-DirListing-item[data-vscode-db] .jp-DirListing-itemIcon svg,
        .jp-DirListing-item[data-vscode-db] .jp-DirListing-itemIcon img:not(.vscode-exec-badge) {
          display: none !important;
        }
        .jp-DirListing-item[data-vscode-db] .jp-DirListing-itemIcon::before {
          content: '';
          display: inline-block;
          width: calc(var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5));
          height: calc(var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5));
          background-image: url('${dbDataUri}');
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
        }
        .jp-DirListing-item[data-vscode-db].jp-mod-selected
          .jp-DirListing-itemIcon::before {
          background-image: url('${dbSelectedDataUri}');
        }

        /* File browser rows whose icon JupyterLab supplied and this extension
           replaces. The glyph is an inline background-image set per row by
           markRowIcons; these rules size it and hide what is underneath. The
           selector carries one class more than the jupytext hotfix rule that
           forces icon children visible, so it wins on specificity. */
        .jp-DirListing-item .jp-DirListing-itemIcon[data-vscode-row-icon] {
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
        }
        /* The svg is hidden with visibility, not display, and that is
           load-bearing. JupyterLab 4.6.4 makes the row itself
           display: inline-grid with grid-auto-columns max-content, which makes
           the flex basis of 20px its own stylesheet puts on the host inert: the
           host is as wide as its in-flow children, so removing the svg from
           flow collapses it and the background paints nothing. Keeping the svg
           in flow and merely invisible keeps its 16px box. On this workstation
           the host measures 20 x 19.5 either way, but only because
           jupyterlab_change_ui_font_size_fix sets the row to display: flex;
           that is one installed extension, not a property of JupyterLab. The
           Galata test 'a painted row has a box the background can fill' is the
           guard. The tab host has no in-flow child to size it once its svg is
           hidden, which is why the tab rule below supplies a height. */
        .jp-DirListing-item .jp-DirListing-itemIcon[data-vscode-row-icon] > svg,
        .jp-DirListing-item
          .jp-DirListing-itemIcon[data-vscode-row-icon]
          > img:not(.vscode-exec-badge) {
          visibility: hidden !important;
        }
        /* Document tab icons. The glyph is an inline background-image set per
           tab by markTabIcons; these two rules only size it and hide the icon
           JupyterLab renders underneath. One pair of rules serves every file
           type, so the stylesheet does not carry a copy of each icon. */
        /* A painted tab glyph is vendor artwork drawn for VSCode's dark sidebar,
           and some of it is invisible on a JupyterLab tab bar: measured in the
           running lab, the yaml wordmark's best pixel is 1.20:1 against a white
           tab. The same artwork is excellent on the dark bar (13:1), so this is
           not a per-glyph list but a per-theme test the painter runs - it sets
           data-vscode-tab-outline when the artwork cannot clear 3:1 against the
           bar it is about to sit on, and this rule gives those glyphs an edge.
           Measured with it: 19.69:1 best, 16.5% of the box at or above 3:1, and the
           artwork's own colours are untouched (DEF-COLOUR-32). */
        /* One rule for both painted hosts: the row marker and the tab marker
           are decided by the same measure and want the same edge. */
        .jp-DirListing-itemIcon[data-vscode-row-outline],
        .lm-TabBar-tabIcon[data-vscode-tab-outline] {
          filter: drop-shadow(0.5px 0 0 var(--jp-ui-font-color1, #212121))
            drop-shadow(-0.5px 0 0 var(--jp-ui-font-color1, #212121))
            drop-shadow(0 0.5px 0 var(--jp-ui-font-color1, #212121))
            drop-shadow(0 -0.5px 0 var(--jp-ui-font-color1, #212121));
        }
        .lm-TabBar-tabIcon[data-vscode-tab-icon] {
          /* JupyterLab gives this host no height and lets the inline svg size
             it; that svg is hidden below, so without a height the box is 14x0
             and the background paints nothing at all. */
          height: 16px;
        }
        /* Lab sizes this host at 14px through a three-class selector while its
           own tab icons are inline svgs at their intrinsic 16px, so a painted
           tab sat 2px short of a stock one (DEF-TABS-33-1). The maintainer
           asked for padding rather than scaling: the box grows to 16px and the
           glyph keeps the 14px lab draws it at, centred in the new box. That
           matches the ink, because lab's own 16px svgs carry their own internal
           padding, and 16+2 keeps the label exactly where 14+4 put it. These
           selectors carry one attribute more than lab's, so they win. */
        .lm-DockPanel-tabBar
          .lm-TabBar-tab
          .lm-TabBar-tabIcon[data-vscode-tab-icon],
        .lm-TabPanel-tabBar
          .lm-TabBar-tab
          .lm-TabBar-tabIcon[data-vscode-tab-icon] {
          width: 16px;
          margin-right: 2px;
          background-position: center;
        }
        .lm-TabBar-tabIcon[data-vscode-tab-icon] > svg {
          display: none !important;
        }

        /* Override TXT file icon with custom document icon */
        .jp-DirListing-item[data-vscode-txt] .jp-DirListing-itemIcon svg,
        .jp-DirListing-item[data-vscode-txt] .jp-DirListing-itemIcon img:not(.vscode-exec-badge) {
          display: none !important;
        }
        .jp-DirListing-item[data-vscode-txt] .jp-DirListing-itemIcon::before {
          content: '';
          display: inline-block;
          width: calc(
            var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5)
          );
          height: calc(
            var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5)
          );
          background-image: url('${txtDataUri}');
          /* The text sheet is full-bleed where the pdf and svg glyphs are not,
             so it reads large beside them. The sheet is taller than it is wide
             (viewBox 3800x4800), so the 85% goes on the HEIGHT and the width
             follows: a single-value background-size sets the width and leaves the
             height auto, which made the glyph 7% larger than before and clipped
             it top and bottom. The box stays at the shared scale either way, so
             every override row keeps one width and one label indent. */
          background-size: auto 85%;
          background-repeat: no-repeat;
          background-position: center;
        }

        /* Override Word file icon with VSCode Word icon */
        .jp-DirListing-item[data-vscode-word] .jp-DirListing-itemIcon svg,
        .jp-DirListing-item[data-vscode-word] .jp-DirListing-itemIcon img:not(.vscode-exec-badge) {
          display: none !important;
        }
        .jp-DirListing-item[data-vscode-word] .jp-DirListing-itemIcon::before {
          content: '';
          display: inline-block;
          width: calc(var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5));
          height: calc(var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5));
          background-image: url('${wordDataUri}');
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
        }

        /* Override Excel file icon with VSCode Excel icon */
        .jp-DirListing-item[data-vscode-excel] .jp-DirListing-itemIcon svg,
        .jp-DirListing-item[data-vscode-excel] .jp-DirListing-itemIcon img:not(.vscode-exec-badge) {
          display: none !important;
        }
        .jp-DirListing-item[data-vscode-excel] .jp-DirListing-itemIcon::before {
          content: '';
          display: inline-block;
          width: calc(var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5));
          height: calc(var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5));
          background-image: url('${excelDataUri}');
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
        }

        /* Override PowerPoint file icon with VSCode PowerPoint icon */
        .jp-DirListing-item[data-vscode-powerpoint] .jp-DirListing-itemIcon svg,
        .jp-DirListing-item[data-vscode-powerpoint] .jp-DirListing-itemIcon img:not(.vscode-exec-badge) {
          display: none !important;
        }
        .jp-DirListing-item[data-vscode-powerpoint] .jp-DirListing-itemIcon::before {
          content: '';
          display: inline-block;
          width: calc(var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5));
          height: calc(var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5));
          background-image: url('${powerpointDataUri}');
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
        }

        /* Override any incorrect file type detection for SVG files */
        .jp-DirListing-item[data-vscode-svg-override] .jp-DirListing-itemIcon svg,
        .jp-DirListing-item[data-vscode-svg-override] .jp-DirListing-itemIcon img:not(.vscode-exec-badge) {
          display: none !important;
        }
        .jp-DirListing-item[data-vscode-svg-override] .jp-DirListing-itemIcon::before {
          content: '';
          display: inline-block;
          width: calc(var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5));
          height: calc(var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5));
          background-image: url('${svgFileDataUri}');
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
        }

        /* Override the .bpmn icon with this extension's process mark.
           jupyterlab_camunda_modeller_extension registers .bpmn with its own
           rounded-square LabIcon, which is a specific icon, so neither
           markRowIcons nor docRegistry ordering displaces it - this ::before
           does. The maintainer's decision, in his words: "we use ours". */
        .jp-DirListing-item[data-vscode-bpmn] .jp-DirListing-itemIcon svg,
        .jp-DirListing-item[data-vscode-bpmn] .jp-DirListing-itemIcon img:not(.vscode-exec-badge) {
          display: none !important;
        }
        .jp-DirListing-item[data-vscode-bpmn] .jp-DirListing-itemIcon::before {
          content: '';
          display: inline-block;
          width: calc(var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5));
          height: calc(var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5));
          background-image: url('${bpmnDataUri}');
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
        }

        /* Override uv.lock file icon with UV icon */
        .jp-DirListing-item[data-uv-lock] .jp-DirListing-itemIcon svg,
        .jp-DirListing-item[data-uv-lock] .jp-DirListing-itemIcon img:not(.vscode-exec-badge) {
          display: none !important;
        }
        .jp-DirListing-item[data-uv-lock] .jp-DirListing-itemIcon::before {
          content: '';
          display: inline-block;
          width: calc(var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5));
          height: calc(var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5));
          background-image: url('${uvDataUri}');
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
        }

        /* Override pytest-related file icons */
        .jp-DirListing-item[data-pytest] .jp-DirListing-itemIcon svg,
        .jp-DirListing-item[data-pytest] .jp-DirListing-itemIcon img:not(.vscode-exec-badge) {
          display: none !important;
        }
        .jp-DirListing-item[data-pytest] .jp-DirListing-itemIcon::before {
          content: '';
          display: inline-block;
          width: calc(var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5));
          height: calc(var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5));
          background-image: url('${pytestDataUri}');
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
        }

        /* Override Python package folder icons */
        .jp-DirListing-item[data-python-package] .jp-DirListing-itemIcon svg,
        .jp-DirListing-item[data-python-package] .jp-DirListing-itemIcon img:not(.vscode-exec-badge) {
          display: none !important;
        }
        .jp-DirListing-item[data-python-package] .jp-DirListing-itemIcon::before {
          content: '';
          display: inline-block;
          width: calc(var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5));
          height: calc(var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5));
          background-image: url('${pythonPackageDataUri}');
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
        }

        /* Override venv folder icons (.venv, venv, .env, env) */
        .jp-DirListing-item[data-venv-folder] .jp-DirListing-itemIcon svg,
        .jp-DirListing-item[data-venv-folder] .jp-DirListing-itemIcon img:not(.vscode-exec-badge) {
          display: none !important;
        }
        .jp-DirListing-item[data-venv-folder] .jp-DirListing-itemIcon::before {
          content: '';
          display: inline-block;
          width: calc(var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5));
          height: calc(var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5));
          background-image: url('${venvDataUri}');
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
        }

        /* Override src folder icons - dark mode (light glyphs) */
        .jp-DirListing-item[data-src-folder] .jp-DirListing-itemIcon svg,
        .jp-DirListing-item[data-src-folder] .jp-DirListing-itemIcon img:not(.vscode-exec-badge) {
          display: none !important;
        }
        .jp-DirListing-item[data-src-folder] .jp-DirListing-itemIcon::before {
          content: '';
          display: inline-block;
          width: calc(var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5));
          height: calc(var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5));
          background-image: url('${srcFolderDarkDataUri}');
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
        }
        /* src folder - light mode (black glyphs) */
        body[data-jp-theme-light="true"] .jp-DirListing-item[data-src-folder] .jp-DirListing-itemIcon::before {
          background-image: url('${srcFolderLightDataUri}');
        }

        /* Override test folder icons - dark mode (light glyphs) */
        .jp-DirListing-item[data-test-folder] .jp-DirListing-itemIcon svg,
        .jp-DirListing-item[data-test-folder] .jp-DirListing-itemIcon img:not(.vscode-exec-badge) {
          display: none !important;
        }
        .jp-DirListing-item[data-test-folder] .jp-DirListing-itemIcon::before {
          content: '';
          display: inline-block;
          width: calc(var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5));
          height: calc(var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5));
          background-image: url('${testFolderDarkDataUri}');
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
        }
        /* test folder - light mode (black glyphs) */
        body[data-jp-theme-light="true"] .jp-DirListing-item[data-test-folder] .jp-DirListing-itemIcon::before {
          background-image: url('${testFolderLightDataUri}');
        }

        /* Universal executable overlay - small play glyph badge on any executable file */
        .jp-DirListing-itemIcon {
          position: relative;
          overflow: visible;
        }
        .vscode-exec-badge {
          position: absolute !important;
          bottom: -2px;
          right: 0px;
          width: calc(var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5) * 0.52);
          height: calc(var(--jp-ui-font-size1, 13px) * var(--jp-custom-icon-scale, 1.5) * 0.52);
          pointer-events: none;
          z-index: 10;
        }
        /* Ensure exec badge is always visible (override other img:display:none rules) */
        .jp-DirListing-itemIcon img.vscode-exec-badge {
          display: block !important;
        }
        .vscode-symlink-badge {
          position: absolute;
          inset: 0;
          background: url('data:image/svg+xml,${encodeURIComponent(symlinkBadgeSvg)}') center / contain no-repeat;
          pointer-events: none;
          z-index: 11;
        }
        .jp-DirListing-item[data-vscode-symlink] .vscode-exec-badge {
          bottom: auto;
          top: -2px;
        }
      `;

      // Add CSS to make JavaScript and .env icons less bright
      style.textContent += `
        /* Reduce brightness of JavaScript and .env icons */
        .jp-DirListing-item[data-file-type="vscode-file-type-js-official"] .jp-DirListing-itemIcon svg,
        .jp-DirListing-item[data-file-type="vscode-file-type-dotenv"] .jp-DirListing-itemIcon svg {
          filter: brightness(0.85) saturate(0.85);
        }

        /* Desaturate and dim npm icons */
        .jp-DirListing-item[data-file-type="vscode-file-type-npm"] .jp-DirListing-itemIcon svg {
          filter: brightness(0.85) saturate(0.75);
        }


        /* The dot-file dimming lives in style/base.css, which is the sheet for
           rules that need no runtime data URI. */
      `;

      let metadataGeneration = 0;
      // The detection for the manifests one listing names, keyed on each
      // manifest's name, stamp and size in that listing. One refresh emits
      // `refreshed` three times (onRunningChanged, cd, refresh) and the
      // observer and startBrowserPass run passes of their own, so the promise
      // is cached, not its result: every pass over the same listing shares one
      // fetch per manifest, and while every read succeeds, a poll that finds
      // the manifests unchanged sends none (DEF-ICONS-69).
      let pythonPackagesCache: {
        key: string;
        packages: Promise<Set<string>>;
      } | null = null;

      // Detect Python packages by parsing pyproject.toml or setup.py
      const detectPythonPackages = (): Promise<Set<string>> => {
        const currentPath = defaultFileBrowser?.model.path || '';

        // Which manifests exist is read from the full listing the browser
        // already holds. The widget's model.items() is narrowed by the name
        // filter, which would hide pyproject.toml and empty the package glyphs,
        // so the unfiltered base FileBrowserModel.items() is read instead. A
        // manifest is fetched only when the listing names it, so a folder
        // without one sends no request (DEF-ICONS-64, DEF-ICONS-69).
        const manifests: Contents.IModel[] = [];
        if (defaultFileBrowser) {
          for (const item of FileBrowserModel.prototype.items.call(
            defaultFileBrowser.model
          )) {
            if (item.name === 'pyproject.toml' || item.name === 'setup.py') {
              manifests.push(item);
            }
          }
        }
        const key = [
          currentPath,
          ...manifests.map(m => `${m.name}@${m.last_modified}@${m.size}`)
        ].join('\n');
        if (pythonPackagesCache?.key === key) {
          return pythonPackagesCache.packages;
        }

        let failed = false;
        const packages = Promise.all(
          manifests.map(async manifest => {
            try {
              const file = await app.serviceManager.contents.get(manifest.path);
              const content = file.content as string;
              return await packageNamesFromManifest(
                content,
                manifest.name === 'pyproject.toml' ? 'toml' : 'python',
                `${manifest.path}@${file.last_modified ?? ''}@${content.length}`
              );
            } catch {
              failed = true;
              return new Set<string>();
            }
          })
        ).then(sets => {
          // A failed read drops the whole entry, so the next pass reads every
          // manifest this listing names again, the readable ones included
          // (DEF-ICONS-72)
          if (failed && pythonPackagesCache?.key === key) {
            pythonPackagesCache = null;
          }
          const names = new Set<string>();
          sets.forEach(set => set.forEach(name => names.add(name)));
          return names;
        });
        pythonPackagesCache = { key, packages };
        return packages;
      };

      // Detect executable files from the listing the browser already holds,
      // the way markSymlinkBadges reads link state: the server marks every
      // entry of the directory model, so no request and no cache are needed.
      const detectExecutables = (): Set<string> => {
        if (!settings.enableExecutableIcons) {
          return new Set<string>();
        }

        const executables = new Set<string>();
        for (const item of defaultFileBrowser?.model.items() ?? []) {
          if ((item as IListedItem).executable) {
            executables.add(item.name);
          }
        }
        return executables;
      };

      // A new generation on each listing retires a markSpecialFiles pass still
      // awaiting the previous listing's manifests
      if (defaultFileBrowser) {
        defaultFileBrowser.model.pathChanged.connect(() => {
          ++metadataGeneration;
        });
        defaultFileBrowser.model.refreshed.connect(() => {
          ++metadataGeneration;
          void markSpecialFiles();
        });
      }

      // The link fact rides in the listing the file browser already fetched:
      // the server's contents manager marks every entry, so this pass reads
      // model.items and never asks the server.
      const markSymlinkBadges = (): void => {
        if (!defaultFileBrowser) {
          return;
        }
        const names = new Set<string>();
        for (const item of defaultFileBrowser.model.items()) {
          if ((item as IListedItem).symlink) {
            names.add(item.name);
          }
        }
        defaultFileBrowser.node
          .querySelectorAll('.jp-DirListing-item')
          .forEach(row => {
            const name = row.querySelector(
              '.jp-DirListing-itemText'
            )?.textContent;
            const host = row.querySelector('.jp-DirListing-itemIcon');
            const existing = host?.querySelector('.vscode-symlink-badge');
            if (name && names.has(name) && host) {
              row.setAttribute('data-vscode-symlink', 'true');
              if (!existing) {
                const badge = document.createElement('span');
                badge.className = 'vscode-symlink-badge';
                badge.setAttribute('role', 'img');
                badge.setAttribute('aria-label', 'Symbolic link');
                host.appendChild(badge);
              }
            } else {
              row.removeAttribute('data-vscode-symlink');
              existing?.remove();
            }
          });
      };
      if (defaultFileBrowser) {
        // A path change swaps model.items for the new directory before either
        // signal fires, so both triggers repaint from the current listing.
        defaultFileBrowser.model.pathChanged.connect(markSymlinkBadges);
        defaultFileBrowser.model.refreshed.connect(markSymlinkBadges);
      }

      // Add a MutationObserver to mark special files in the file browser
      // Which settings group owns each name-based override. The ::before blocks
      // these attributes drive are the older painting path and read no settings
      // of their own, so a group switched off left its artwork on the row with
      // JupyterLab's own glyph still hidden underneath (DEF-CONFIG-22). The four
      // folder attributes are not in the map: a folder is not a file-icon
      // family and no toggle names one.
      const overrideGroups: Record<string, keyof IIconSettings> = {
        'data-claude-md': 'enableDocIcons',
        'data-readme-md': 'enableDocIcons',
        'data-jupytext-md': 'enableDocIcons',
        'data-jupytext-py': 'enableLanguageIcons',
        'data-vscode-pdf': 'enableDocIcons',
        'data-vscode-word': 'enableDocIcons',
        'data-vscode-excel': 'enableDocIcons',
        'data-vscode-powerpoint': 'enableDocIcons',
        'data-vscode-txt': 'enableDocIcons',
        'data-vscode-db': 'enableDataIcons',
        'data-vscode-svg-override': 'enableImageIcons',
        'data-uv-lock': 'enableConfigIcons',
        'data-pytest': 'enableConfigIcons',
        'data-vscode-bpmn': 'enableConfigIcons'
      };

      // A name another extension registered wins over this extension's claim by
      // extension - the longest-extension rule puts requirements.native.txt
      // under its type where the config pattern ^requirements([_-].*?)?\.txt$
      // does not reach it. Its icon is the row's, so no ::before artwork is
      // painted over it. The row painter asks the same question of the rendered
      // svg; this pass runs before the row has one, so it asks the registry.
      // .bpmn is the one name this extension outranks by the maintainer's
      // ruling, verbatim "we use ours", so the camunda modeller's tile does not
      // take it.
      const claimedByAnotherExtension = (
        name: string,
        item: Element
      ): boolean => {
        if (name.toLowerCase().endsWith('.bpmn')) {
          return false;
        }
        const typeName = item.getAttribute('data-file-type');
        if (!typeName) {
          return false;
        }
        const type = docRegistry.getFileType(typeName);
        if (!type || isOwnType(type)) {
          return false;
        }
        const owner = ((type.icon as any)?.name as string) || '';
        // JupyterLab's own types are the ones this extension paints over.
        return !!owner && !owner.startsWith('ui-components:');
      };

      const setOverride = (item: Element, attribute: string): void => {
        const group = overrideGroups[attribute];
        const name = item.querySelector('.jp-DirListing-itemText')?.textContent;
        if (
          (group && !settings[group]) ||
          (group && name && disabledExplicitOwner(name)) ||
          (group && name && claimedByAnotherExtension(name, item))
        ) {
          return;
        }
        item.setAttribute(attribute, 'true');
      };

      // The pass splits in two because one of its decisions needs the server.
      // markSpecialFilesPass does the DOM work; `fetched` carries the python
      // packages once the manifest round-trips have answered and is null on
      // the pass that runs before them, which clears the python-package marker
      // so that a reused row cannot carry it. The executable flags ride the
      // listing, so every pass has them.
      const markSpecialFilesPass = (fetched: {
        pythonPackages: Set<string> | null;
        executables: Set<string>;
      }) => {
        const pythonPackages = fetched.pythonPackages;
        const executables = fetched.executables;

        // Process ALL items - clear wrong attributes and set correct ones
        const allItems = document.querySelectorAll('.jp-DirListing-item');
        allItems.forEach(item => {
          const nameSpan = item.querySelector(
            '.jp-DirListing-itemText'
          ) as HTMLElement;
          const fileType = item.getAttribute('data-file-type');

          if (!nameSpan || !nameSpan.textContent || !fileType) {
            return;
          }

          const name = nameSpan.textContent;

          // Handle notebook files (Jupytext marks them as "notebook" or "jupytext-notebook-file")
          const isNotebookType =
            fileType === 'notebook' || fileType === 'jupytext-notebook-file';
          if (isNotebookType) {
            // Clear all notebook attributes first
            item.removeAttribute('data-claude-md');
            item.removeAttribute('data-readme-md');
            item.removeAttribute('data-jupytext-py');
            item.removeAttribute('data-jupytext-md');

            // Set the correct attribute based on filename
            if (name === 'CLAUDE.md') {
              setOverride(item, 'data-claude-md');
            } else if (name === 'README.md') {
              setOverride(item, 'data-readme-md');
            } else if (name.endsWith('.py')) {
              setOverride(item, 'data-jupytext-py');
            } else if (name.endsWith('.md')) {
              setOverride(item, 'data-jupytext-md');
            }
          } else {
            // Not a notebook - clear notebook attributes
            item.removeAttribute('data-claude-md');
            item.removeAttribute('data-readme-md');
            item.removeAttribute('data-jupytext-py');
            item.removeAttribute('data-jupytext-md');
          }

          // Handle PDF and Office files by extension (override native JupyterLab icons)
          const nameLower = name.toLowerCase();

          // Clear all office/pdf/txt attributes first
          item.removeAttribute('data-vscode-pdf');
          item.removeAttribute('data-vscode-word');
          item.removeAttribute('data-vscode-excel');
          item.removeAttribute('data-vscode-powerpoint');
          item.removeAttribute('data-vscode-txt');
          item.removeAttribute('data-vscode-db');

          // Set the correct attribute based on extension
          if (nameLower.endsWith('.pdf')) {
            setOverride(item, 'data-vscode-pdf');
          } else if (
            nameLower.endsWith('.doc') ||
            nameLower.endsWith('.docx')
          ) {
            setOverride(item, 'data-vscode-word');
          } else if (
            nameLower.endsWith('.xls') ||
            nameLower.endsWith('.xlsx') ||
            nameLower.endsWith('.xlsm')
          ) {
            setOverride(item, 'data-vscode-excel');
          } else if (
            nameLower.endsWith('.ppt') ||
            nameLower.endsWith('.pptx')
          ) {
            setOverride(item, 'data-vscode-powerpoint');
          } else if (
            nameLower.endsWith('.txt') &&
            !(fileType || '').startsWith('vscode-')
          ) {
            // DEF-TABS-23-2: a .txt this extension registered under its own
            // file type - requirements.txt takes file-type-python - was getting
            // the generic text sheet painted over that specific icon here. The
            // maintainer's answer, in his words: "python everywhere", so the
            // generic sheet yields to any vscode-* type this extension set.
            setOverride(item, 'data-vscode-txt');
          } else if (
            nameLower.endsWith('.db') ||
            nameLower.endsWith('.db3') ||
            nameLower.endsWith('.sqlite') ||
            nameLower.endsWith('.sqlite3')
          ) {
            setOverride(item, 'data-vscode-db');
          }

          // Force SVG icon for .svg files (override any incorrect file type detection)
          item.removeAttribute('data-vscode-svg-override');
          if (nameLower.endsWith('.svg')) {
            setOverride(item, 'data-vscode-svg-override');
          }

          // Force this extension's mark on .bpmn ahead of the camunda
          // modeller extension's own icon ("we use ours").
          item.removeAttribute('data-vscode-bpmn');
          if (nameLower.endsWith('.bpmn')) {
            setOverride(item, 'data-vscode-bpmn');
          }

          // Force UV icon for uv.lock file
          item.removeAttribute('data-uv-lock');
          if (nameLower === 'uv.lock') {
            setOverride(item, 'data-uv-lock');
          }

          // Force pytest icon for pytest-related files
          item.removeAttribute('data-pytest');
          if (
            nameLower === '.coverage' ||
            nameLower === 'pytest.ini' ||
            nameLower === 'conftest.py'
          ) {
            setOverride(item, 'data-pytest');
          }

          // Mark executable files when the setting is on; the flag rides the
          // listing, so the answer is in hand on every pass and the badge is
          // added or dropped on the spot rather than after the round-trips
          // (DEF-ICONS-37, DEF-ICONS-67).
          const iconContainer = item.querySelector('.jp-DirListing-itemIcon');
          const existingBadge =
            iconContainer?.querySelector('.vscode-exec-badge');
          if (settings.enableExecutableIcons && executables.has(name)) {
            if (iconContainer && !existingBadge) {
              const badge = document.createElement('img');
              badge.className = 'vscode-exec-badge';
              badge.src = playGlyphDataUri;
              badge.alt = 'Executable';
              iconContainer.appendChild(badge);
            }
          } else if (existingBadge) {
            existingBadge.remove();
          }

          // Check if this is a directory (folder)
          const isDir =
            fileType === 'directory' ||
            item.classList.contains('jp-DirListing-directory');
          if (isDir) {
            // Check if folder is a venv folder (.venv, venv, .env, env)
            const venvNames = ['.venv', 'venv', '.env', 'env'];
            const srcNames = ['src', 'lib', 'source'];
            const testNames = [
              'test',
              'tests',
              '__tests__',
              'spec',
              'specs',
              'ui-tests'
            ];
            if (venvNames.includes(nameLower)) {
              item.setAttribute('data-venv-folder', 'true');
              item.removeAttribute('data-python-package');
              item.removeAttribute('data-src-folder');
              item.removeAttribute('data-test-folder');
            } else if (srcNames.includes(nameLower)) {
              item.setAttribute('data-src-folder', 'true');
              item.removeAttribute('data-venv-folder');
              item.removeAttribute('data-python-package');
              item.removeAttribute('data-test-folder');
            } else if (testNames.includes(nameLower)) {
              item.setAttribute('data-test-folder', 'true');
              item.removeAttribute('data-venv-folder');
              item.removeAttribute('data-python-package');
              item.removeAttribute('data-src-folder');
            } else {
              item.removeAttribute('data-venv-folder');
              item.removeAttribute('data-src-folder');
              item.removeAttribute('data-test-folder');
              // Check if folder name matches a detected Python package
              if (pythonPackages) {
                if (pythonPackages.has(name)) {
                  item.setAttribute('data-python-package', 'true');
                } else {
                  item.removeAttribute('data-python-package');
                }
              } else {
                item.removeAttribute('data-python-package');
              }
            }
          } else {
            item.removeAttribute('data-python-package');
            item.removeAttribute('data-venv-folder');
            item.removeAttribute('data-src-folder');
            item.removeAttribute('data-test-folder');
          }
        });
      };

      // Debounce timeout for MutationObserver
      const markSpecialFiles = async () => {
        // The two detectors are per-directory, and a navigation during their
        // round-trips would otherwise paint the previous directory's answers
        // onto the new listing: a folder in /B whose name a manifest in /A
        // declared would take the python-package glyph and keep it, since
        // nothing re-runs until the listing next changes. The observer has
        // already scheduled the pass for the new path, so dropping this one is
        // the whole fix (DEF-ICONS-42).
        const pathAtEntry = defaultFileBrowser?.model.path;
        const generation = metadataGeneration;
        const pythonPackages = await detectPythonPackages();
        if (
          defaultFileBrowser?.model.path !== pathAtEntry ||
          generation !== metadataGeneration
        ) {
          return;
        }
        // Read after the guard, and synchronously: the executable flags come
        // from the model in hand, so only the manifest round-trips above can
        // pair two directories' answers.
        const executables = detectExecutables();
        markSpecialFilesPass({ pythonPackages, executables });
      };

      // Watch for changes in the file browser.
      //
      // markRowIcons runs on the spot: the browser reuses its row nodes, so
      // until it runs a reused row still carries the previous file's marker,
      // its background, and the CSS rule that attribute keys hides the glyph
      // JupyterLab just resolved - a wrong icon beside the new name until the
      // pass runs. It is a querySelectorAll pass with no server
      // call, and it sets attributes and inline styles, which this observer
      // does not watch, so it cannot feed itself.
      //
      // markSpecialFiles then runs in every pass. The listing-keyed promise
      // cache holds it to one read per manifest per listing revision while
      // every read succeeds; after a failed read the next pass reads every
      // listed manifest again (DEF-ICONS-72). When the listing's entry has
      // already resolved it settles in the same microtask checkpoint, so the
      // python-package marker the first pass cleared is back before the frame
      // paints. It runs markRowIcons again
      // afterwards to repaint rows the pass may have re-ordered.
      // markSpecialFiles is not awaited, so the
      // painter actually runs first; it does not read the attributes that pass
      // sets - it re-derives the artwork match itself - so there is no
      // dependency to order. Do not add an await here: that would put the
      // paint behind two round trips, which is the defect DEF-ICONS-31-1
      // removed.
      //
      // The passes run once per animation frame, not once per mutation
      // callback. JupyterLab delivers about one callback per row while it
      // renders a listing - measured, 1,005 callbacks in 59 frames for a
      // 1,000-entry folder - and every pass walks every row, so a pass per
      // callback made opening that folder take 14.4 s against 1.7 s without
      // the extension (DEF-ICONS-70). A frame callback still runs before the
      // frame paints, so a reused row never shows the previous file's glyph.
      let rowPassFrame = 0;
      const runRowPasses = (): void => {
        rowPassFrame = 0;
        // Both halves of the override pass run before the paint, because the
        // browser reuses its row nodes: until they run, a reused row carries
        // the previous file's marker and its ::before artwork while the CSS
        // keyed on that attribute hides the glyph JupyterLab just resolved.
        // Measured before this ran here: a wrong icon for 136 ms on localhost
        // and 717 ms with 150 ms of latency, because the attribute reset sat
        // behind two server round-trips it does not need (DEF-ICONS-31-1).
        markSpecialFilesPass({
          pythonPackages: null,
          executables: detectExecutables()
        });
        markRowIcons();
        markSymlinkBadges();
        // The records queued so far are this pass's own badge writes from a
        // walk that just covered every row: draining them removes the second
        // full sweep the extension was scheduling on itself.
        observer.takeRecords();
        // The decision that needs the manifests: the python-package folder
        void markSpecialFiles().then(markRowIcons);
      };
      const observer = new MutationObserver(() => {
        if (!rowPassFrame) {
          rowPassFrame = requestAnimationFrame(runRowPasses);
        }
      });

      // Start observing when the file browser is ready. The listing is the
      // only entry point the row painters have, so a single probe that misses
      // it would leave the browser unpainted for the whole session: the pass
      // runs from `app.restored`, which fires once the saved layout is back,
      // and the timer stays as the backstop for a lab that restores before the
      // listing is in the DOM. Both are idempotent - `startBrowserPass` leaves
      // after the first success, and the painters re-mark what is already
      // marked. This mirrors the tab path above.
      let browserPassStarted = false;
      const startBrowserPass = (): boolean => {
        if (browserPassStarted) {
          return true;
        }
        const fileBrowser = document.querySelector('.jp-DirListing-content');
        if (!fileBrowser) {
          return false;
        }
        browserPassStarted = true;
        observer.observe(fileBrowser, {
          childList: true,
          subtree: true,
          // A rename rewrites the label in place - JupyterLab renders the name
          // through a Lumino VirtualText node - and where its own glyph does
          // not change, LabIcon.element returns without touching the DOM. With
          // childList alone neither produces a record, so the row kept the
          // previous name's glyph: measured, renamed.log became renamed.jar
          // and still showed file-type-log.
          characterData: true
        });
        markSpecialFiles();
        markRowIcons();
        // The badge pass is local: it reads the flags off the listing the
        // browser already fetched and repaints rows the listing added since.
        // Asking the server from here cost one request per mutation batch, and
        // this extension's own painters mutate the listing.
        markSymlinkBadges();
        return true;
      };

      void app.restored.then(() => {
        startBrowserPass();
      });
      setTimeout(startBrowserPass, 1000);

      // Document tab icons.
      //
      // A file editor tab carries JupyterLab's own `ui-components:text-editor`
      // glyph: the editor factory sets the title icon, so the icon on the
      // registered file type never reaches the tab. Measured against lab 4.6.4
      // on `babel.config.js`, which the file browser shows with the JavaScript
      // glyph while its tab shows the editor glyph.
      //
      // Priority: a generic icon loses to a specific one. Lab's own glyphs sit
      // in the `ui-components:` namespace and are replaced; an icon from any
      // other namespace is a specific one another extension delivered, and is
      // kept. Only `data-type="document-title"` tabs are touched, so terminals,
      // launchers and panels keep their own icons whatever they are named.
      // The label is the whole name this needs: DocumentRegistry's
      // getFileTypesForPath takes the basename on its first line and matches
      // every pattern and extension against that alone, so the `Path:` line of
      // the tooltip bought nothing - and parsing it depended on an English
      // tooltip, since that string is translated.
      const nameForTab = (tab: Element): string => {
        const label = tab.querySelector('.lm-TabBar-tabLabel');
        return label && label.textContent ? label.textContent : '';
      };

      // The document registry is the same resolver the file browser uses, so
      // asking it is what lets a tab mirror its row: measured, LICENSE mirrors
      // (registry:vscode-license), and so does another extension's icon. A name
      // whose extension JupyterLab itself claims does not mirror - README.md
      // keeps lab's markdown glyph on the tab while its row shows this
      // extension's custom icon - because the specific-icon guard in
      // markTabIcons returns before the registry is asked. A group toggled off
      // is not registered on the next page load, so the registry stops offering
      // its types then - until that reload it still answers while the painters
      // and the ::before path already honour the new value, which is what the
      // refresh alert exists to cover.
      const registryIconFor = (
        path: string
      ): { key: string; svgstr: string; owner: string } | null => {
        try {
          const types = disabledExplicitOwner(path)
            ? [independentFileType(path)]
            : docRegistry.getFileTypesForPath(path);
          for (const type of types) {
            const icon = type.icon as any;
            if (
              icon?.svgstr &&
              type.name !== 'default' &&
              type.name !== 'text'
            ) {
              return {
                key: `registry:${type.name}`,
                svgstr: icon.svgstr,
                owner: icon.name || ''
              };
            }
          }
        } catch {
          // A registry without this lookup must not break the tab bar.
        }
        return null;
      };

      // One resolver for a file browser row and for a document tab. They can
      // still differ for a type JupyterLab claims: the row keeps lab's specific
      // icon and the tab, which only ever gets the generic editor glyph, takes
      // this extension's - sanctioned, and recorded in the rejection of
      // DEF-TABS-19. Both callers ask it only for a
      // slot that holds a generic JupyterLab glyph - a specific icon, whoever
      // supplied it, is kept untouched - so the order here is: hand artwork,
      // then any registered icon outside the ui-components namespace, then the
      // bundled vscode glyph, and abstain if none of those applies. A file
      // editor tab is the one place where a type JupyterLab claims (.md, .py,
      // .json) still reaches the bundled glyph, because the editor factory
      // puts the generic text-editor icon there rather than the type's own.
      // The row paints these six through a ::before override built from
      // hand-written artwork, not from a bundled key, so the tab resolver had no
      // path to them and the two showed different art for the same file. The
      // maintainer's decision is that the row artwork wins, so the tab reads the
      // same constants. Matching follows the same tests markSpecialFiles uses to
      // set the override attributes.
      const rowArtwork: Array<{
        key: string;
        attr: string;
        svg: string;
        matches: (name: string) => boolean;
      }> = [
        {
          key: 'artwork:pdf',
          attr: 'data-vscode-pdf',
          svg: pdfSvg,
          matches: n => n.endsWith('.pdf')
        },
        {
          key: 'artwork:db',
          attr: 'data-vscode-db',
          svg: dbSvg,
          matches: n =>
            n.endsWith('.db') ||
            n.endsWith('.db3') ||
            n.endsWith('.sqlite') ||
            n.endsWith('.sqlite3')
        },
        {
          key: 'artwork:uv',
          attr: 'data-uv-lock',
          svg: uvSvg,
          matches: n => n === 'uv.lock'
        },
        {
          key: 'artwork:pytest',
          attr: 'data-pytest',
          svg: pytestSvg,
          matches: n =>
            n === 'conftest.py' || n === 'pytest.ini' || n === '.coverage'
        },
        {
          key: 'artwork:svg',
          attr: 'data-vscode-svg-override',
          svg: svgFileSvg,
          matches: n => n.endsWith('.svg')
        },
        {
          key: 'artwork:bpmn',
          attr: 'data-vscode-bpmn',
          svg: bpmnSvg,
          matches: n => n.endsWith('.bpmn')
        }
      ];

      // The two glyphs the painters below treat as replaceable: the plain file
      // glyph, and the text-editor glyph a file editor tab gets regardless of
      // file type. A specific icon - JupyterLab's own or another extension's -
      // is left alone by markRowIcons and markTabIcons, because replacing
      // those changed files the maintainer had deliberately left alone.
      //
      // This governs the painters only. markSpecialFiles and the ::before
      // blocks it drives are a separate, older path that overrides by file name
      // with no such test, and they do displace specific icons on purpose:
      // measured, .pdf and .svg replace lab's own glyphs, conftest.py replaces
      // ui-components:python, and .xlsx and .db replace the tabular data
      // viewer's. That artwork is the project's own and is kept deliberately;
      // ACC-ICONS-35 and ACC-CLASH-9 record the exception.
      const labGenericIcons = new Set([
        'ui-components:file',
        'ui-components:text-editor'
      ]);

      const resolveIcon = (
        fileName: string
      ): { key: string; svgstr: string } | null => {
        // The hand artwork is consulted first, ahead of this extension's own
        // registrations: .ini is registered as vscode-file-type-ini and would
        // otherwise win for pytest.ini, painting the bundled INI glyph on the
        // tab while the row painted the pytest bars. The maintainer's decision
        // is that the row artwork wins, and it only wins if it is asked first.
        const lower = fileName.toLowerCase();
        const disabledOwner = disabledExplicitOwner(fileName);
        const artwork =
          !disabledOwner &&
          rowArtwork.find(entry => entry.svg && entry.matches(lower));
        if (artwork) {
          // The row paints this artwork through a ::before that setOverride
          // gates, so the tab has to read the same group or a toggled-off
          // family keeps its artwork on the tab while its row goes bare.
          const artworkGroup = overrideGroups[artwork.attr];
          if (!artworkGroup || settings[artworkGroup]) {
            return { key: artwork.key, svgstr: artwork.svg };
          }
        }

        const registered = registryIconFor(fileName);
        if (registered && !registered.owner.startsWith('ui-components:')) {
          return registered;
        }
        // A JupyterLab-owned registry hit is discarded rather than handed
        // through on purpose. DEF-TABS-19 proposed mirroring it onto the tab
        // and was rejected: copying lab's svg into a data-URI background drops
        // the jp-icon-contrast class that themes it, so the tab would carry a
        // glyph that does not follow the theme.

        if (disabledOwner) {
          return null;
        }
        const iconName = getIconForFile(fileName);
        const group = groupFor(fileName);
        // A family no fileTypeConfigs entry claims - .log, .jar, .class and
        // the rest of the bundled map - has no group of its own, so it cannot
        // follow one toggle. It follows all of them instead: switching every
        // group off leaves stock JupyterLab, which is what the settings
        // promise, while any group on keeps these gap fillers painted.
        const gated = group
          ? settings[group]
          : (Object.keys(settings) as Array<keyof IIconSettings>).some(
              key => key !== 'enableExecutableIcons' && settings[key]
            );
        if (iconName !== 'default-file' && gated) {
          const svgstr = generateIconSVG(iconName);
          // Four mapped keys have no body in the bundled vscode-icons set
          // (file-type-pdf, -lock, -csv, -rst) and getIconSVG substitutes
          // the default-file body for them, so painting this would replace an
          // icon JupyterLab did supply with a blank page.
          if (svgstr !== generateIconSVG('default-file')) {
            return { key: iconName, svgstr };
          }
        }

        // Abstain rather than re-encode an icon JupyterLab rendered. Three of
        // lab's filetype svgs take their colour from document CSS, which a
        // data-URI background cannot reach, so copying one freezes it - vega's
        // baked #212121 is invisible on the dark panel, where lab draws white.
        // Leaving it alone keeps the themed svg the caller already has.
        return null;
      };

      // The icon is painted on the host element rather than written into it:
      // Lumino re-renders a tab's children on every layout change and reverts
      // anything written there, but it leaves the host node, its attributes
      // and its inline style in place.
      const clearTabIcon = (host: HTMLElement): void => {
        if (host.hasAttribute('data-vscode-tab-icon')) {
          host.removeAttribute('data-vscode-tab-icon');
          host.removeAttribute('data-vscode-tab-outline');
          host.style.backgroundImage = '';
        }
      };

      // The glyph is painted as a background image, which the page's
      // stylesheet cannot reach into, so the artwork's own colours decide
      // whether it can be seen. src/contrast.ts holds the measurement and its
      // unit tests; this only resolves the background to measure against.
      const paintTabIcon = (
        host: HTMLElement,
        tab: Element,
        key: string,
        svgstr: string
      ): void => {
        // The outline is decided on every pass, before the key guard below.
        // Deciding it once per key left a tab painted on the dark theme with no
        // outline after a switch to the light one, where the same artwork
        // measures 1.06:1 - the very symptom this rule exists to prevent - and
        // it also froze the measurement to whichever background the tab had
        // when it was first painted, current or inactive.
        if (needsOutlineOn(svgstr, getComputedStyle(tab).backgroundColor)) {
          host.setAttribute('data-vscode-tab-outline', '');
        } else {
          host.removeAttribute('data-vscode-tab-outline');
        }
        if (host.getAttribute('data-vscode-tab-icon') === key) {
          return;
        }
        host.setAttribute('data-vscode-tab-icon', key);
        host.style.backgroundImage = `url("data:image/svg+xml;utf8,${encodeURIComponent(
          svgstr
        )}")`;
      };

      const markTabIcons = (): void => {
        document
          .querySelectorAll('.lm-TabBar-tab[data-type="document-title"]')
          .forEach(tab => {
            const host = tab.querySelector(
              '.lm-TabBar-tabIcon'
            ) as HTMLElement | null;
            if (!host) {
              return;
            }

            const path = nameForTab(tab);
            if (!path) {
              return;
            }
            const fileName = path.split('/').pop() || '';

            const owner = host.querySelector('svg[data-icon]');
            const namespace = owner
              ? owner.getAttribute('data-icon') || ''
              : '';
            const ownPdfArtwork =
              namespace === 'ui-components:pdf' &&
              fileName.toLowerCase().endsWith('.pdf') &&
              settings.enableDocIcons;
            if (
              namespace &&
              !labGenericIcons.has(namespace) &&
              !ownPdfArtwork
            ) {
              // A specific icon is already on the tab - JupyterLab's own or
              // another extension's. PDF is the one exception: its file
              // browser row already uses this extension's artwork.
              clearTabIcon(host);
              return;
            }

            const resolved = resolveIcon(fileName);
            if (resolved) {
              paintTabIcon(host, tab, resolved.key, resolved.svgstr);
              return;
            }

            // Abstaining must also undo any earlier paint on this node: Lumino
            // reuses tab nodes, so a rename, or another extension claiming the
            // type late, would otherwise leave the previous glyph on top of the
            // icon JupyterLab has since rendered.
            clearTabIcon(host);

            // Nothing specific anywhere. A tab still shows an icon. Lab's own
            // fileIcon carries fill #616161, which measures 6.19:1 on a light
            // tab and 2.60:1 on a dark one, so the contrast measure outlines it
            // on dark and leaves it alone on light (DEF-COLOUR-34).
            if (!owner) {
              paintTabIcon(host, tab, 'generic-file', fileIcon.svgstr);
            }
          });
      };

      // File browser rows. Only a row whose icon JupyterLab itself supplied is
      // repainted; one already showing this extension's own registered icon, or
      // another extension's, is left exactly as the registry rendered it. The
      // listing reuses row nodes, so a row that no longer qualifies is cleared
      // rather than left carrying the previous file's glyph.
      // The listing's background, which is what a painted row glyph sits on.
      // The host itself carries no background colour, so the panel's is the
      // honest comparison.
      const rowBackground = (): string => {
        const panel = document.querySelector('.jp-DirListing-content');
        return panel
          ? getComputedStyle(panel).backgroundColor
          : 'rgb(255, 255, 255)';
      };

      const markRowIcons = (): void => {
        // Read once per pass: reading it inside the loop forced a style flush
        // after every row this pass had already painted.
        const background = rowBackground();
        document.querySelectorAll('.jp-DirListing-item').forEach(item => {
          const host = item.querySelector(
            '.jp-DirListing-itemIcon'
          ) as HTMLElement | null;
          const nameSpan = item.querySelector('.jp-DirListing-itemText');
          const clear = (): void => {
            if (host && host.hasAttribute('data-vscode-row-icon')) {
              host.removeAttribute('data-vscode-row-icon');
              host.removeAttribute('data-vscode-row-outline');
              host.style.backgroundImage = '';
            }
          };
          if (!host || !nameSpan || !nameSpan.textContent) {
            return;
          }
          if (item.getAttribute('data-file-type') === 'directory') {
            clear();
            return;
          }

          const fileName = nameSpan.textContent;
          const owner = host.querySelector('svg[data-icon]');
          const ownerName = owner ? owner.getAttribute('data-icon') || '' : '';
          if (ownerName && !labGenericIcons.has(ownerName)) {
            // A specific icon is already on the row - JupyterLab's own or
            // another extension's. Leave it.
            clear();
            return;
          }

          const resolved = resolveIcon(fileName);
          // `registry:` means the row already renders that icon itself, and
          // `artwork:` means a ::before override already paints it - in both
          // cases this pass has nothing to add.
          if (
            !resolved ||
            resolved.key.startsWith('registry:') ||
            resolved.key.startsWith('artwork:')
          ) {
            clear();
            return;
          }
          // The same measure the tab painter runs, for the same reason: this
          // artwork was drawn for VSCode's dark sidebar and some of it cannot
          // be seen on a light listing - measured, file-type-gradle is 1.33:1,
          // file-type-log 2.21:1 and file-type-class 2.93:1 against
          // --jp-layout-color1, where the glyph JupyterLab drew before this
          // painter existed was 6.19:1. The measure reads the artwork's stated
          // colours, so the painted-and-marked set on a white listing is .yaml
          // at 1.23:1, build.gradle at 1.51:1 and .log at 2.54:1;
          // file-type-class states #e76f00, which is 3.15:1, so it is left
          // alone although a 20px render of it measures 2.93:1 - one sample of
          // the gap between stated and rendered colour, not a rule to change.
          // Re-decided on every pass, but a theme change schedules no pass, so
          // a marker stays as the previous theme left it until the listing next
          // mutates - a click in it is enough (DEF-COLOUR-43, DEF-COLOUR-48).
          if (needsOutlineOn(resolved.svgstr, background)) {
            host.setAttribute('data-vscode-row-outline', '');
          } else {
            host.removeAttribute('data-vscode-row-outline');
          }
          if (host.getAttribute('data-vscode-row-icon') === resolved.key) {
            return;
          }
          host.setAttribute('data-vscode-row-icon', resolved.key);
          host.style.backgroundImage = `url("data:image/svg+xml;utf8,${encodeURIComponent(
            resolved.svgstr
          )}")`;
        });
      };

      let markTabIconsTimeout: ReturnType<typeof setTimeout> | null = null;
      const scheduleTabIcons = (): void => {
        if (markTabIconsTimeout) {
          clearTimeout(markTabIconsTimeout);
        }
        markTabIconsTimeout = setTimeout(() => {
          // A split pane creates a new tab bar; pick it up before marking.
          watchTabBars();
          markTabIcons();
        }, 100);
      };

      // `layoutModified` fires when a tab is opened, closed, moved or activated
      // - every event that makes Lumino rebuild a tab node. Watching the dock
      // panel with a MutationObserver instead would fire on every keystroke in
      // an open editor, since the editor content lives in the same subtree.
      const shell = app.shell as any;
      if (shell && shell.layoutModified && shell.layoutModified.connect) {
        shell.layoutModified.connect(scheduleTabIcons);
      }

      // Lumino re-renders a tab's children whenever its title, dirty marker or
      // selection changes, which drops the icon JupyterLab had rendered and
      // puts a fresh one back. The observer re-applies after each of those, and
      // is scoped to the tab bars so editor keystrokes never reach it. New tab
      // bars appear when a pane is split, so the set is refreshed on each run.
      const watchedBars = new WeakSet<Element>();
      const tabObserver = new MutationObserver(scheduleTabIcons);
      const watchTabBars = (): void => {
        document.querySelectorAll('.lm-DockPanel-tabBar').forEach(bar => {
          if (!watchedBars.has(bar)) {
            watchedBars.add(bar);
            // characterData for the same reason as the browser observer: a
            // rename rewrites the tab label in place and leaves the icon host
            // untouched, so a childList-only watch never re-marks the tab.
            tabObserver.observe(bar, {
              childList: true,
              subtree: true,
              characterData: true
            });
          }
        });
      };

      // Tabs restored from the previous session are already in the DOM when
      // this plugin activates, so the first pass cannot wait for a mutation.
      // On a fixed 1000 ms timer alone every restored tab showed the generic
      // editor glyph for about a second before swapping. app.restored resolves
      // once the shell has put the saved layout back; the timer stays as the
      // backstop for the case where it resolves before the tab nodes exist.
      void app.restored.then(() => {
        watchTabBars();
        markTabIcons();
      });
      setTimeout(() => {
        watchTabBars();
        markTabIcons();
      }, 1000);

      // A theme switch changes the background both outline measures are taken
      // against, and it fires nothing the painters already watch: measured,
      // .jp-DirListing-content emitted no mutation records in the 20 seconds
      // after a switch, so a row kept the previous theme's marker until the
      // listing next changed (DEF-COLOUR-48). JupyterLab writes the theme onto
      // the body element, which is the one place a switch is observable, and
      // both painters re-decide their marker above the key guard, so re-running
      // them is enough - neither repaints artwork that has not changed.
      const themeObserver = new MutationObserver(() => {
        markRowIcons();
        markTabIcons();
      });
      themeObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ['data-jp-theme-light', 'data-jp-theme-name']
      });

      // Remove existing override style if present
      const existing = document.getElementById(
        'vscode-icons-jupytext-override'
      );
      if (existing) {
        existing.remove();
      }

      document.head.appendChild(style);
    };

    // Wait for DOM to be ready, then inject CSS
    app.started.then(() => {
      setTimeout(injectIconOverrideCSS, 500);
      // Apply hotfix for jupytext 1.19.1 (re-registers standard file types broken by catch-all pattern)
      applyJupytext1191Hotfix(docRegistry);
    });

    // Default settings
    const settings: IIconSettings = {
      enableLanguageIcons: true,
      enableWebIcons: true,
      enableDataIcons: true,
      enableConfigIcons: true,
      enableDocIcons: true,
      enableImageIcons: true,
      enableExecutableIcons: false
    };

    // Which settings group a file belongs to is resolved from the same two
    // fields registration uses, pattern first and extension second - the order
    // the document registry itself resolves in. Deriving it from the extension
    // alone let every pattern-only config escape its toggle (Dockerfile,
    // .gitignore, yarn.lock, requirements.txt kept painting with their group
    // off) and sent package.json to the data group while its registration
    // followed the config group.
    const groupMatchers = fileTypeConfigs.map(config => ({
      re: config.pattern ? new RegExp(config.pattern) : null,
      exts: config.extensions.map(ext => ext.toLowerCase()),
      group: config.group
    }));

    const groupFor = (fileName: string): keyof IIconSettings | null => {
      const lower = fileName.toLowerCase();
      for (const matcher of groupMatchers) {
        if (matcher.re && matcher.re.test(fileName)) {
          return matcher.group;
        }
      }
      for (const matcher of groupMatchers) {
        if (matcher.exts.some(ext => lower.endsWith(ext))) {
          return matcher.group;
        }
      }
      return null;
    };

    // Mark registration objects, since LabIcon instances can be shared by
    // another extension registering the same icon name.
    const ownRegistration = Symbol('vscode-icons-registration');
    const registerFileType = (
      options: Parameters<typeof docRegistry.addFileType>[0]
    ) => {
      const tagged = { ...options, [ownRegistration]: true };
      return docRegistry.addFileType(tagged);
    };
    const isOwnType = (type: object): boolean =>
      (type as Record<symbol, unknown>)[ownRegistration] === true;

    const disabledExplicitOwner = (name: string): boolean => {
      const owner = groupMatchers.find(matcher => matcher.re?.test(name));
      return !!owner && !settings[owner.group];
    };

    // Filtering getFileTypesForPath alone misses an independent pattern
    // hidden behind this plugin's first pattern match. Extensions retain
    // the registry's existing longest-extension and registration order.
    const independentFileType = (path: string) => {
      const name = path.split('/').pop()!;
      for (const type of docRegistry.fileTypes()) {
        if (
          !isOwnType(type) &&
          type.contentType === 'file' &&
          type.pattern &&
          name.match(type.pattern)
        ) {
          return type;
        }
      }
      return (
        docRegistry
          .getFileTypesForPath(path)
          .find(type => !isOwnType(type) && type.contentType === 'file') ||
        docRegistry.getFileType('text')!
      );
    };

    const getFileTypeForModel =
      docRegistry.getFileTypeForModel.bind(docRegistry);
    docRegistry.getFileTypeForModel = model => {
      const selected = getFileTypeForModel(model);
      const name = model.name || model.path?.split('/').pop() || '';
      return model.type === 'file' &&
        disabledExplicitOwner(name) &&
        isOwnType(selected)
        ? independentFileType(name)
        : selected;
    };

    // Function to register file types based on settings
    const registerFileTypes = () => {
      // Clear existing registrations by re-registering
      fileTypeConfigs.forEach(config => {
        // Check if this group is enabled
        if (!settings[config.group]) {
          return;
        }

        // Skip custom icons that are registered separately
        if (config.iconName.startsWith('custom-')) {
          return;
        }

        // Three mapped keys have no body in the bundled set, so createLabIcon
        // would build a blank page and register it. JupyterLab claims csv and
        // pdf first so those are inert, but nothing claims .rst and the blank
        // page is what a .rst row showed. Leave the type unregistered instead.
        if (getIconSVG(config.iconName) === getIconSVG('default-file')) {
          return;
        }

        const icon = createLabIcon(config.iconName);
        const fileTypeName = `vscode-${config.iconName}`;

        // Register file type
        const fileTypeOptions: any = {
          name: fileTypeName,
          icon: icon,
          fileFormat: 'text',
          contentType: 'file',
          mimeTypes: ['text/plain']
        };

        if (config.extensions.length > 0) {
          fileTypeOptions.extensions = config.extensions;
        }

        if (config.pattern) {
          fileTypeOptions.pattern = config.pattern;
        }

        if (config.mimeTypes) {
          fileTypeOptions.mimeTypes = config.mimeTypes;
        }

        registerFileType(fileTypeOptions);
      });

      // Register Makefile with custom icon (document with gears, from text-x-makefile-svgrepo-com.svg)
      const makefileSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="19 7 90 114">
        <path class="makefile-glyph" fill="#c2544f" d="m 29.09375,11.234375 c -3.183804,0 -5.71875,2.566196 -5.71875,5.75 l 0,94.031255 c 0,3.1838 2.534946,5.75 5.71875,5.75 l 69.8125,0 c 3.1838,0 5.71875,-2.5662 5.71875,-5.75 l 0,-70.656255 -21.03125,0 c -4.306108,0 -8.0625,-3.141109 -8.0625,-7.3125 l 0,-21.8125 -46.4375,0 z m 50.4375,0 0,21.8125 c 0,1.714122 1.631968,3.3125 4.0625,3.3125 l 21.03125,0 -25.09375,-25.125 z m -32.34375,29.3125 1.71875,0 1.65625,3.5 0.03125,0.75 -0.53125,2.4375 3.25,1.3125 1.3125,-2.0625 0.59375,-0.53125 3.59375,-1.25 1.25,1.21875 -1.28125,3.59375 -0.5,0.59375 -2.0625,1.3125 1.3125,3.28125 2.40625,-0.5625 0.78125,0.03125 3.46875,1.65625 0,1.75 -3.46875,1.65625 -0.78125,0 -2.40625,-0.5 -1.3125,3.21875 2.0625,1.375 0.5,0.59375 1.28125,3.59375 -1.25,1.25 -3.59375,-1.28125 -0.59375,-0.5625 -1.3125,-2.0625 -3.25,1.34375 0.53125,2.40625 -0.03125,0.78125 -1.65625,3.4375 -1.71875,0 -1.65625,-3.4375 -0.0625,-0.78125 0.53125,-2.40625 -3.25,-1.34375 -1.3125,2.0625 -0.59375,0.5625 -3.59375,1.28125 -1.25,-1.25 1.28125,-3.59375 0.5625,-0.59375 2.0625,-1.375 -1.34375,-3.21875 -2.40625,0.5 -0.8125,0 -3.46875,-1.65625 0,-1.75 3.46875,-1.65625 0.8125,-0.03125 2.40625,0.5625 1.34375,-3.28125 -2.0625,-1.3125 -0.5625,-0.59375 L 36,45.921875 l 1.25,-1.21875 3.59375,1.25 0.59375,0.53125 1.3125,2.0625 3.25,-1.3125 -0.53125,-2.4375 0.0625,-0.75 1.65625,-3.5 z m 0.875,10.875 c -2.927972,0 -5.34375,2.353278 -5.34375,5.28125 0,2.927972 2.415778,5.3125 5.34375,5.3125 2.927972,0 5.28125,-2.384528 5.28125,-5.3125 0,-2.927972 -2.353278,-5.28125 -5.28125,-5.28125 z m 18.15625,10.3125 3.09375,3.34375 0.46875,1.15625 0.40625,2.75 4.46875,0 0.40625,-2.75 0.4375,-1.15625 3.125,-3.34375 2.25,0.71875 0.53125,4.53125 -0.28125,1.21875 -1.3125,2.4375 3.625,2.65625 1.90625,-2 1.0625,-0.625 4.5,-0.90625 1.375,1.90625 -2.21875,3.96875 -0.96875,0.8125 -2.46875,1.1875 1.40625,4.28125 2.71875,-0.46875 1.21875,0.09375 4.15625,1.90625 0,2.34375 -4.15625,1.9375 -1.21875,0.09375 -2.71875,-0.46875 -1.40625,4.25 2.46875,1.21875 0.96875,0.78125 2.21875,4.03125 -1.375,1.875 -4.5,-0.875 -1.0625,-0.65625 -1.90625,-2 -3.625,2.65625 1.3125,2.406255 0.28125,1.21875 -0.53125,4.5625 -2.25,0.75 -3.125,-3.40625 -0.4375,-1.125 -0.40625,-2.71875 -4.46875,0 -0.40625,2.71875 -0.46875,1.125 -3.09375,3.40625 -2.25,-0.75 -0.53125,-4.5625 0.3125,-1.21875 1.28125,-2.406255 -3.625,-2.65625 -1.9375,2 -1.0625,0.65625 -4.46875,0.875 -1.375,-1.875 2.21875,-4.03125 0.9375,-0.78125 2.46875,-1.21875 -1.34375,-4.25 -2.71875,0.46875 -1.21875,-0.09375 -4.1875,-1.9375 0,-2.34375 4.1875,-1.90625 1.21875,-0.09375 2.71875,0.46875 1.34375,-4.28125 -2.46875,-1.1875 -0.9375,-0.8125 -2.21875,-3.96875 1.375,-1.90625 4.46875,0.90625 1.0625,0.625 1.9375,2 3.625,-2.65625 -1.28125,-2.4375 -0.3125,-1.21875 0.53125,-4.53125 2.25,-0.71875 z m 6.1875,14.09375 c -4.866236,0 -8.8125,3.946264 -8.8125,8.8125 0,4.866238 3.946264,8.8125 8.8125,8.8125 4.866237,0 8.8125,-3.946262 8.8125,-8.8125 0,-4.866236 -3.946263,-8.8125 -8.8125,-8.8125 z"/>
      </svg>`;

      const makefileIcon = new LabIcon({
        name: 'makefile-icon',
        svgstr: makefileSvg
      });

      if (settings.enableConfigIcons) {
        registerFileType({
          name: 'vscode-makefile',
          displayName: 'Makefile',
          extensions: ['.mk', '.mak', '.make'],
          pattern: '^(Makefile|makefile|GNUmakefile)$',
          fileFormat: 'text',
          contentType: 'file',
          mimeTypes: ['text/x-makefile'],
          icon: makefileIcon
        });
      }

      // Register LICENSE with document + seal icon
      const licenseSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 490 490">
        <path fill="#C33831" d="M320,335.898c38.398-19.199,69.199,11.504,50,50c19.199,38.398-11.602,69.199-50,50c-38.398,19.199-69.199-11.602-50-50C250.801,347.402,281.602,316.699,320,335.898z"/>
        <path fill="#e0bdbd" d="M430,110v370H60V10h270v100H430z M370,385.898c19.199-38.496-11.602-69.199-50-50c-38.398-19.199-69.199,11.504-50,50c-19.199,38.398,11.602,69.199,50,50C358.398,455.098,389.199,424.297,370,385.898z"/>
        <polygon fill="#c47878" points="430,110 330,110 330,10"/>
        <path fill="#231F20" d="M439.976,110c-0.001-2.602-0.992-5.159-2.904-7.071l-100-100c-1.912-1.912-4.47-2.903-7.071-2.904V0H60c-5.523,0-10,4.477-10,10v470c0,5.523,4.477,10,10,10h370c5.522,0,10-4.477,10-10V110H439.976z M340,34.142L405.857,100H340V34.142z M70,470V20h250v90c0,5.523,4.478,10,10,10h90v350H70z"/>
        <path fill="#5e1c18" d="M379.447,339.49c-7.657-12.376-20.975-19.475-36.535-19.475c-7.511,0-15.198,1.64-22.912,4.882c-7.714-3.242-15.401-4.882-22.912-4.882c-15.56,0-28.875,7.099-36.533,19.476c-8.036,12.989-8.541,29.684-1.551,46.403c-6.992,16.688-6.49,33.368,1.542,46.364c7.666,12.403,20.998,19.516,36.577,19.515c7.501,0,15.178-1.637,22.877-4.872c7.7,3.235,15.375,4.872,22.874,4.872c0.001,0,0.003,0,0.004,0c15.579-0.001,28.911-7.116,36.576-19.52c8.031-12.996,8.533-29.673,1.542-46.358C387.988,369.172,387.483,352.478,379.447,339.49z M361.056,390.371c5.903,11.806,6.408,23.239,1.385,31.368c-3.998,6.469-10.946,10.033-19.564,10.034c-5.817,0-12.01-1.621-18.404-4.818c-1.407-0.704-2.94-1.056-4.472-1.056s-3.065,0.352-4.472,1.056c-6.393,3.196-12.586,4.817-18.406,4.818c-8.618,0-15.566-3.562-19.564-10.03c-5.023-8.128-4.519-19.563,1.386-31.372c1.406-2.812,1.407-6.122,0.005-8.935c-5.908-11.846-6.413-23.298-1.387-31.422c3.989-6.448,10.924-9.999,19.525-9.999c5.829,0,12.033,1.625,18.44,4.828c2.815,1.407,6.129,1.407,8.943,0c6.407-3.204,12.611-4.828,18.44-4.828c8.603,0,15.538,3.551,19.527,9.998c5.026,8.123,4.52,19.576-1.389,31.423C359.648,384.249,359.649,387.559,361.056,390.371z"/>
        <rect x="312.54" y="363.26" fill="#5e1c18" width="14.1" height="12.83"/>
        <rect x="306.44" y="394.44" fill="#5e1c18" width="26.48" height="7.21"/>
        <rect x="95" y="395" fill="#231F20" width="120" height="20"/>
        <rect x="195" y="430" fill="#231F20" width="20" height="20"/>
        <rect x="165" y="430" fill="#231F20" width="20" height="20"/>
        <rect x="95" y="430" fill="#231F20" width="20" height="20"/>
        <rect x="95" y="40" fill="#231F20" width="60" height="20"/>
        <rect x="95" y="70" fill="#231F20" width="120" height="20"/>
        <rect x="165" y="150" fill="#231F20" width="160" height="20"/>
        <rect x="95" y="190" fill="#231F20" width="300" height="20"/>
        <rect x="95" y="230" fill="#231F20" width="300" height="20"/>
        <rect x="95" y="270" fill="#231F20" width="240" height="20"/>
        <rect x="375" y="270" fill="#231F20" width="20" height="20"/>
        <rect x="345" y="270" fill="#231F20" width="20" height="20"/>
      </svg>`;

      const licenseIcon = new LabIcon({
        name: 'license-icon',
        svgstr: licenseSvg
      });

      if (settings.enableDocIcons) {
        registerFileType({
          name: 'vscode-license',
          displayName: 'License',
          pattern: '^(LICENSE|LICENCE|LICENSE\\..*|LICENCE\\..*)$',
          fileFormat: 'text',
          contentType: 'file',
          mimeTypes: ['text/plain'],
          icon: licenseIcon
        });
      }

      // Register CLAUDE.md with Claude icon (always register, not conditional on settings)
      const claudeIcon = createLabIcon('file-type-claude');
      if (claudeIcon) {
        if (settings.enableDocIcons) {
          registerFileType({
            name: 'vscode-claude-md',
            displayName: 'Claude Configuration',
            pattern: '^CLAUDE\\.md$',
            fileFormat: 'text',
            contentType: 'file',
            mimeTypes: ['text/markdown'],
            icon: claudeIcon
          });
        }
      } else {
        console.error('[VSCode Icons] Failed to create CLAUDE.md icon');
      }

      // Register README.md with custom purple filled info icon
      const readmeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="11" fill="#9826c8"/>
        <text x="16" y="22" font-size="18" font-weight="bold" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif">i</text>
      </svg>`;

      const readmeIcon = new LabIcon({
        name: 'readme-icon',
        svgstr: readmeSvg
      });

      if (settings.enableDocIcons) {
        registerFileType({
          name: 'vscode-readme',
          displayName: 'README',
          pattern: '^README\\.md$',
          fileFormat: 'text',
          contentType: 'file',
          mimeTypes: ['text/markdown'],
          icon: readmeIcon
        });
      }

      // Register CHANGELOG with document + list icon
      const changelogSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <path style="opacity:0.2" d="m 14.5,8 c -1.385,0 -2.5,1.115 -2.5,2.5 v 45 c 0,1.385 1.115,2.5 2.5,2.5 h 35 C 50.885,58 52,56.885 52,55.5 V 23 L 38.25,21.75 37,8 Z"/>
        <path fill="#e4e4e4" d="m14.5 7c-1.385 0-2.5 1.115-2.5 2.5v45c0 1.385 1.115 2.5 2.5 2.5h35c1.385 0 2.5-1.115 2.5-2.5v-32.5l-13.75-1.25-1.25-13.75z"/>
        <path style="opacity:0.2" d="M 37,8 V 20.5 c 0,1.3808 1.1193,2.5 2.5,2.5 H 52 Z"/>
        <path fill="#fafafa" d="m37 7v12.5c0 1.3808 1.1193 2.5 2.5 2.5h12.5l-15-15z"/>
        <rect style="opacity:0.5" width="19" height="3" x="25" y="35"/>
        <rect style="opacity:0.5" width="19" height="3" x="25" y="40"/>
        <rect style="opacity:0.5" width="19" height="3" x="25" y="45"/>
        <rect style="opacity:0.5" width="3" height="3" x="20" y="35"/>
        <rect style="opacity:0.5" width="3" height="3" x="20" y="40"/>
        <rect style="opacity:0.5" width="3" height="3" x="20" y="45"/>
        <rect style="opacity:0.5" width="19" height="3" x="25" y="30"/>
        <rect style="opacity:0.5" width="3" height="3" x="20" y="30"/>
        <path style="opacity:0.2;fill:#ffffff" d="m 14.5,7 c -1.385,0 -2.5,1.115 -2.5,2.5 V 10.5 C 12,9.115 13.115,8 14.5,8 H 37 c 0,-1 0,0 0,-1 z"/>
      </svg>`;

      const changelogIcon = new LabIcon({
        name: 'changelog-icon',
        svgstr: changelogSvg
      });

      if (settings.enableDocIcons) {
        registerFileType({
          name: 'vscode-changelog',
          displayName: 'Changelog',
          pattern: '^CHANGELOG$',
          fileFormat: 'text',
          contentType: 'file',
          mimeTypes: ['text/plain'],
          icon: changelogIcon
        });
      }

      // Register CHANGELOG.md with markdown icon (as RELEASE.md below)
      if (settings.enableDocIcons) {
        registerFileType({
          name: 'vscode-changelog-md',
          displayName: 'Changelog',
          pattern: '^CHANGELOG\\.md$',
          fileFormat: 'text',
          contentType: 'file',
          mimeTypes: ['text/markdown'],
          icon: markdownIcon
        });
      }

      // Register RELEASE without .md extension (same icon as CHANGELOG)
      if (settings.enableDocIcons) {
        registerFileType({
          name: 'vscode-release',
          displayName: 'Release Notes',
          pattern: '^RELEASE$',
          fileFormat: 'text',
          contentType: 'file',
          mimeTypes: ['text/plain'],
          icon: changelogIcon
        });
      }

      // Register RELEASE.md with markdown icon
      if (settings.enableDocIcons) {
        registerFileType({
          name: 'vscode-release-md',
          displayName: 'Release Notes',
          pattern: '^RELEASE\\.md$',
          fileFormat: 'text',
          contentType: 'file',
          mimeTypes: ['text/markdown'],
          icon: markdownIcon
        });
      }

      // Register Draw.io files with custom orange diagram icon
      if (settings.enableConfigIcons) {
        const drawioSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 161.6 161.6">
          <path fill="#D07005" d="M161.6,154.7c0,3.9-3.2,6.9-6.9,6.9H6.9c-3.9,0-6.9-3.2-6.9-6.9V6.9C0,3,3.2,0,6.9,0h147.8c3.9,0,6.9,3.2,6.9,6.9L161.6,154.7z"/>
          <path fill="#B85A0A" d="M161.6,154.7c0,3.9-3.2,6.9-6.9,6.9H55.3l-32.2-32.7l20-32.7l59.4-73.8l58.9,60.7L161.6,154.7z"/>
          <path fill="#e0e0e0" d="M132.7,90.3h-17l-18-30.6c4-0.8,7-4.4,7-8.6V28c0-4.9-3.9-8.8-8.8-8.8h-30c-4.9,0-8.8,3.9-8.8,8.8v23.1c0,4.3,3,7.8,6.9,8.6L46,90.4H29c-4.9,0-8.8,3.9-8.8,8.8v23.1c0,4.9,3.9,8.8,8.8,8.8h30c4.9,0,8.8-3.9,8.8-8.8V99.2c0-4.9-3.9-8.8-8.8-8.8h-2.9L73.9,60h13.9l17.9,30.4h-3c-4.9,0-8.8,3.9-8.8,8.8v23.1c0,4.9,3.9,8.8,8.8,8.8h30c4.9,0,8.8-3.9,8.8-8.8V99.2C141.5,94.3,137.6,90.3,132.7,90.3z"/>
        </svg>`;

        const drawioIcon = new LabIcon({
          name: 'drawio-icon',
          svgstr: drawioSvg
        });

        registerFileType({
          name: 'vscode-drawio',
          displayName: 'Draw.io Diagram',
          extensions: ['.drawio', '.dio'],
          fileFormat: 'text',
          contentType: 'file',
          mimeTypes: ['application/xml'],
          icon: drawioIcon
        });
      }

      // Register BPMN files with custom process notation icon
      if (settings.enableConfigIcons) {
        const bpmnIcon = new LabIcon({
          name: 'bpmn-icon',
          svgstr: bpmnSvg
        });

        registerFileType({
          name: 'vscode-bpmn',
          displayName: 'BPMN Diagram',
          extensions: ['.bpmn'],
          fileFormat: 'text',
          contentType: 'file',
          mimeTypes: ['application/xml'],
          icon: bpmnIcon
        });
      }

      // Register ONNX model files with custom icon
      if (settings.enableDataIcons) {
        const onnxSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 324.83655 330.2579">
          <path fill="#343433" d="m 302.42021,163.06099 a 3.0095011,3.0311484 0 0 1 -2.9948,-1.88257 Q 275.09105,115.70055 250.62858,70.294589 a 3.7886934,3.8159454 0 0 1 -0.30664,-3.394983 12.281635,12.369977 0 0 0 -18.85088,-14.117168 5.006776,5.0427897 0 0 1 -4.46491,0.913776 Q 179.06196,44.002017 131.10944,34.367052 a 3.3224237,3.3463219 0 0 1 -3.03051,-2.658876 12.300541,12.389019 0 1 0 -23.59732,7.005566 q 0.0482,0.164702 0.10092,0.32801 a 4.1477527,4.1775875 0 0 1 -0.64473,4.143767 Q 65.820125,98.139737 27.818008,153.17431 c -1.029066,1.48915 -2.041335,2.13641 -3.553439,1.58222 a 12.27744,12.365751 0 0 0 -13.220403,10.64817 12.080032,12.166924 0 0 0 10.03998,13.9216 q 0.229732,0.0366 0.460733,0.0645 a 3.2909209,3.3145925 0 0 1 3.108219,2.58482 q 20.423895,50.83789 40.9675,101.62719 a 5.1033605,5.1400689 0 0 1 0.24366,3.49015 12.317348,12.405947 0 0 0 19.392738,13.38318 4.324197,4.3553009 0 0 1 3.307732,-0.97935 c 7.963739,0.8334 15.935922,1.55893 23.903832,2.34157 q 26.172,2.56576 52.33978,5.14852 23.59723,2.32889 47.19654,4.64722 a 3.2111188,3.2342163 0 0 1 3.1292,2.16813 12.317348,12.405947 0 1 0 21.8205,-11.39908 3.0662205,3.0882758 0 0 1 -0.042,-3.56632 q 31.18925,-54.42963 62.27767,-108.91634 a 3.3329342,3.356908 0 0 1 3.26151,-2.03697 12.323687,12.412331 0 0 0 0.28867,-24.82296 q -0.16017,-0.001 -0.32022,5.1e-4 z M 111.80485,64.881662 q 1.75572,-7.591651 3.49044,-15.1875 c 0.28979,-1.281852 0.67619,-2.043327 2.32066,-2.144818 a 10.584682,10.660817 0 0 0 7.85033,-4.126864 2.9003012,2.921163 0 0 1 3.40854,-1.034348 q 48.20878,9.740725 96.43017,19.411644 c 0.2646,0.05289 0.51454,0.186151 1.49739,0.554197 -10.55955,4.651436 -20.447,9.019429 -30.34707,13.364086 Q 150.71004,95.79387 104.95839,115.85706 c -0.46203,0.20307 -0.93036,0.39557 -1.39869,0.58805 -0.98077,0.40189 -1.90694,1.33683 -3.04102,0.36382 -1.056362,-0.90324 -0.27932,-1.88468 -0.063,-2.81541 q 5.66199,-24.558039 11.34916,-49.109752 z m -6.92417,-8.505428 0.50404,0.338437 Q 98.895298,84.671938 92.414236,112.63343 a 3.1649099,3.1876751 0 0 1 -2.408786,2.66945 11.613762,11.6973 0 0 0 -8.480514,10.47894 3.4232758,3.4478994 0 0 1 -1.678023,3.0079 q -20.581322,12.13093 -41.099812,24.36553 a 5.680863,5.7217254 0 0 1 -1.033276,0.23267 z M 72.420869,274.58128 a 23.358741,23.52676 0 0 1 -0.592252,2.29294 L 57.963467,242.4865 Q 45.234493,210.91216 32.463519,179.35475 a 4.2002766,4.2304891 0 0 1 0.646852,-5.15485 9.1986471,9.2648128 0 0 0 2.289162,-7.1009 3.5240269,3.5493752 0 0 1 2.192549,-3.8011 c 15.032828,-8.85868 30.002651,-17.821 45.012382,-26.71772 0.846321,-0.50131 1.69061,-1.65623 2.912902,-0.48015 1.106778,1.06395 2.635678,1.55681 2.354258,3.78629 -1.459608,11.64022 -2.713418,23.30583 -4.042734,34.96296 l -5.79224,50.78083 q -2.797401,24.47556 -5.615781,48.9511 z m 14.075159,7.6995 a 9.3394507,9.4066293 0 0 0 -4.742124,-3.17293 c -1.11305,-0.34691 -1.86913,-0.80594 -1.491097,-1.86354 1.197076,-10.52125 2.358468,-20.75908 3.528237,-30.99476 q 3.528251,-30.86147 7.066984,-61.723 c 1.648625,-14.39004 3.387534,-28.77162 4.874436,-43.1786 0.294021,-2.85559 2.509667,-2.77097 4.053273,-3.8138 1.568823,-1.06185 2.221963,0.52247 3.003213,1.20569 q 51.09647,44.63388 102.12373,89.34393 a 4.7484534,4.782609 0 0 1 -1.26011,7.5726 l -113.825698,47.2949 c -1.35671,0.56476 -2.282862,0.72553 -3.332935,-0.66841 z m 133.249922,16.26415 a 5.1978543,5.2352424 0 0 0 -2.26396,1.97782 c -1.5835,3.33365 -4.3137,2.92538 -7.16994,2.63983 q -33.69469,-3.37804 -67.39779,-6.68422 -25.38444,-2.51715 -50.768886,-5.05122 l -0.186912,-0.55418 c 6.115616,-2.55948 12.222838,-5.13581 18.342668,-7.67837 q 47.94628,-19.91298 95.88415,-39.85131 c 1.80612,-0.75511 2.9192,-0.0931 4.59301,0.49498 4.76731,1.67949 4.87653,5.42562 5.30285,9.36209 q 2.3154,21.28362 4.80514,42.54614 c 0.14072,1.2204 0.10929,2.12781 -1.14033,2.79837 z m -4.06796,-78.34251 c -0.1932,1.52298 -0.89467,1.9545 -2.09385,2.50445 a 2.8352339,2.8556277 0 0 1 -3.48621,-0.77418 q -12.22912,-10.79412 -24.52967,-21.49941 -38.88418,-34.04076 -77.76411,-68.08572 a 8.5035823,8.5647485 0 0 1 -2.07916,-7.52396 c 0.52504,-1.09992 1.83344,-1.19934 2.8184,-1.63296 q 49.7377,-21.86535 99.49852,-43.673568 c 6.11772,-2.68426 12.25852,-5.313513 18.33845,-8.080255 1.71792,-0.782706 3.05571,-1.199355 4.38299,0.647265 a 5.7397018,5.7809874 0 0 0 2.47188,1.719702 c 1.15929,0.4717 1.64231,1.110498 1.37769,1.88468 -1.17607,9.042693 -2.29336,17.641189 -3.41693,26.233336 q -3.85166,29.42311 -7.71593,58.84203 c -2.60628,19.81354 -5.25877,39.61863 -7.80203,59.44063 z m 13.41361,75.68786 c -0.70564,-5.83181 -1.32729,-10.76661 -1.89642,-15.70785 -1.15509,-10.03053 -2.25349,-20.06737 -3.44213,-30.09569 -0.32972,-2.78368 -0.56074,-5.05546 2.34794,-7.09878 a 10.534335,10.610109 0 0 0 3.92519,-10.38801 c -0.12602,-1.14224 -0.0988,-1.86141 0.92616,-2.56368 q 28.88329,-19.8516 57.72455,-39.76035 a 6.0133072,6.0565609 0 0 1 0.89884,-0.21574 l -60.48414,105.8302 z m 62.7397,-126.30582 a 8.9591828,9.0236261 0 0 0 -1.46382,7.01418 3.2238064,3.2469952 0 0 1 -1.69059,3.73346 q -30.99393,21.30057 -61.91224,42.71537 c -0.68043,0.46958 -1.23907,1.34742 -2.38365,0.69381 -1.26011,-0.71918 -0.80647,-1.75565 -0.68255,-2.69061 q 6.19962,-47.15527 12.43915,-94.3063 c 2.14214,-16.27686 4.22758,-32.559985 6.35084,-48.841124 0.13855,-1.057626 0.37801,-2.100455 0.70358,-3.858232 3.95459,7.308193 7.58992,13.981814 11.18116,20.674472 q 18.69124,34.823354 37.38884,69.640364 a 4.1414666,4.1712561 0 0 1 0.0692,5.22454 z"/>
          <path fill="#fefefe" d="m 234.61077,76.917443 c 0.26673,-0.776302 -0.21627,-1.4151 -1.3756,-1.8868 A 5.7395288,5.7808131 0 0 1 230.7633,73.31094 c -1.3273,-1.846605 -2.66717,-1.432017 -4.383,-0.64937 -6.07996,2.768862 -12.22284,5.398115 -18.33845,8.080255 Q 158.28942,102.5712 108.54544,124.42174 c -0.98498,0.4315 -2.29336,0.53092 -2.81631,1.62874 a 8.5034669,8.5646323 0 0 0 2.07916,7.52606 l 77.75775,68.08566 q 12.27008,10.74336 24.52969,21.49941 a 2.8351906,2.8555841 0 0 0 3.48621,0.77206 c 1.20128,-0.54997 1.90272,-0.97935 2.09804,-2.50235 2.54118,-19.8199 5.19366,-39.62709 7.79999,-59.44063 q 3.87261,-29.41891 7.71593,-58.84203 c 1.12359,-8.594254 2.23876,-17.19063 3.41693,-26.233323 z"/>
          <path fill="#f4f5f6" d="M 204.91473,229.31282 Q 153.8644,184.62605 102.78894,139.97311 c -0.78335,-0.68533 -1.43648,-2.2697 -3.005308,-1.2078 -1.543606,1.04495 -3.759252,0.95821 -4.053273,3.81379 -1.486902,14.40698 -3.225825,28.78857 -4.872331,43.18073 l -7.069017,61.72087 c -1.169783,10.23571 -2.331161,20.4735 -3.528237,30.99475 -0.378033,1.05763 0.378019,1.51664 1.491097,1.86354 a 9.3394507,9.4066293 0 0 1 4.742124,3.17286 c 1.050073,1.39394 1.976239,1.23318 3.332934,0.66841 Q 146.72821,260.51059 203.65052,236.88962 a 4.7483957,4.7825509 0 0 0 1.26011,-7.5726 z"/>
          <path fill="#dedfdf" d="m 254.37312,95.948422 c -3.59124,-6.694779 -7.2266,-13.366265 -11.18116,-20.674458 -0.32341,1.757777 -0.56703,2.802639 -0.70358,3.858217 q -3.18172,24.418449 -6.35084,48.841129 -6.20381,47.15528 -12.43915,94.30631 c -0.12385,0.93283 -0.57959,1.9714 0.68255,2.69061 1.14667,0.65571 1.70321,-0.22423 2.38365,-0.69381 l 61.91225,-42.71537 a 3.2238064,3.2469952 0 0 0 1.6906,-3.73346 8.9591828,9.0236261 0 0 1 1.46382,-7.01416 4.1414666,4.1712561 0 0 0 -0.0693,-5.22467 Q 273.00773,130.80351 254.37312,95.948422 Z"/>
          <path fill="#d1d1d1" d="m 100.51659,118.03798 c 1.13611,0.97089 2.06234,0.0338 3.04521,-0.36594 0.46623,-0.19038 0.93245,-0.38498 1.39659,-0.58805 q 45.74956,-20.065251 91.49697,-40.136865 c 9.90007,-4.344715 19.78756,-8.714828 30.34708,-13.364086 -0.98287,-0.368061 -1.23272,-0.50131 -1.4974,-0.554197 Q 177.0878,53.330419 128.87488,43.617184 a 2.9003156,2.9211775 0 0 0 -3.40854,1.034363 10.584725,10.660861 0 0 1 -7.85033,4.124743 c -1.64441,0.10364 -2.03084,0.86725 -2.32066,2.146967 q -1.7221,7.600103 -3.49044,15.187501 l -11.35127,49.109752 c -0.21422,0.93071 -0.991264,1.91219 0.063,2.81541 z m 115.5646,136.39132 c -0.42633,-3.93436 -0.53553,-7.6826 -5.30284,-9.3621 -1.67171,-0.58803 -2.78695,-1.25013 -4.59302,-0.49709 q -47.91478,19.99124 -95.88205,39.85346 c -6.11983,2.54251 -12.22704,5.11889 -18.34267,7.67836 l 0.186912,0.55418 50.768868,5.05122 67.39781,6.68423 c 2.85615,0.28555 5.58638,0.6938 7.16994,-2.63984 a 5.197912,5.2353005 0 0 1 2.26396,-1.97782 c 1.24959,-0.67055 1.28109,-1.57798 1.14044,-2.79848 q -2.47174,-21.26508 -4.80513,-42.54613 z"/>
          <path fill="#d8d8d8" d="m 87.873715,141.1153 c 0.279315,-2.22948 -1.249586,-2.72234 -2.356363,-3.78631 -1.222278,-1.17608 -2.066538,-0.0212 -2.912903,0.48017 -15.009716,8.89674 -29.979553,17.85905 -45.012382,26.71772 a 3.5240269,3.5493752 0 0 0 -2.192548,3.80109 9.1986471,9.2648128 0 0 1 -2.289162,7.10089 4.2002766,4.2304891 0 0 0 -0.646838,5.15486 q 12.83186,31.53207 25.499948,63.13176 l 13.86515,34.38761 a 23.352411,23.520385 0 0 0 0.592238,-2.29293 q 2.820499,-24.47346 5.615709,-48.95111 2.902406,-25.3893 5.792197,-50.78082 c 1.329315,-11.65504 2.583183,-23.32274 4.042734,-34.96085 z"/>
          <path fill="#b2b2b2" d="m 230.95233,231.2652 c -1.02487,0.70438 -1.05429,1.42145 -0.92618,2.56368 a 10.534335,10.610109 0 0 1 -3.92518,10.38589 c -2.9087,2.04545 -2.67767,4.31723 -2.34797,7.1009 1.18869,10.02628 2.28706,20.06526 3.44214,30.09579 0.56703,4.94122 1.19079,9.87821 1.89643,15.70784 L 289.5757,191.28911 a 6.0129323,6.0561833 0 0 0 -0.89884,0.21576 q -28.856,19.88754 -57.72453,39.76033 z M 79.846985,130.01878 a 3.423247,3.4478703 0 0 0 1.680113,-3.00788 11.613791,11.697329 0 0 1 8.478352,-10.47895 3.1649099,3.1876751 0 0 0 2.408858,-2.66945 Q 98.876454,85.898899 105.38688,57.943752 l -0.50403,-0.338437 -67.168967,97.009555 a 5.680863,5.7217254 0 0 0 1.033276,-0.23268 q 20.545624,-12.18805 41.099826,-24.36344 z"/>
        </svg>`;

        const onnxIcon = new LabIcon({
          name: 'onnx-icon',
          svgstr: onnxSvg
        });

        registerFileType({
          name: 'vscode-onnx',
          displayName: 'ONNX Model',
          extensions: ['.onnx'],
          fileFormat: 'base64',
          contentType: 'file',
          mimeTypes: ['application/octet-stream'],
          icon: onnxIcon
        });
      }

      // Register PyTorch model files with custom icon
      if (settings.enableDataIcons) {
        const pytorchSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-7.37 1058.27 106.24 128.35">
          <path fill="#EE4C2C" d="M77.6,1099.6l-8.1,8.1c13.3,13.3,13.3,34.7,0,47.8c-13.3,13.3-34.7,13.3-47.8,0c-13.3-13.3-13.3-34.7,0-47.8l0,0l21.1-21.1l3-3l0,0v-15.9l-31.8,31.8c-17.7,17.7-17.7,46.3,0,64c17.7,17.7,46.3,17.7,63.7,0C95.3,1145.8,95.3,1117.4,77.6,1099.6z"/>
          <circle fill="#EE4C2C" cx="61.7" cy="1091.8" r="5.9"/>
        </svg>`;

        const pytorchIcon = new LabIcon({
          name: 'pytorch-icon',
          svgstr: pytorchSvg
        });

        registerFileType({
          name: 'vscode-pytorch',
          displayName: 'PyTorch Model',
          extensions: ['.pt', '.pth'],
          fileFormat: 'base64',
          contentType: 'file',
          mimeTypes: ['application/octet-stream'],
          icon: pytorchIcon
        });
      }

      // Register joblib pickle files with custom icon
      if (settings.enableDataIcons) {
        const joblibSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 862.47913 794.92072">
          <path class="joblib-glyph" fill="#e15617" d="m 179.48711,704.51315 c 25.6731,-6.687 45.51106,-24.97067 53.132,-48.96915 12.83348,-40.41288 -8.98799,-82.06777 -49.59456,-94.67082 -6.41612,-1.99137 -9.52324,-2.31714 -21.5,-2.25423 -12.51769,0.0658 -14.84703,0.36274 -22,2.80489 -4.4,1.50225 -11.15,4.57589 -15,6.83032 -8.35561,4.89277 -21.59533,17.98205 -26.365256,26.06569 -9.34902,15.84382 -12.610358,37.48469 -8.251105,54.7508 7.764823,30.75489 31.211191,52.11946 62.592911,57.03531 6.26718,0.98173 20.27622,0.15487 26.98601,-1.59281 z m -78.96256,84.65966 -15.999996,-6.65958 0.0403,-5.48391 c 0.02217,-3.01615 0.417864,-12.69774 0.879328,-21.51464 l 0.839026,-16.03074 -6.962465,-5.69621 c -6.98244,-5.71255 -14.099832,-12.87932 -19.98088,-20.1195 l -3.149351,-3.87717 -20.146587,1.27785 c -17.166889,1.08886 -20.338047,1.0707 -21.441108,-0.12282 C 12.667365,708.85192 1.8414234,680.96502 2.3994101,679.51093 2.6647965,678.81935 9.3586728,672.79322 17.274691,666.11954 L 31.667451,653.98557 31.498964,633.76549 31.330478,613.54541 16.213087,600.53098 C 7.8985222,593.37305 0.63503592,587.05589 0.07200642,586.49286 -0.98889987,585.43196 9.9853168,556.85054 12.449679,554.25627 c 0.999421,-1.05211 4.98014,-1.04255 21.64973,0.052 l 20.425145,1.34107 3,-3.07786 c 1.65,-1.69282 5.7,-6.01731 9,-9.60997 3.3,-3.59266 8.654668,-8.81112 11.899262,-11.59657 l 5.899262,-5.06446 -1.318617,-22.21385 c -1.134391,-19.11032 -1.120316,-22.33892 0.100738,-23.10905 3.438949,-2.16898 29.356251,-12.0066 30.913751,-11.73417 0.94958,0.1661 7.91336,7.60386 15.47507,16.52835 l 13.74855,16.22634 13.64099,-0.57548 c 7.50254,-0.31651 16.34099,-0.12864 19.64099,0.41749 3.3,0.54613 6.675,0.61675 7.5,0.15693 0.825,-0.45982 7.125,-7.57713 14,-15.81625 6.875,-8.23912 13.07737,-15.23171 13.78304,-15.53909 1.20338,-0.52418 30.81392,10.68955 32.48906,12.30385 0.42466,0.40923 0.10089,10.60687 -0.71948,22.66142 l -1.49158,21.91735 9.25705,9.01055 c 5.09138,4.95579 11.28485,11.35981 13.76327,14.23113 4.09932,4.74918 4.81832,5.18046 7.96243,4.77609 7.33264,-0.94306 39.89391,-2.65321 40.72597,-2.13898 0.48217,0.298 3.73673,7.59984 7.23234,16.2263 l 6.35567,15.68449 -4.43716,4.11575 c -2.44044,2.26367 -10.13344,8.93174 -17.09555,14.81794 l -12.65839,10.70217 -0.36753,17.79783 c -0.20215,9.7888 -0.12715,18.30001 0.16666,18.91379 0.29381,0.61378 7.2842,6.83478 15.5342,13.82444 8.25,6.98966 15.2994,13.24193 15.66532,13.89393 0.59939,1.06797 -10.81429,30.64796 -12.46125,32.29492 -0.37624,0.37624 -10.05007,0.10939 -21.4974,-0.59299 l -20.81333,-1.27707 -14.7268,14.7268 -14.7268,14.7268 1.12016,17.1436 c 0.61608,9.42898 0.96714,18.9222 0.78013,21.09605 l -0.34003,3.95244 -15.46617,6.18322 c -8.5064,3.40077 -15.9314,5.97807 -16.5,5.72734 -0.56861,-0.25073 -6.78161,-7.28678 -13.80667,-15.63566 l -12.77284,-15.17979 -19.20867,0.26723 c -13.6557,0.18997 -19.5325,0.6236 -20.32883,1.5 -0.61609,0.67802 -6.43305,7.53277 -12.92657,15.23277 -6.49353,7.7 -12.29777,14.51457 -12.89833,15.14348 -0.81221,0.85056 -5.19058,-0.56247 -17.09192,-5.51608 z"/>
          <path class="joblib-glyph" fill="#e15617" d="m 467.65426,634.81886 c -0.79593,-1.2504 -3.98822,-10.14845 -7.09399,-19.77345 -3.10577,-9.625 -6.18435,-18.02015 -6.84129,-18.65589 -0.65694,-0.63574 -6.14443,-1.90756 -12.19443,-2.82625 -6.05,-0.9187 -15.3914,-2.74543 -20.75867,-4.0594 -5.36727,-1.31397 -10.31727,-2.15177 -11,-1.86177 -0.68273,0.28999 -7.09133,7.51488 -14.24133,16.0553 -7.15,8.54042 -13.35877,15.75224 -13.79727,16.02626 -1.32598,0.8286 -31.82974,-11.84565 -32.45954,-13.48688 -0.32197,-0.83906 -0.0137,-10.77991 0.68496,-22.09077 1.21473,-19.66466 1.18938,-20.62267 -0.57889,-21.87713 -1.01709,-0.72155 -6.34926,-4.07568 -11.84926,-7.45362 -5.5,-3.37795 -13.88845,-8.98305 -18.641,-12.45578 -4.75255,-3.47274 -9.37035,-6.31407 -10.26176,-6.31407 -0.89142,0 -8.81018,3.6 -17.59724,8 -8.78706,4.4 -16.5513,8 -17.25387,8 -1.64589,0 -24.74613,-23.12824 -24.74613,-24.77613 0,-0.68535 3.84242,-8.92089 8.53872,-18.3012 l 8.53871,-17.05512 -5.39951,-7.18378 c -6.53098,-8.68912 -16.6375,-24.00152 -20.38006,-30.87783 l -2.73541,-5.02586 -14.53123,0.84247 c -7.99217,0.46336 -17.45622,0.85034 -21.03122,0.85996 l -6.5,0.0175 -6.16912,-15 c -3.39301,-8.25 -6.20551,-15.54828 -6.25,-16.21839 -0.0445,-0.67012 6.10662,-6.4771 13.66912,-12.9044 7.5625,-6.4273 14.5843,-12.46332 15.604,-13.41338 1.80287,-1.67975 1.78223,-2.04094 -0.74828,-13.09561 -1.43125,-6.25253 -3.30567,-15.86823 -4.16537,-21.36823 -0.8597,-5.5 -2.00736,-10.45 -2.55035,-11 -0.543,-0.55 -9.62789,-3.925 -20.18864,-7.5 l -19.20136,-6.5 v -17.91646 -17.91647 l 20,-6.66624 20,-6.66624 2.09877,-12.4173 c 1.15433,-6.82951 3.06683,-16.61378 4.25,-21.74282 1.18318,-5.12904 2.15123,-9.93253 2.15123,-10.67442 0,-0.74189 -6.975,-7.28127 -15.5,-14.53196 -8.525,-7.25068 -15.488,-13.69719 -15.47334,-14.32557 0.0147,-0.62839 2.83392,-7.89252 6.26502,-16.14252 l 6.23836,-15 7.98498,0.006 c 4.39174,0.003 14.03282,0.22816 21.42462,0.5 l 13.43965,0.494 6.42976,-10.5 c 3.53636,-5.775 9.18852,-14.25831 12.56035,-18.85181 3.37183,-4.59349 6.71812,-9.16101 7.4362,-10.15004 1.13731,-1.56644 0.20273,-4.00111 -7.25,-18.88709 -4.70558,-9.39886 -8.5556,-17.64958 -8.5556,-18.33493 0,-1.64749 23.10003,-24.77613 24.74548,-24.77613 0.7022,0 8.96672,3.85002 18.36558,8.5556 14.86044,7.43994 17.32112,8.38536 18.87001,7.25 14.41389,-10.56547 23.20349,-16.55807 31.26893,-21.31859 l 9.75,-5.75481 -0.009,-5.6161 c -0.005,-3.08886 -0.46136,-11.89349 -1.01452,-19.56586 -0.79291,-11.00074 -0.7382,-14.19298 0.259,-15.10024 1.74954,-1.59175 28.59423,-12.45 30.77994,-12.45 1.0578,0 6.73943,5.89557 14.05909,14.58849 14.07251,16.71268 10.61016,15.42694 29.92549,11.11279 6.325,-1.41271 15.32297,-3.08501 19.99548,-3.71621 4.67252,-0.63121 9.03374,-1.59436 9.69161,-2.14034 0.65786,-0.54598 3.73818,-8.61962 6.84514,-17.94142 L 468.20579,0 l 17.57668,0.27271 17.57667,0.2727 5.58271,16.52288 c 3.07048,9.08758 5.92729,17.04358 6.34846,17.68001 0.42117,0.63642 3.34617,1.45889 6.5,1.8277 7.45074,0.87128 34.52791,6.25037 37.88173,7.52548 3.28758,1.24994 3.09565,1.41493 16.0016,-13.75445 5.75635,-6.76589 11.08026,-12.30162 11.8309,-12.30162 0.75064,0 8.14972,2.7594 16.4424,6.13201 l 15.07761,6.132 -0.10021,7.618 c -0.0551,4.18989 -0.39262,12.09466 -0.75,17.56616 -0.52952,8.10683 -0.37215,10.24964 0.85021,11.57694 0.825,0.89583 6.25472,4.44227 12.06604,7.88098 5.81133,3.43871 15.17058,9.64125 20.79835,13.78343 l 10.2323,7.53124 16.85784,-8.61038 c 9.27182,-4.73571 17.4696,-8.61038 18.21729,-8.61038 1.70249,0 24.82818,23.07781 24.82818,24.77678 0,0.68571 -3.6,8.43616 -8,17.22322 -4.4,8.78706 -8,16.84724 -8,17.91151 0,1.06427 1.06241,3.20707 2.36092,4.76176 3.71959,4.45348 16.89524,24.13375 21.21528,31.68895 l 3.9238,6.86223 15.5,-0.80768 c 8.525,-0.44422 17.29886,-0.83222 19.49746,-0.86222 l 3.99746,-0.0546 6.17165,15 c 3.39442,8.25 6.20806,15.68242 6.25255,16.51649 0.0445,0.83407 -6.21912,6.8378 -13.91912,13.34161 -8.66681,7.32044 -14,12.52784 -14,13.66981 0,1.01457 1.11279,6.44038 2.47287,12.05735 1.36008,5.61697 3.1895,15.20814 4.06539,21.31371 0.87589,6.10556 1.93264,11.74909 2.34835,12.54116 0.41571,0.79207 8.37378,3.97931 17.68461,7.08274 l 16.92878,5.64262 0.27165,17.93147 0.27164,17.93148 -17.52079,5.80829 c -14.79237,4.90379 -17.59423,6.14738 -17.99235,7.98578 -0.25935,1.19762 -1.37902,7.71272 -2.48814,14.47801 -1.10913,6.76528 -2.92232,15.9396 -4.0293,20.38738 -1.10699,4.44777 -2.01271,8.5988 -2.01271,9.2245 0,0.62571 6.3,6.4672 14,12.9811 7.7,6.5139 14.00518,12.35264 14.01151,12.97498 0.0218,2.14818 -12.36343,31.55241 -13.43601,31.89879 -0.59152,0.19103 -8.7255,-0.15768 -18.0755,-0.77491 -9.35,-0.61723 -17.54328,-0.93974 -18.2073,-0.7167 -0.66401,0.22305 -4.20924,5.42727 -7.87829,11.56494 -3.66905,6.13767 -9.98826,15.73218 -14.0427,21.32114 -4.05444,5.58901 -7.37171,10.8818 -7.37171,11.76181 0,0.88001 3.6,8.78944 8,17.5765 4.4,8.78706 8,16.77661 8,17.75455 0,2.29652 -21.97786,24.24545 -24.27741,24.24545 -0.96036,0 -8.93553,-3.6 -17.72259,-8 -8.78706,-4.4 -16.68564,-8 -17.55239,-8 -0.86674,0 -6.54697,3.59736 -12.62271,7.99412 -6.07574,4.39677 -15.03022,10.29309 -19.89883,13.10293 -4.86862,2.80985 -9.37768,5.74218 -10.02015,6.5163 -0.89115,1.07378 -0.87928,5.93673 0.0501,20.51 0.66999,10.50638 0.84148,19.43697 0.38109,19.84575 -0.83352,0.74006 -30.72669,13.0309 -31.69315,13.0309 -0.27911,0 -6.23847,-6.75 -13.24302,-15 -7.00454,-8.25 -13.26821,-15 -13.91927,-15 -0.65105,0 -5.63827,1.09069 -11.0827,2.42375 -5.44443,1.33306 -14.84897,3.17759 -20.89897,4.09894 -6.05,0.92136 -11.45,2.09947 -12,2.61802 -0.55,0.51855 -3.96216,9.81153 -7.58258,20.65106 l -6.58259,19.70823 -17.129,0.27345 c -16.86561,0.26924 -17.15125,0.23849 -18.57612,-2 z m 52.89656,-176.31101 c 5.8585,-1.56174 17.8418,-6.39607 26.62956,-10.74297 36.29609,-17.95404 61.01702,-46.79506 74.21828,-86.58779 4.93957,-14.88936 5.41065,-18.39001 5.53474,-41.12882 0.11416,-20.91675 -0.51185,-27.10425 -3.95152,-39.05668 -11.92855,-41.45037 -39.82461,-74.68677 -77.57681,-92.42792 -23.21334,-10.9088 -36.75942,-13.9373 -62.13563,-13.89168 -22.47773,0.0405 -34.8381,2.37713 -54.4269,10.2894 -18.37668,7.42268 -30.35375,15.70139 -47.74601,33.00267 -15.01679,14.93824 -17.99949,19.00377 -26.05234,35.51032 -12.43769,25.49443 -15.43565,38.28405 -15.39721,65.68624 0.0243,17.36418 0.87386,25.17569 3.90535,35.91119 15.5763,55.16052 60.01109,96.07296 115.31392,106.17299 12.17536,2.22358 49.24635,0.57875 61.68457,-2.73695 z"/>
        </svg>`;

        const joblibIcon = new LabIcon({
          name: 'joblib-icon',
          svgstr: joblibSvg
        });

        registerFileType({
          name: 'vscode-joblib',
          displayName: 'joblib Pickle',
          extensions: ['.joblib'],
          fileFormat: 'base64',
          contentType: 'file',
          mimeTypes: ['application/octet-stream'],
          icon: joblibIcon
        });
      }

      // Register TXT files with custom document icon
      if (settings.enableDocIcons) {
        const txtSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3800 4800">
          <g><path fill="#c9cac6" d="M0 4800h3800V840L2960 0H0"/><path fill="#BBB" d="M2960 840h840L2960 0"/><path fill="#888" d="M3800 1680V840h-840"/></g>
          <g transform="translate(-32,-508.44444)"><path fill="#555555" d="M 900,1976 H 2900 V 1764 H 900 m 0,657 H 2900 V 2209 H 900 m 0,635 H 2100 V 2668 H 900"/></g>
          <g transform="translate(350,130) scale(0.82,0.95)"><path fill="#555555" stroke="#555555" stroke-width="100" stroke-linejoin="round" d="M 1162,3508 H 795 V 4491 H 491 V 3508 H 124 V 3272 H 1162 Z"/><path fill="#555555" stroke="#555555" stroke-width="100" stroke-linejoin="round" transform="translate(50,0)" d="M 2511,4491 h -351 l -254,-401 -258,401 h -335 l 417,-614 -409,-605 h 350 l 245,380 252,-380 h 336 l -411,593 z"/><path fill="#555555" stroke="#555555" stroke-width="100" stroke-linejoin="round" transform="translate(100,0)" d="M 3701,3508 h -367 v 983 h -304 v -983 h -367 v -236 h 1038 z"/></g>
        </svg>`;

        const txtIcon = new LabIcon({
          name: 'txt-icon',
          svgstr: txtSvg
        });

        registerFileType({
          name: 'vscode-txt',
          displayName: 'Text File',
          extensions: ['.txt'],
          fileFormat: 'text',
          contentType: 'file',
          mimeTypes: ['text/plain'],
          icon: txtIcon
        });
      }

      // Register MCP config files with custom icon
      if (settings.enableConfigIcons) {
        const mcpSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <path class="mcp-glyph" fill="#eee" d="M15.688 2.343a2.588 2.588 0 00-3.61 0l-9.626 9.44a.863.863 0 01-1.203 0 .823.823 0 010-1.18l9.626-9.44a4.313 4.313 0 016.016 0 4.116 4.116 0 011.204 3.54 4.3 4.3 0 013.609 1.18l.05.05a4.115 4.115 0 010 5.9l-8.706 8.537a.274.274 0 000 .393l1.788 1.754a.823.823 0 010 1.18.863.863 0 01-1.203 0l-1.788-1.753a1.92 1.92 0 010-2.754l8.706-8.538a2.47 2.47 0 000-3.54l-.05-.049a2.588 2.588 0 00-3.607-.003l-7.172 7.034-.002.002-.098.097a.863.863 0 01-1.204 0 .823.823 0 010-1.18l7.273-7.133a2.47 2.47 0 00-.003-3.537z"/>
          <path class="mcp-glyph" fill="#eee" d="M14.485 4.703a.823.823 0 000-1.18.863.863 0 00-1.204 0l-7.119 6.982a4.115 4.115 0 000 5.9 4.314 4.314 0 006.016 0l7.12-6.982a.823.823 0 000-1.18.863.863 0 00-1.204 0l-7.119 6.982a2.588 2.588 0 01-3.61 0 2.47 2.47 0 010-3.54l7.12-6.982z"/>
        </svg>`;

        const mcpIcon = new LabIcon({
          name: 'mcp-icon',
          svgstr: mcpSvg
        });

        registerFileType({
          name: 'vscode-mcp',
          displayName: 'MCP Configuration',
          pattern: '^\\.mcp\\.json(\\..*)?$',
          fileFormat: 'text',
          contentType: 'file',
          mimeTypes: ['application/json'],
          icon: mcpIcon
        });
      }

      // Register Prettier config files with custom colorful bars icon
      if (settings.enableConfigIcons) {
        const prettierSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
          <path d="M21.714,8.571h1.143a.571.571,0,0,1,.571.571.571.571,0,0,1-.571.571H21.714a.571.571,0,0,1-.571-.571A.571.571,0,0,1,21.714,8.571Z" fill="#56b3b4"/>
          <path d="M4.571,26.857h5.714a.571.571,0,0,1,.571.571.571.571,0,0,1-.571.571H4.571A.571.571,0,0,1,4,27.429.571.571,0,0,1,4.571,26.857Z" fill="#ea5e5e"/>
          <path d="M18.286,17.714h3.429a.571.571,0,0,1,.571.571.571.571,0,0,1-.571.571H18.286a.571.571,0,0,1-.571-.571A.571.571,0,0,1,18.286,17.714Z" fill="#bf85bf"/>
          <path d="M11.429,17.714H16a.571.571,0,0,1,.571.571.571.571,0,0,1-.571.571H11.429a.571.571,0,0,1-.571-.571A.571.571,0,0,1,11.429,17.714Z" fill="#ea5e5e"/>
          <path d="M4.571,17.714H9.143a.571.571,0,0,1,.571.571.571.571,0,0,1-.571.571H4.571A.571.571,0,0,1,4,18.286.571.571,0,0,1,4.571,17.714Z" fill="#56b3b4"/>
          <path d="M4.571,22.286h5.714a.571.571,0,0,1,.571.571.571.571,0,0,1-.571.571H4.571A.571.571,0,0,1,4,22.857.571.571,0,0,1,4.571,22.286Z" fill="#bf85bf"/>
          <path d="M4.571,13.143h5.714a.571.571,0,0,1,.571.571.571.571,0,0,1-.571.571H4.571A.571.571,0,0,1,4,13.714.571.571,0,0,1,4.571,13.143Z" fill="#bf85bf"/>
          <path d="M10.286,6.286H21.714a.571.571,0,0,1,.571.571.571.571,0,0,1-.571.571H10.286a.571.571,0,0,1-.571-.571A.571.571,0,0,1,10.286,6.286Z" fill="#f7ba3e"/>
          <path d="M4.571,6.286H8a.571.571,0,0,1,.571.571A.571.571,0,0,1,8,7.429H4.571A.571.571,0,0,1,4,6.857.571.571,0,0,1,4.571,6.286Z" fill="#ea5e5e"/>
          <path d="M9.143,24.571h1.143a.571.571,0,0,1,.571.571.571.571,0,0,1-.571.571H9.143a.571.571,0,0,1-.571-.571A.571.571,0,0,1,9.143,24.571Z" fill="#f7ba3e"/>
          <path d="M9.143,10.857h1.143a.571.571,0,0,1,.571.571.571.571,0,0,1-.571.571H9.143a.571.571,0,0,1-.571-.571A.571.571,0,0,1,9.143,10.857Z" fill="#56b3b4"/>
          <path d="M4.571,24.571H6.857a.571.571,0,0,1,.571.571.571.571,0,0,1-.571.571H4.571A.571.571,0,0,1,4,25.143.571.571,0,0,1,4.571,24.571Z" fill="#56b3b4"/>
          <path d="M4.571,10.857H6.857a.571.571,0,0,1,.571.571A.571.571,0,0,1,6.857,12H4.571A.571.571,0,0,1,4,11.429.571.571,0,0,1,4.571,10.857Z" fill="#f7ba3e"/>
          <path d="M13.714,15.429h9.143a.571.571,0,0,1,.571.571.571.571,0,0,1-.571.571H13.714a.571.571,0,0,1-.571-.571A.571.571,0,0,1,13.714,15.429Z" fill="#56b3b4"/>
          <path d="M8,15.429h3.429A.571.571,0,0,1,12,16a.571.571,0,0,1-.571.571H8A.571.571,0,0,1,7.429,16A.571.571,0,0,1,8,15.429Z" fill="#f7ba3e"/>
          <path d="M4.571,15.429H5.714A.571.571,0,0,1,6.286,16a.571.571,0,0,1-.571.571H4.571A.571.571,0,0,1,4,16A.571.571,0,0,1,4.571,15.429Z" fill="#ea5e5e"/>
          <path d="M14.857,8.571h4.571A.571.571,0,0,1,20,9.143a.571.571,0,0,1-.571.571H14.857a.571.571,0,0,1-.571-.571A.571.571,0,0,1,14.857,8.571Z" fill="#bf85bf"/>
          <path d="M4.571,8.571h8a.571.571,0,0,1,.571.571.571.571,0,0,1-.571.571h-8A.571.571,0,0,1,4,9.143.571.571,0,0,1,4.571,8.571Z" fill="#56b3b4"/>
          <path d="M8,20H18.286a.571.571,0,0,1,.571.571.571.571,0,0,1-.571.571H8a.571.571,0,0,1-.571-.571A.571.571,0,0,1,8,20Z" fill="#f7ba3e"/>
          <path d="M4.571,20H5.714a.571.571,0,0,1,.571.571.571.571,0,0,1-.571.571H4.571A.571.571,0,0,1,4,20.571.571.571,0,0,1,4.571,20Z" fill="#bf85bf"/>
          <path d="M18.286,10.857H24a.571.571,0,0,1,.571.571A.571.571,0,0,1,24,12H18.286a.571.571,0,0,1-.571-.571A.571.571,0,0,1,18.286,10.857Z" fill="#ea5e5e"/>
          <path d="M18.286,13.143H24a.571.571,0,0,1,.571.571.571.571,0,0,1-.571.571H18.286a.571.571,0,0,1-.571-.571A.571.571,0,0,1,18.286,13.143Z" fill="#f7ba3e"/>
          <path d="M4.571,4H18.286a.571.571,0,0,1,.571.571.571.571,0,0,1-.571.571H4.571A.571.571,0,0,1,4,4.571.571.571,0,0,1,4.571,4Z" fill="#56b3b4"/>
        </svg>`;

        const prettierIcon = new LabIcon({
          name: 'prettier-icon',
          svgstr: prettierSvg
        });

        registerFileType({
          name: 'vscode-prettier',
          displayName: 'Prettier Configuration',
          pattern:
            '^(\\.prettierrc(\\..*)?|prettier\\.config\\..+|\\.prettierignore)$',
          fileFormat: 'text',
          contentType: 'file',
          mimeTypes: ['text/plain'],
          icon: prettierIcon
        });
      }

      // Register shell scripts with terminal-linux icon ($ prompt, theme-aware via jp- classes)
      if (settings.enableLanguageIcons) {
        const shellSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <path fill="#767676" d="M2 2h20v20H2z" class="shell-tile jp-terminal-icon-background-color jp-icon-selectable"/>
          <path fill="#fff" d="M9.01 14.762q0-.246-.077-.434a.9.9 0 0 0-.234-.351 1.6 1.6 0 0 0-.422-.288 5 5 0 0 0-.627-.263q-.592-.211-1.078-.446a3.5 3.5 0 0 1-.832-.544 2.2 2.2 0 0 1-.528-.721 2.4 2.4 0 0 1-.187-.985q0-.498.17-.908a2.1 2.1 0 0 1 .48-.72q.31-.306.75-.493.44-.188.979-.24V7.11h.937v1.272q.527.07.95.287.421.217.714.568.3.345.457.82.165.47.164 1.055H8.998q0-.709-.323-1.072-.322-.37-.873-.37-.299 0-.521.083a.9.9 0 0 0-.358.223.9.9 0 0 0-.21.334q-.066.194-.065.421 0 .23.064.41a.9.9 0 0 0 .229.329q.165.152.428.293.263.134.656.275.591.223 1.072.463.48.235.82.55.346.312.528.727.187.41.187.973 0 .515-.17.932-.17.41-.486.709t-.762.48a3.7 3.7 0 0 1-.996.229v1.148h-.931V17.1a4 4 0 0 1-.967-.217 2.6 2.6 0 0 1-.832-.504 2.4 2.4 0 0 1-.574-.826q-.217-.505-.217-1.207h1.635q0 .421.123.709.123.281.316.45.2.165.451.235.252.07.516.07.627 0 .949-.292a.98.98 0 0 0 .322-.756m8.36 3.51h-5.343V17h5.344z" class="shell-glyph jp-terminal-icon-color jp-icon-selectable-inverse"/>
        </svg>`;

        const shellIcon = new LabIcon({
          name: 'shell-icon',
          svgstr: shellSvg
        });

        registerFileType({
          name: 'vscode-shell',
          displayName: 'Shell Script',
          extensions: ['.sh', '.bash', '.zsh', '.fish', '.csh', '.nu'],
          fileFormat: 'text',
          contentType: 'file',
          mimeTypes: ['text/x-sh'],
          icon: shellIcon
        });
      }

      // Register batch files with terminal-win icon (> prompt, blue background)
      if (settings.enableLanguageIcons) {
        const batchSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
          <path fill="#0288D1" d="M20 19.8h160v159.9H20z" class="jp-console-icon-background-color jp-icon-selectable"/>
          <path fill="#fff" d="M105 127.3h40v12.8h-40zM51.1 77 74 99.9l-23.3 23.3 10.5 10.5 23.3-23.3L95 99.9 84.5 89.4 61.6 66.5z" class="jp-console-icon-color jp-icon-selectable-inverse"/>
        </svg>`;

        const batchIcon = new LabIcon({
          name: 'batch-icon',
          svgstr: batchSvg
        });

        registerFileType({
          name: 'vscode-batch',
          displayName: 'Batch File',
          extensions: ['.bat', '.cmd'],
          fileFormat: 'text',
          contentType: 'file',
          mimeTypes: ['text/plain'],
          icon: batchIcon
        });
      }

      // Note: uv.lock icon is handled via MutationObserver + CSS override
      // (see injectIconOverrideCSS function) since pattern-only registration
      // doesn't work reliably for files without standard extensions
    };

    // Debounce timer for settings change alert
    let settingsChangeTimeout: any = null;

    // Load settings
    if (settingRegistry) {
      settingRegistry
        .load(PLUGIN_ID)
        .then(loadedSettings => {
          // Update settings from registry
          Object.keys(settings).forEach(key => {
            const value = loadedSettings.get(key).composite;
            if (typeof value === 'boolean') {
              settings[key as keyof IIconSettings] = value;
            }
          });

          registerFileTypes();

          // Listen for settings changes
          loadedSettings.changed.connect(() => {
            Object.keys(settings).forEach(key => {
              const value = loadedSettings.get(key).composite;
              if (typeof value === 'boolean') {
                settings[key as keyof IIconSettings] = value;
              }
            });

            // Debounce the alert to show only once when multiple settings change
            if (settingsChangeTimeout) {
              clearTimeout(settingsChangeTimeout);
            }

            settingsChangeTimeout = setTimeout(() => {
              alert(
                'VSCode Icons settings changed. Please refresh the page to apply changes.'
              );
              settingsChangeTimeout = null;
            }, 500);
          });
        })
        .catch(reason => {
          console.error(
            'Failed to load settings for jupyterlab_vscode_icons_extension.',
            reason
          );
          // Register with default settings
          registerFileTypes();
        });
    } else {
      // No settings registry, use defaults
      registerFileTypes();
    }
  }
};

export default plugin;
