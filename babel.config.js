// Metro infers this preset, but babel-jest needs it written down (DESIGN §9).
module.exports = function (api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
