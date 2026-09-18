// Metro must resolve drizzle-kit's `.sql` migration files; babel-plugin-inline-import then inlines
// them as strings (DESIGN §4.6).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push('sql');

module.exports = config;
