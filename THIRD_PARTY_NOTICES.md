# Third-party notices

This app bundles the following open-source software (SRS §1.3, NFR-13). Update this file whenever a
runtime dependency or font is added, and keep it in step with `npm run check:licences`.

## Runtime dependencies

| Package / font | Licence | Source |
|---|---|---|
| `@expo-google-fonts/barlow` | MIT AND OFL-1.1 | https://github.com/expo/google-fonts |
| `@expo-google-fonts/barlow-semi-condensed` | MIT AND OFL-1.1 | https://github.com/expo/google-fonts |
| `@gorhom/bottom-sheet` | MIT | https://github.com/gorhom/react-native-bottom-sheet |
| `drizzle-orm` | Apache-2.0 | https://github.com/drizzle-team/drizzle-orm |
| `expo` | MIT | https://github.com/expo/expo |
| `expo-constants` | MIT | https://github.com/expo/expo |
| `expo-crypto` | MIT | https://github.com/expo/expo |
| `expo-document-picker` | MIT | https://github.com/expo/expo |
| `expo-file-system` | MIT | https://github.com/expo/expo |
| `expo-font` | MIT | https://github.com/expo/expo |
| `expo-haptics` | MIT | https://github.com/expo/expo |
| `expo-keep-awake` | MIT | https://github.com/expo/expo |
| `expo-linking` | MIT | https://github.com/expo/expo |
| `expo-notifications` | MIT | https://github.com/expo/expo |
| `expo-router` | MIT | https://github.com/expo/expo |
| `expo-sharing` | MIT | https://github.com/expo/expo |
| `expo-splash-screen` | MIT | https://github.com/expo/expo |
| `expo-sqlite` | MIT | https://github.com/expo/expo |
| `expo-status-bar` | MIT | https://github.com/expo/expo |
| `expo-system-ui` | MIT | https://github.com/expo/expo |
| `lucide-react-native` | ISC | https://github.com/lucide-icons/lucide |
| `react` | MIT | https://github.com/facebook/react |
| `react-dom` | MIT | https://github.com/facebook/react |
| `react-native` | MIT | https://github.com/react/react-native |
| `react-native-gesture-handler` | MIT | https://github.com/software-mansion/react-native-gesture-handler |
| `react-native-reanimated` | MIT | https://github.com/software-mansion/react-native-reanimated |
| `react-native-safe-area-context` | MIT | https://github.com/AppAndFlow/react-native-safe-area-context |
| `react-native-screens` | MIT | https://github.com/software-mansion/react-native-screens |
| `react-native-svg` | MIT | https://github.com/react-native-community/react-native-svg |
| `react-native-web` | MIT | https://github.com/necolas/react-native-web |
| `react-native-worklets` | MIT | https://github.com/software-mansion/react-native-reanimated |
| `zod` | MIT | https://github.com/colinhacks/zod |
| `zustand` | MIT | https://github.com/pmndrs/zustand |

The Barlow and Barlow Semi Condensed fonts are used under the SIL Open Font License 1.1 (D-18),
which permits bundling them in a free app.

## About the licence allow-list

`npm run check:licences` runs over the whole production dependency tree, which includes the Expo
build toolchain as well as the code that ships in the app binary. Two entries in its allow-list are
worth explaining:

- **`MPL-2.0`** — `lightningcss`, a CSS transformer inside `@expo/metro-config`. MPL-2.0 is
  file-level ("weak") copyleft: the obligation covers the MPL files themselves, not the app that
  uses them. It runs at build time only and no MPL code ships in the `.ipa` or `.aab`.
- **`(BSD-3-Clause OR GPL-2.0)`** — `node-forge`, which is dual-licensed. The project takes it under
  BSD-3-Clause.

GPL and AGPL remain hard failures, per SRS §1.3.
