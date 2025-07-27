const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Exclude test files from the bundle
config.resolver.blacklistRE = /(__tests__\/.*|.*\.test\.js|.*\.test\.ts|.*\.test\.tsx|.*\.spec\.js|.*\.spec\.ts|.*\.spec\.tsx)$/;

// Also exclude test files from platform extensions
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

module.exports = config;