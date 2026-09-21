// Flattens a rendered element's style prop so component tests can assert on single values.
import { StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

export type AnyStyle = ViewStyle & TextStyle;

export const flat = (style: unknown): AnyStyle =>
  StyleSheet.flatten(style as StyleProp<AnyStyle>) ?? {};
