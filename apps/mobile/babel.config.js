module.exports = function (api) {
  api.cache(true);
  // babel-preset-expo aktiverar Reanimated/Worklets-transformen automatiskt när
  // paketen finns installerade – lägg inte till plugins manuellt ovanpå det.
  return { presets: ['babel-preset-expo'] };
};
