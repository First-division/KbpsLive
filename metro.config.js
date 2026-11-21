const path = require('path');

const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);


config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  'expo-asset': path.resolve(projectRoot, 'node_modules/expo-asset'),
};


module.exports = config;