import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores([
    '**/dist/**',
    '**/.next/**',
    '**/coverage/**',
    '**/node_modules/**',
    '**/next-env.d.ts',
  ]),
  {
    files: ['apps/api/**/*.ts', 'packages/**/*.ts'],
    extends: [tseslint.configs.recommended],
  },
  ...nextVitals.map((config) => ({
    ...config,
    files: ['apps/web/**/*.{js,cjs,mjs,jsx,ts,tsx}'],
  })),
);
