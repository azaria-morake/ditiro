const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add 'cjs' to sourceExts for Firebase JS v10 compatibility in Metro
if (!config.resolver.sourceExts.includes('cjs')) {
  config.resolver.sourceExts.push('cjs');
}

// Disable unstable package exports so Metro picks react-native builds for Firebase
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
