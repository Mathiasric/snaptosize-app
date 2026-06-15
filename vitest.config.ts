import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['app/crop-preview/lib/__tests__/**/*.test.ts'],
    environment: 'node',
  },
})
