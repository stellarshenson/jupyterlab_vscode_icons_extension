const iconsData = require('./node_modules/@iconify-json/vscode-icons/icons.json');

function getIconSVG(iconName) {
  const icons = iconsData.icons;
  let icon = icons[iconName];
  if (!icon) {
    console.log('Icon not found:', iconName);
    icon = icons['default-file'];
  }

  console.log('Icon structure:', JSON.stringify(icon, null, 2));

  if (icon && icon.parent) {
    console.log('Has parent:', icon.parent);
    const parentIcon = icons[icon.parent];
    console.log(
      'Parent body length:',
      parentIcon && parentIcon.body ? parentIcon.body.length : 'no body'
    );
    return (
      (parentIcon && parentIcon.body) ||
      (icons['default-file'] && icons['default-file'].body) ||
      ''
    );
  }

  return (
    (icon && icon.body) ||
    (icons['default-file'] && icons['default-file'].body) ||
    ''
  );
}

const result = getIconSVG('file-type-makefile');
console.log('Result length:', result.length);
console.log('Result preview:', result.substring(0, 100));
console.log('\nTesting with icon that has body directly:');
const jsResult = getIconSVG('file-type-js-official');
console.log('JS icon length:', jsResult.length);
