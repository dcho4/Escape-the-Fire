module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // No Reanimated usage in app code; omitting the plugin avoids Expo Go iOS
    // "runtime not ready / NativeWorklets" class failures. Re-add if you use Reanimated:
    // plugins: ["react-native-reanimated/plugin"],
  };
};
