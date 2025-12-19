import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { LabIcon } from '@jupyterlab/ui-components';
import { getIconSVG } from './icons';

const PLUGIN_ID = 'jupyterlab_vscode_icons_extension:plugin';

// Icon groups for settings
interface IIconSettings {
  enableLanguageIcons: boolean;
  enableWebIcons: boolean;
  enableDataIcons: boolean;
  enableConfigIcons: boolean;
  enableDocIcons: boolean;
  enableImageIcons: boolean;
}

/**
 * Create a LabIcon from vscode-icons SVG data
 */
function createLabIcon(iconName: string): LabIcon {
  const svgBody = getIconSVG(iconName);
  const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${svgBody}</svg>`;

  return new LabIcon({
    name: `vscode-icons:${iconName}`,
    svgstr: svgStr
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
    iconName: 'file-type-java',
    group: 'enableLanguageIcons'
  },
  {
    extensions: ['.c'],
    iconName: 'file-type-c',
    group: 'enableLanguageIcons'
  },
  {
    extensions: ['.cpp', '.cc', '.cxx'],
    iconName: 'file-type-cpp',
    group: 'enableLanguageIcons'
  },
  {
    extensions: ['.h', '.hpp'],
    iconName: 'file-type-c',
    group: 'enableLanguageIcons'
  },
  {
    extensions: ['.cs'],
    iconName: 'file-type-csharp',
    group: 'enableLanguageIcons'
  },
  {
    extensions: ['.go'],
    iconName: 'file-type-go',
    group: 'enableLanguageIcons'
  },
  {
    extensions: ['.rs'],
    iconName: 'file-type-rust',
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
  // Shell scripts (.sh, .bash, .zsh) and batch files (.bat, .cmd) use custom icons with black backgrounds
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
    iconName: 'file-type-text',
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
    pattern: '^(\\.env\\.(?!zip|tar|gz|bz2|xz|7z|rar)[^.]+|[^.]+\\.env)$',
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
    pattern: '^yarn\\.lock$',
    extensions: [],
    iconName: 'file-type-yarn',
    group: 'enableConfigIcons'
  },
  {
    pattern: '^requirements\\.txt$',
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
    pattern: '^(terraform\\.tfvars\\..*|\\.terraform\\.lock\\..*|\\.terraform\\.tfstate\\.lock\\..*)$',
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

const plugin: JupyterFrontEndPlugin<void> = {
  id: PLUGIN_ID,
  description:
    'Jupyterlab extension with a shameless rip-off of the vscode-icons into our beloved environment',
  autoStart: true,
  optional: [ISettingRegistry],
  activate: (
    app: JupyterFrontEnd,
    settingRegistry: ISettingRegistry | null
  ) => {
    const { docRegistry } = app;

    // Function to inject CSS that overrides Jupytext icons
    const injectIconOverrideCSS = () => {

      // Get icons: Claude (VSCode), Office (VSCode)
      const claudeIcon = createLabIcon('file-type-claude');
      const wordIcon = createLabIcon('file-type-word');
      const excelIcon = createLabIcon('file-type-excel');
      const powerpointIcon = createLabIcon('file-type-powerpoint');

      // Custom Markdown icon (from markdown.svg - purple M with arrow, darker #7a2491)
      const markdownSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 309 327">
        <path fill="#7a2491" opacity="1" stroke="none" d="m 138.68393,230.48651 c 36.58836,3.1e-4 72.68422,3.1e-4 108.78008,3.1e-4 0.13988,0.49669 0.0821,0.12537 -3.34406,3.81472 -27.34165,24.16766 -54.43119,49.41695 -81.72391,73.62893 -2.65146,2.35216 -4.5582,3.21609 -7.64686,0.37229 -26.89754,-24.76539 -75.191307,-68.40096 -80.889724,-74.12425 -0.744118,-0.74735 -1.274501,-1.57204 -2.95867,-3.69233 23.309236,0 45.299954,0 67.783144,3.3e-4 z"/>
        <path fill="#7a2491" d="m 61.156397,14.443673 h 69.176263 q 14.81059,56.661581 23.29958,97.452667 l 5.96036,-27.150338 q 3.61233,-15.870486 7.76652,-30.954008 l 10.6564,-39.348321 H 248.6367 L 276.09047,189.5437 H 221.90541 L 207.27544,69.137838 173.50009,189.5437 H 136.47364 L 101.07273,68.875516 86.984609,189.5437 H 35.147571 Z"/>
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

      // Custom README icon (info icon - centered, color #912bac from info2.svg)
      const readmeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <path fill="#912bac" d="m 9.5247234,11.42511 v 76.943619 l 2.1166666,2.116667 h 77.809717 l 2.116667,-2.116667 v -76.94362 l -2.116667,-2.1166662 -77.809717,0 z m 36.2115596,9.141612 h 11.01003 l 2.116667,2.116667 0,7.619586 -2.116667,2.116667 h -11.01003 l -2.116667,-2.116667 v -7.619586 z m -6.168542,19.478681 h 23.084596 l 2.116667,2.116667 v 5.700733 l -2.116597,2.09951 -3.175139,-0.02574 -2.116597,2.09951 V 67.32187 l 2.116667,2.116667 h 4.211629 l 2.116667,2.116667 v 5.567219 L 63.688967,79.23909 H 38.509408 l -2.116667,-2.116667 v -6.096386 l 2.116667,-2.116667 h 4.968955 L 45.59503,66.792703 V 52.096294 l -2.116667,-2.116667 h -3.910622 l -2.116667,-2.116667 0,-5.70089 z"/>
      </svg>`;

      // Get SVG content from VSCode icons
      const claudeSvg = claudeIcon.svgstr;
      const wordSvg = wordIcon?.svgstr || '';
      const excelSvg = excelIcon?.svgstr || '';
      const powerpointSvg = powerpointIcon?.svgstr || '';
      const svgFileIcon = createLabIcon('file-type-image');
      const svgFileSvg = svgFileIcon?.svgstr || '';

      // Create base64 encoded data URIs
      const pythonDataUri = `data:image/svg+xml;base64,${btoa(pythonSvg)}`;
      const markdownDataUri = `data:image/svg+xml;base64,${btoa(markdownSvg)}`;
      const claudeDataUri = `data:image/svg+xml;base64,${btoa(claudeSvg)}`;
      const readmeDataUri = `data:image/svg+xml;base64,${btoa(readmeSvg)}`;
      const pdfDataUri = `data:image/svg+xml;base64,${btoa(pdfSvg)}`;
      const wordDataUri = wordSvg ? `data:image/svg+xml;base64,${btoa(wordSvg)}` : '';
      const excelDataUri = excelSvg ? `data:image/svg+xml;base64,${btoa(excelSvg)}` : '';
      const powerpointDataUri = powerpointSvg ? `data:image/svg+xml;base64,${btoa(powerpointSvg)}` : '';
      const svgFileDataUri = svgFileSvg ? `data:image/svg+xml;base64,${btoa(svgFileSvg)}` : '';

      // Inject CSS that overrides icons for .py and .md files
      // Note: Jupytext marks .py and .md files as type="notebook", so we need to
      // use JavaScript to detect and mark these files for CSS targeting
      const style = document.createElement('style');
      style.id = 'vscode-icons-jupytext-override';
      style.textContent = `
        /* Override Python file icons (.py files shown as notebooks by Jupytext) */
        .jp-DirListing-item[data-file-type="notebook"][data-jupytext-py] .jp-DirListing-itemIcon svg,
        .jp-DirListing-item[data-file-type="notebook"][data-jupytext-py] .jp-DirListing-itemIcon img {
          display: none !important;
        }
        .jp-DirListing-item[data-file-type="notebook"][data-jupytext-py] .jp-DirListing-itemIcon::before {
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
        .jp-DirListing-item[data-file-type="notebook"][data-jupytext-md] .jp-DirListing-itemIcon svg,
        .jp-DirListing-item[data-file-type="notebook"][data-jupytext-md] .jp-DirListing-itemIcon img {
          display: none !important;
        }
        .jp-DirListing-item[data-file-type="notebook"][data-jupytext-md] .jp-DirListing-itemIcon::before {
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
        .jp-DirListing-item[data-file-type="notebook"][data-claude-md] .jp-DirListing-itemIcon svg,
        .jp-DirListing-item[data-file-type="notebook"][data-claude-md] .jp-DirListing-itemIcon img {
          display: none !important;
        }
        .jp-DirListing-item[data-file-type="notebook"][data-claude-md] .jp-DirListing-itemIcon::before {
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
        .jp-DirListing-item[data-file-type="notebook"][data-readme-md] .jp-DirListing-itemIcon svg,
        .jp-DirListing-item[data-file-type="notebook"][data-readme-md] .jp-DirListing-itemIcon img {
          display: none !important;
        }
        .jp-DirListing-item[data-file-type="notebook"][data-readme-md] .jp-DirListing-itemIcon {
          display: flex !important;
          justify-content: center !important;
          align-items: center !important;
        }
        .jp-DirListing-item[data-file-type="notebook"][data-readme-md] .jp-DirListing-itemIcon::before {
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
        .jp-DirListing-item[data-vscode-pdf] .jp-DirListing-itemIcon img {
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

        /* Override Word file icon with VSCode Word icon */
        .jp-DirListing-item[data-vscode-word] .jp-DirListing-itemIcon svg,
        .jp-DirListing-item[data-vscode-word] .jp-DirListing-itemIcon img {
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
        .jp-DirListing-item[data-vscode-excel] .jp-DirListing-itemIcon img {
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
        .jp-DirListing-item[data-vscode-powerpoint] .jp-DirListing-itemIcon img {
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
        .jp-DirListing-item[data-vscode-svg-override] .jp-DirListing-itemIcon img {
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
      `;

      // Add CSS to make JavaScript and .env icons less bright
      style.textContent += `
        /* Reduce brightness of JavaScript and .env icons */
        .jp-DirListing-item[data-file-type*="js"] .jp-DirListing-itemIcon svg,
        .jp-DirListing-item[data-file-type="vscode-file-type-js-official"] .jp-DirListing-itemIcon svg,
        .jp-DirListing-item[data-file-type="vscode-file-type-dotenv"] .jp-DirListing-itemIcon svg {
          filter: brightness(0.85) saturate(0.85);
        }

        /* Desaturate and dim npm icons */
        .jp-DirListing-item[data-file-type="vscode-file-type-npm"] .jp-DirListing-itemIcon svg {
          filter: brightness(0.85) saturate(0.75);
        }


        /* Make hidden items darker (items starting with .) */
        .jp-DirListing-item[data-is-dot] {
          opacity: 55% !important;
        }
      `;

      // Add a MutationObserver to mark special files in the file browser
      const markSpecialFiles = () => {
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

          const name = nameSpan.textContent.trim();

          // Handle notebook files (Jupytext and special markdown)
          if (fileType === 'notebook') {
            // Clear all notebook attributes first
            item.removeAttribute('data-claude-md');
            item.removeAttribute('data-readme-md');
            item.removeAttribute('data-jupytext-py');
            item.removeAttribute('data-jupytext-md');

            // Set the correct attribute based on filename
            if (name === 'CLAUDE.md') {
              item.setAttribute('data-claude-md', 'true');
            } else if (name === 'README.md') {
              item.setAttribute('data-readme-md', 'true');
            } else if (name.endsWith('.py')) {
              item.setAttribute('data-jupytext-py', 'true');
            } else if (name.endsWith('.md')) {
              item.setAttribute('data-jupytext-md', 'true');
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

          // Clear all office/pdf attributes first
          item.removeAttribute('data-vscode-pdf');
          item.removeAttribute('data-vscode-word');
          item.removeAttribute('data-vscode-excel');
          item.removeAttribute('data-vscode-powerpoint');

          // Set the correct attribute based on extension
          if (nameLower.endsWith('.pdf')) {
            item.setAttribute('data-vscode-pdf', 'true');
          } else if (nameLower.endsWith('.doc') || nameLower.endsWith('.docx')) {
            item.setAttribute('data-vscode-word', 'true');
          } else if (nameLower.endsWith('.xls') || nameLower.endsWith('.xlsx') || nameLower.endsWith('.xlsm')) {
            item.setAttribute('data-vscode-excel', 'true');
          } else if (nameLower.endsWith('.ppt') || nameLower.endsWith('.pptx')) {
            item.setAttribute('data-vscode-powerpoint', 'true');
          }

          // Force SVG icon for .svg files (override any incorrect file type detection)
          item.removeAttribute('data-vscode-svg-override');
          if (nameLower.endsWith('.svg')) {
            item.setAttribute('data-vscode-svg-override', 'true');
          }
        });
      };

      // Watch for changes in the file browser
      const observer = new MutationObserver(() => {
        markSpecialFiles();
      });

      // Start observing when the file browser is ready
      setTimeout(() => {
        const fileBrowser = document.querySelector('.jp-DirListing-content');
        if (fileBrowser) {
          observer.observe(fileBrowser, {
            childList: true,
            subtree: true
          });
          markSpecialFiles();
        }
      }, 1000);

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
    });

    // Default settings
    const settings: IIconSettings = {
      enableLanguageIcons: true,
      enableWebIcons: true,
      enableDataIcons: true,
      enableConfigIcons: true,
      enableDocIcons: true,
      enableImageIcons: true
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

        const icon = createLabIcon(config.iconName);
        const fileTypeName = `vscode-${config.iconName}`;

        // Register file type
        const fileTypeOptions: any = {
          name: fileTypeName,
          icon: icon,
          fileFormat: 'text',
          contentType: 'file'
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

        docRegistry.addFileType(fileTypeOptions);
      });

      // Register Makefile with custom icon (document with gears, from text-x-makefile-svgrepo-com.svg)
      const makefileSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="19 7 90 114">
        <path fill="#c2544f" d="m 29.09375,11.234375 c -3.183804,0 -5.71875,2.566196 -5.71875,5.75 l 0,94.031255 c 0,3.1838 2.534946,5.75 5.71875,5.75 l 69.8125,0 c 3.1838,0 5.71875,-2.5662 5.71875,-5.75 l 0,-70.656255 -21.03125,0 c -4.306108,0 -8.0625,-3.141109 -8.0625,-7.3125 l 0,-21.8125 -46.4375,0 z m 50.4375,0 0,21.8125 c 0,1.714122 1.631968,3.3125 4.0625,3.3125 l 21.03125,0 -25.09375,-25.125 z m -32.34375,29.3125 1.71875,0 1.65625,3.5 0.03125,0.75 -0.53125,2.4375 3.25,1.3125 1.3125,-2.0625 0.59375,-0.53125 3.59375,-1.25 1.25,1.21875 -1.28125,3.59375 -0.5,0.59375 -2.0625,1.3125 1.3125,3.28125 2.40625,-0.5625 0.78125,0.03125 3.46875,1.65625 0,1.75 -3.46875,1.65625 -0.78125,0 -2.40625,-0.5 -1.3125,3.21875 2.0625,1.375 0.5,0.59375 1.28125,3.59375 -1.25,1.25 -3.59375,-1.28125 -0.59375,-0.5625 -1.3125,-2.0625 -3.25,1.34375 0.53125,2.40625 -0.03125,0.78125 -1.65625,3.4375 -1.71875,0 -1.65625,-3.4375 -0.0625,-0.78125 0.53125,-2.40625 -3.25,-1.34375 -1.3125,2.0625 -0.59375,0.5625 -3.59375,1.28125 -1.25,-1.25 1.28125,-3.59375 0.5625,-0.59375 2.0625,-1.375 -1.34375,-3.21875 -2.40625,0.5 -0.8125,0 -3.46875,-1.65625 0,-1.75 3.46875,-1.65625 0.8125,-0.03125 2.40625,0.5625 1.34375,-3.28125 -2.0625,-1.3125 -0.5625,-0.59375 L 36,45.921875 l 1.25,-1.21875 3.59375,1.25 0.59375,0.53125 1.3125,2.0625 3.25,-1.3125 -0.53125,-2.4375 0.0625,-0.75 1.65625,-3.5 z m 0.875,10.875 c -2.927972,0 -5.34375,2.353278 -5.34375,5.28125 0,2.927972 2.415778,5.3125 5.34375,5.3125 2.927972,0 5.28125,-2.384528 5.28125,-5.3125 0,-2.927972 -2.353278,-5.28125 -5.28125,-5.28125 z m 18.15625,10.3125 3.09375,3.34375 0.46875,1.15625 0.40625,2.75 4.46875,0 0.40625,-2.75 0.4375,-1.15625 3.125,-3.34375 2.25,0.71875 0.53125,4.53125 -0.28125,1.21875 -1.3125,2.4375 3.625,2.65625 1.90625,-2 1.0625,-0.625 4.5,-0.90625 1.375,1.90625 -2.21875,3.96875 -0.96875,0.8125 -2.46875,1.1875 1.40625,4.28125 2.71875,-0.46875 1.21875,0.09375 4.15625,1.90625 0,2.34375 -4.15625,1.9375 -1.21875,0.09375 -2.71875,-0.46875 -1.40625,4.25 2.46875,1.21875 0.96875,0.78125 2.21875,4.03125 -1.375,1.875 -4.5,-0.875 -1.0625,-0.65625 -1.90625,-2 -3.625,2.65625 1.3125,2.406255 0.28125,1.21875 -0.53125,4.5625 -2.25,0.75 -3.125,-3.40625 -0.4375,-1.125 -0.40625,-2.71875 -4.46875,0 -0.40625,2.71875 -0.46875,1.125 -3.09375,3.40625 -2.25,-0.75 -0.53125,-4.5625 0.3125,-1.21875 1.28125,-2.406255 -3.625,-2.65625 -1.9375,2 -1.0625,0.65625 -4.46875,0.875 -1.375,-1.875 2.21875,-4.03125 0.9375,-0.78125 2.46875,-1.21875 -1.34375,-4.25 -2.71875,0.46875 -1.21875,-0.09375 -4.1875,-1.9375 0,-2.34375 4.1875,-1.90625 1.21875,-0.09375 2.71875,0.46875 1.34375,-4.28125 -2.46875,-1.1875 -0.9375,-0.8125 -2.21875,-3.96875 1.375,-1.90625 4.46875,0.90625 1.0625,0.625 1.9375,2 3.625,-2.65625 -1.28125,-2.4375 -0.3125,-1.21875 0.53125,-4.53125 2.25,-0.71875 z m 6.1875,14.09375 c -4.866236,0 -8.8125,3.946264 -8.8125,8.8125 0,4.866238 3.946264,8.8125 8.8125,8.8125 4.866237,0 8.8125,-3.946262 8.8125,-8.8125 0,-4.866236 -3.946263,-8.8125 -8.8125,-8.8125 z"/>
      </svg>`;

      const makefileIcon = new LabIcon({
        name: 'makefile-icon',
        svgstr: makefileSvg
      });

      docRegistry.addFileType({
        name: 'vscode-makefile',
        displayName: 'Makefile',
        extensions: ['.mk', '.mak', '.make'],
        pattern: '^(Makefile|makefile|GNUmakefile)$',
        fileFormat: 'text',
        contentType: 'file',
        icon: makefileIcon
      });

      // Register LICENSE with custom copyright icon (C in circle)
      const licenseSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="11" fill="none" stroke="#4a90e2" stroke-width="3"/>
        <path fill="#4a90e2" stroke="#4a90e2" stroke-width="0.5" d="M19 19.5c-0.8 0.8-2 1.3-3.2 1.3c-2.5 0-4.5-2-4.5-4.5s2-4.5 4.5-4.5c1.2 0 2.3 0.5 3.2 1.3l1.2-1.2c-1.1-1.1-2.6-1.8-4.3-1.8c-3.4 0-6.2 2.8-6.2 6.2s2.8 6.2 6.2 6.2c1.7 0 3.2-0.7 4.3-1.8L19 19.5z"/>
      </svg>`;

      const licenseIcon = new LabIcon({
        name: 'license-icon',
        svgstr: licenseSvg
      });

      docRegistry.addFileType({
        name: 'vscode-license',
        displayName: 'License',
        pattern: '^(LICENSE|LICENCE|LICENSE\\..*|LICENCE\\..*)$',
        fileFormat: 'text',
        contentType: 'file',
        icon: licenseIcon
      });

      // Register CLAUDE.md with Claude icon (always register, not conditional on settings)
      const claudeIcon = createLabIcon('file-type-claude');
      if (claudeIcon) {
        docRegistry.addFileType({
          name: 'vscode-claude-md',
          displayName: 'Claude Configuration',
          pattern: '^CLAUDE\\.md$',
          fileFormat: 'text',
          contentType: 'file',
          icon: claudeIcon
        });
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

      docRegistry.addFileType({
        name: 'vscode-readme',
        displayName: 'README',
        pattern: '^README\\.md$',
        fileFormat: 'text',
        contentType: 'file',
        icon: readmeIcon
      });

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

        docRegistry.addFileType({
          name: 'vscode-drawio',
          displayName: 'Draw.io Diagram',
          extensions: ['.drawio', '.dio'],
          fileFormat: 'text',
          contentType: 'file',
          icon: drawioIcon
        });
      }

      // Register MCP config files with custom icon
      if (settings.enableConfigIcons) {
        const mcpSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <path fill="#eee" d="M15.688 2.343a2.588 2.588 0 00-3.61 0l-9.626 9.44a.863.863 0 01-1.203 0 .823.823 0 010-1.18l9.626-9.44a4.313 4.313 0 016.016 0 4.116 4.116 0 011.204 3.54 4.3 4.3 0 013.609 1.18l.05.05a4.115 4.115 0 010 5.9l-8.706 8.537a.274.274 0 000 .393l1.788 1.754a.823.823 0 010 1.18.863.863 0 01-1.203 0l-1.788-1.753a1.92 1.92 0 010-2.754l8.706-8.538a2.47 2.47 0 000-3.54l-.05-.049a2.588 2.588 0 00-3.607-.003l-7.172 7.034-.002.002-.098.097a.863.863 0 01-1.204 0 .823.823 0 010-1.18l7.273-7.133a2.47 2.47 0 00-.003-3.537z"/>
          <path fill="#eee" d="M14.485 4.703a.823.823 0 000-1.18.863.863 0 00-1.204 0l-7.119 6.982a4.115 4.115 0 000 5.9 4.314 4.314 0 006.016 0l7.12-6.982a.823.823 0 000-1.18.863.863 0 00-1.204 0l-7.119 6.982a2.588 2.588 0 01-3.61 0 2.47 2.47 0 010-3.54l7.12-6.982z"/>
        </svg>`;

        const mcpIcon = new LabIcon({
          name: 'mcp-icon',
          svgstr: mcpSvg
        });

        docRegistry.addFileType({
          name: 'vscode-mcp',
          displayName: 'MCP Configuration',
          pattern: '^\\.mcp\\.json(\\..*)?$',
          fileFormat: 'text',
          contentType: 'file',
          icon: mcpIcon
        });
      }

      // Register shell scripts with custom black background and desaturated orange icon
      if (settings.enableLanguageIcons) {
        const shellSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
          <rect x="1" y="3" width="30" height="26" rx="2" fill="#1a1a1a"/>
          <path fill="#e8b070" d="M29.4 27.6H2.5V4.5h26.9Zm-25.9-1h24.9V5.5H3.5Z"/>
          <path fill="#e8b070" d="m6.077 19.316l-.555-.832l4.844-3.229l-4.887-4.071l.641-.768l5.915 4.928zM12.7 18.2h7.8v1h-7.8zM2.5 5.5h26.9v1.9H2.5z"/>
        </svg>`;

        const shellIcon = new LabIcon({
          name: 'shell-icon',
          svgstr: shellSvg
        });

        docRegistry.addFileType({
          name: 'vscode-shell',
          displayName: 'Shell Script',
          extensions: ['.sh', '.bash', '.zsh'],
          fileFormat: 'text',
          contentType: 'file',
          icon: shellIcon
        });
      }

      // Register batch files with custom black background and desaturated blue icon
      if (settings.enableLanguageIcons) {
        const batchSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
          <rect x="1" y="3" width="30" height="26" rx="2" fill="#1a1a1a"/>
          <path fill="#80c8f0" d="M29.4 27.6H2.5V4.5h26.9Zm-25.9-1h24.9V5.5H3.5Z"/>
          <path fill="#80c8f0" d="m6.077 19.316l-.555-.832l4.844-3.229l-4.887-4.071l.641-.768l5.915 4.928zM12.7 18.2h7.8v1h-7.8zM2.5 5.5h26.9v1.9H2.5z"/>
        </svg>`;

        const batchIcon = new LabIcon({
          name: 'batch-icon',
          svgstr: batchSvg
        });

        docRegistry.addFileType({
          name: 'vscode-batch',
          displayName: 'Batch File',
          extensions: ['.bat', '.cmd'],
          fileFormat: 'text',
          contentType: 'file',
          icon: batchIcon
        });
      }
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
