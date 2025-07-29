import path from 'path'

export default {
  preset: 'ts-jest',
  silent: false,

  // Automatically clear mock calls and instances between every test
  clearMocks: true,

  testPathIgnorePatterns: ['<rootDir>/node_modules/', '../../node_modules'],

  coveragePathIgnorePatterns: ['node_modules/'],
}
