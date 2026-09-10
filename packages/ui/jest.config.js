/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts', 'tsx'],
  rootDir: 'src',
  testRegex: '.*\\.test\\.ts$',
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: './tsconfig.json' }] },
  testEnvironment: 'node',
};
