// Metro infers this preset, but babel-jest needs it written down (DESIGN §9).
// inline-import turns drizzle-kit's `.sql` migration imports into strings at build time
// (DESIGN §4.6). Jest skips it and loads `.sql` through test/sqlTransform.js instead, so each file
// is cached on its own content rather than on the unchanged `migrations.js` that imports it.
module.exports = function (api) {
  const isTest = api.env('test');
  return {
    presets: ['babel-preset-expo'],
    plugins: isTest ? [] : [['inline-import', { extensions: ['.sql'] }]],
  };
};
