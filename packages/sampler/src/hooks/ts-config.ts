export const tsConfig = {
  compilerOptions: {
    baseUrl: '.',
    paths: {
      '@thymian/hooks': ['./types.d.ts'],
    },
  },
  include: ['./**/*.ts'],
};
