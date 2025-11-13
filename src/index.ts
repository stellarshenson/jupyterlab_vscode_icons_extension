import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { LabIcon } from '@jupyterlab/ui-components';
import { getIconSVG } from './icons';

const PLUGIN_ID = 'jupyterlab_vscode_icons_extension:plugin';

// Icon groups for settings
interface IconSettings {
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
interface FileTypeConfig {
  extensions: string[];
  pattern?: string;
  iconName: string;
  group: keyof IconSettings;
}

// Comprehensive file type configurations grouped by category
const fileTypeConfigs: FileTypeConfig[] = [
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
    extensions: ['.sh', '.bash', '.zsh', '.bat', '.cmd', '.ps1'],
    iconName: 'file-type-shell',
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
    extensions: ['.yaml', '.yml'],
    iconName: 'file-type-yaml',
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
    iconName: 'file-type-python',
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
    pattern: '^(Makefile|makefile|GNUmakefile|makefile\\..*|Makefile\\..*)$',
    extensions: ['.mk', '.mak', '.make'],
    iconName: 'file-type-makefile',
    group: 'enableConfigIcons'
  },
  {
    pattern: '^(LICENSE|LICENCE|LICENSE\\..*|LICENCE\\..*)$',
    extensions: [],
    iconName: 'file-type-license',
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
    console.log(
      'JupyterLab VSCode Icons Extension activated - shameless ripoff mode engaged!'
    );

    const { docRegistry } = app;

    // Default settings
    let settings: IconSettings = {
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

        // Register file type
        const fileTypeOptions: any = {
          name: `vscode-${config.iconName}`,
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
    };

    // Load settings
    if (settingRegistry) {
      settingRegistry
        .load(PLUGIN_ID)
        .then(loadedSettings => {
          // Update settings from registry
          Object.keys(settings).forEach(key => {
            const value = loadedSettings.get(key).composite;
            if (typeof value === 'boolean') {
              settings[key as keyof IconSettings] = value;
            }
          });

          console.log('VSCode Icons settings loaded:', settings);
          registerFileTypes();

          // Listen for settings changes
          loadedSettings.changed.connect(() => {
            Object.keys(settings).forEach(key => {
              const value = loadedSettings.get(key).composite;
              if (typeof value === 'boolean') {
                settings[key as keyof IconSettings] = value;
              }
            });

            console.log('VSCode Icons settings changed:', settings);
            // Note: Changing icons requires a JupyterLab refresh
            alert(
              'VSCode Icons settings changed. Please refresh the page to apply changes.'
            );
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
