/**
 * Settings schema defaults - ACC-CONFIG-5.
 *
 * The seven toggles gate which icon groups paint. Six default on; executable
 * icons default off because detecting them costs a server round trip per
 * directory.
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

  it('declares exactly the seven documented toggles', () => {
    expect(Object.keys(properties).sort()).toEqual(
      [...onByDefault, 'enableExecutableIcons'].sort()
    );
  });
});
