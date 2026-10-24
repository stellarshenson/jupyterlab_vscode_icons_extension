/**
 * Settings schema defaults - ACC-CONFIG-5.
 *
 * The seven toggles gate which icon groups paint. Six default on; executable
 * icons default off per ACC-CONFIG-5.
 */

import schema from '../../schema/plugin.json';

const properties = (schema as any).properties as {
  [key: string]: { default: unknown };
};

describe('settings schema', () => {
  const onByDefault = [
    'enableLanguageIcons',
    'enableWebIcons',
    'enableDataIcons',
    'enableConfigIcons',
    'enableDocIcons',
    'enableImageIcons'
  ];

  it.each(onByDefault)('defaults %s to true', key => {
    expect(properties[key]).toBeDefined();
    expect(properties[key].default).toBe(true);
  });

  it('defaults enableExecutableIcons to false', () => {
    expect(properties.enableExecutableIcons).toBeDefined();
    expect(properties.enableExecutableIcons.default).toBe(false);
  });

  it('defaults collapseEmptyTabIcons to true', () => {
    expect(properties.collapseEmptyTabIcons).toBeDefined();
    expect(properties.collapseEmptyTabIcons.default).toBe(true);
  });

  it('declares exactly the seven documented toggles and the tab option', () => {
    expect(Object.keys(properties).sort()).toEqual(
      [...onByDefault, 'enableExecutableIcons', 'collapseEmptyTabIcons'].sort()
    );
  });
});
