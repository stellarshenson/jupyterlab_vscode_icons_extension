/**
 * The extension builds for the browser, so tsconfig carries no Node types.
 * Two specs read src/index.ts off disk to assert against the artwork that
 * ships rather than a re-typed copy. These declarations keep that read local
 * to the test tree instead of adding Node globals to the whole compilation.
 */
declare const require: (id: string) => any;
declare const __dirname: string;
