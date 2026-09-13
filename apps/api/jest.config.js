/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.test\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: './tsconfig.json' }] },
  collectCoverageFrom: ['**/*.ts', '!**/*.module.ts', '!**/main.ts'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    // rootDir is src, so packages/ is three levels up (was two — never
    // exercised while @ns/types was a type-only import; I18N-RUE T1 made it
    // a value import and the wrong path surfaced).
    '^@ns/types$': '<rootDir>/../../../packages/types/src/index.ts',
    '^@/(.*)$': '<rootDir>/$1',
  },
};
