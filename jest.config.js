/**
 * الاختبارات حرّاس معمارية لا اختبارات واجهة.
 *
 * تفحص الشيفرة نصًّا: لا Hex، ولا `parseFloat` على مبلغ، ولا حزمة مراقبة،
 * ونصوص الموافقة مطابقة للخلفية. هذي أخطاء تتسلل صامتة ولا يمسكها اختبار
 * تفاعلي، والعكس ليس صحيحًا.
 */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/src/__tests__/**/*.test.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
}
