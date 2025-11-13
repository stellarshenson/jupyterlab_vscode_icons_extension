import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { LabIcon, markdownIcon } from '@jupyterlab/ui-components';
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
  {
    extensions: ['.sh', '.bash', '.zsh'],
    iconName: 'file-type-shell',
    group: 'enableLanguageIcons'
  },
  {
    extensions: ['.bat', '.cmd'],
    iconName: 'file-type-shell',
    group: 'enableLanguageIcons'
  },
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

  // Config Files
  {
    extensions: ['.env'],
    iconName: 'file-type-dotenv',
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
    pattern: '^\\.git(ignore|modules|attributes)?$',
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

      // Get icons: Python (VSCode), Markdown (JupyterLab native), Claude (VSCode), README (custom)
      const pythonIcon = createLabIcon('file-type-python');
      const claudeIcon = createLabIcon('file-type-claude');
      const markdownSvg = markdownIcon.svgstr;

      // Custom README icon (purple filled circle with bold lowercase i - transparent cutout)
      const readmeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
        <defs>
          <mask id="readme-mask">
            <circle cx="16" cy="16" r="12" fill="white"/>
            <text x="16" y="22" font-size="20" font-weight="900" text-anchor="middle" fill="black" stroke="black" stroke-width="0.7" font-family="'Courier New', Courier, monospace">i</text>
          </mask>
        </defs>
        <circle cx="16" cy="16" r="12" fill="#9826c8" mask="url(#readme-mask)"/>
      </svg>`;

      // Get SVG content
      const pythonSvg = pythonIcon.svgstr;
      const claudeSvg = claudeIcon.svgstr;

      // Create base64 encoded data URIs
      const pythonDataUri = `data:image/svg+xml;base64,${btoa(pythonSvg)}`;
      const markdownDataUri = `data:image/svg+xml;base64,${btoa(markdownSvg)}`;
      const claudeDataUri = `data:image/svg+xml;base64,${btoa(claudeSvg)}`;
      const readmeDataUri = `data:image/svg+xml;base64,${btoa(readmeSvg)}`;

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
          width: 18px;
          height: 18px;
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
          width: 18px;
          height: 18px;
          background-image: url('${markdownDataUri}');
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
        }

        /* Override CLAUDE.md file icon with VSCode Claude icon (purple tint) */
        .jp-DirListing-item[data-file-type="notebook"][data-claude-md] .jp-DirListing-itemIcon svg,
        .jp-DirListing-item[data-file-type="notebook"][data-claude-md] .jp-DirListing-itemIcon img {
          display: none !important;
        }
        .jp-DirListing-item[data-file-type="notebook"][data-claude-md] .jp-DirListing-itemIcon::before {
          content: '';
          display: inline-block;
          width: 18px;
          height: 18px;
          background-image: url('${claudeDataUri}');
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
          filter: hue-rotate(270deg) saturate(1.5) brightness(1.1);
        }

        /* Override README.md file icon with custom info icon */
        .jp-DirListing-item[data-file-type="notebook"][data-readme-md] .jp-DirListing-itemIcon svg,
        .jp-DirListing-item[data-file-type="notebook"][data-readme-md] .jp-DirListing-itemIcon img {
          display: none !important;
        }
        .jp-DirListing-item[data-file-type="notebook"][data-readme-md] .jp-DirListing-itemIcon::before {
          content: '';
          display: inline-block;
          width: 20px;
          height: 20px;
          background-image: url('${readmeDataUri}');
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
        }
      `;

      // Add CSS to make JavaScript icons less bright
      style.textContent += `
        /* Reduce brightness of JavaScript icons */
        .jp-DirListing-item[data-file-type*="js"] .jp-DirListing-itemIcon svg,
        .jp-DirListing-item[data-file-type="vscode-file-type-js-official"] .jp-DirListing-itemIcon svg {
          filter: brightness(0.85) saturate(0.85);
        }

        /* Color shell script icons - pale red for Linux shells (.sh, .bash, .zsh) with inverted colors */
        .jp-DirListing-item[data-shell-type="linux"] .jp-DirListing-itemIcon svg {
          filter: invert(1) hue-rotate(130deg) saturate(0.8) brightness(0.9);
        }

        /* Color shell script icons - pale blue for Windows shells (.bat, .cmd) */
        .jp-DirListing-item[data-shell-type="windows"] .jp-DirListing-itemIcon svg {
          filter: hue-rotate(180deg) saturate(0.6) brightness(1.2);
        }
      `;

      // Add a MutationObserver to mark special files in the file browser
      const markSpecialFiles = () => {
        // Mark Jupytext files (.py and .md notebooks) and CLAUDE.md
        const notebookItems = document.querySelectorAll(
          '.jp-DirListing-item[data-file-type="notebook"]'
        );
        notebookItems.forEach(item => {
          const nameSpan = item.querySelector(
            '.jp-DirListing-itemText'
          ) as HTMLElement;
          if (nameSpan && nameSpan.textContent) {
            const name = nameSpan.textContent.trim();
            if (name === 'CLAUDE.md') {
              item.setAttribute('data-claude-md', 'true');
            } else if (name === 'README.md') {
              item.setAttribute('data-readme-md', 'true');
            } else if (name.endsWith('.py')) {
              item.setAttribute('data-jupytext-py', 'true');
            } else if (name.endsWith('.md')) {
              item.setAttribute('data-jupytext-md', 'true');
            }
          }
        });

        // Mark shell script files for different coloring
        const shellItems = document.querySelectorAll(
          '.jp-DirListing-item[data-file-type="vscode-file-type-shell"]'
        );
        shellItems.forEach(item => {
          const nameSpan = item.querySelector(
            '.jp-DirListing-itemText'
          ) as HTMLElement;
          if (nameSpan && nameSpan.textContent) {
            const name = nameSpan.textContent.trim();
            if (name.endsWith('.sh') || name.endsWith('.bash') || name.endsWith('.zsh')) {
              item.setAttribute('data-shell-type', 'linux');
            } else if (name.endsWith('.bat') || name.endsWith('.cmd')) {
              item.setAttribute('data-shell-type', 'windows');
            }
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

        docRegistry.addFileType(fileTypeOptions);
      });

      // Register Makefile with custom icon (separate from main icon loop)
      const makefileSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <text x="12" y="18" font-size="20" font-weight="900" text-anchor="middle" fill="#d84a4a" font-family="Arial, sans-serif">M</text>
      </svg>`;

      const makefileIcon = new LabIcon({
        name: 'makefile-icon',
        svgstr: makefileSvg
      });

      docRegistry.addFileType({
        name: 'vscode-makefile',
        displayName: 'Makefile',
        mimeTypes: ['text/x-makefile'],
        extensions: ['.mk', '.mak', '.make'],
        pattern: '^(Makefile|makefile|GNUmakefile|makefile\\..*|Makefile\\..*)',
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
      console.log('[VSCode Icons] CLAUDE.md icon created:', !!claudeIcon);
      if (claudeIcon) {
        console.log('[VSCode Icons] CLAUDE.md icon svgstr length:', claudeIcon.svgstr?.length || 0);
        docRegistry.addFileType({
          name: 'vscode-claude-md',
          displayName: 'Claude Configuration',
          pattern: '^CLAUDE\\.md$',
          fileFormat: 'text',
          contentType: 'file',
          icon: claudeIcon
        });
        console.log('[VSCode Icons] CLAUDE.md file type registered with pattern: ^CLAUDE\\.md$');
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
      console.log('[VSCode Icons] README.md file type registered with pattern: ^README\\.md$');
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
