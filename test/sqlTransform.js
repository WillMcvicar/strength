// Jest transform for drizzle-kit's `.sql` migrations: exports the file's text, as
// babel-plugin-inline-import does for the app bundle (babel.config.js).
module.exports = {
  process(source) {
    return { code: `module.exports = ${JSON.stringify(source)};` };
  },
};
