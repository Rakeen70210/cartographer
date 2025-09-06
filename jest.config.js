module.exports = {
  preset: 'react-native',
  testEnvironment: 'node',
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(expo|@expo|react-native|@react-native|@rnmapbox|@turf|react-native-reanimated|react-native-gesture-handler|@react-navigation|expo-symbols|expo-blur|expo-router|expo-sqlite|expo-asset|expo-constants|expo-file-system|expo-font|expo-haptics|expo-location|expo-task-manager|react-native-safe-area-context|@react-native-community)/)',
  ],
  testMatch: [
    '**/__tests__/**/*.(test|spec).(js|jsx|ts|tsx)',
    '**/?(*.)(test|spec).(js|jsx|ts|tsx)',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/android/',
    '/ios/',
    '/.expo/',
    '/app/',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'utils/**/*.{js,jsx,ts,tsx}',
    'hooks/**/*.{js,jsx,ts,tsx}',
    'app/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/__tests__/setup/**',
    '!**/__tests__/mocks/**',
    '!**/__tests__/config/**',
  ],
  // Increase timeout for all tests to account for system variability
  testTimeout: 30000,
  // Timeout configuration for different test types
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js',
  ],
  // Clear mocks between tests
  clearMocks: true,
  // Reset mocks between tests
  resetMocks: true,
  // Restore mocks after each test
  restoreMocks: true,
  // Fix for React 18 act() warnings
  globals: {
    'process.env.NODE_ENV': 'test',
  },
};