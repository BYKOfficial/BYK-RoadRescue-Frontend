// Style Dictionary config — source of truth is tokens.json.
// Run: npx style-dictionary build --config design-tokens/style-dictionary.config.js
// Outputs: src/lib/tokens/tokens.css (CSS custom properties, themed via [data-theme])
//          src/lib/tokens/tokens.ts  (typed TS token map for JS-side usage, e.g. charts/canvas)

const StyleDictionary = require('style-dictionary');

StyleDictionary.registerFormat({
  name: 'css/themed-variables',
  formatter: function ({ dictionary }) {
    const themes = ['dark', 'light', 'hc'];
    const selectorFor = (theme) =>
      theme === 'dark' ? ':root, [data-theme="dark"]'
      : theme === 'light' ? '[data-theme="light"]'
      : '[data-theme="hc"]';

    return themes
      .map((theme) => {
        const lines = dictionary.allTokens
          .filter((t) => !t.value?.[theme] === false || typeof t.original.value !== 'object')
          .map((t) => {
            const raw = t.original.value;
            const val = typeof raw === 'object' && raw[theme] ? t.value[theme] ?? t.value : t.value;
            return `  --${t.name}: ${val};`;
          });
        return `${selectorFor(theme)} {\n${lines.join('\n')}\n}`;
      })
      .join('\n\n');
  },
});

module.exports = {
  source: ['design-tokens/tokens.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      buildPath: 'src/lib/tokens/',
      files: [{ destination: 'tokens.css', format: 'css/themed-variables' }],
    },
    ts: {
      transformGroup: 'js',
      buildPath: 'src/lib/tokens/',
      files: [
        {
          destination: 'tokens.ts',
          format: 'javascript/es6',
        },
      ],
    },
  },
};
