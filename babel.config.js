/**
 * تحويل مسارات `@/` — لا تُحلّ من `tsconfig` وحده في React Native.
 *
 * Metro يقرأ هذا لا `tsconfig`، فبلا الإضافة يفشل كل استيراد بـ`@/`.
 */
module.exports = function (api) {
  api.cache(true)

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            '@': './src',
            '@shared': './shared',
          },
        },
      ],
    ],
  }
}
