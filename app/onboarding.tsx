import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Unit } from '@/core';
import { useOnboarding } from '@/features/onboarding';
import { BottomBar } from '@/ui/components/BottomBar';
import { Button } from '@/ui/components/Button';
import { useColors } from '@/ui/theme';
import { radius, spacing, touch } from '@/ui/tokens';
import { useTypography } from '@/ui/typography';

const UNITS: { value: Unit; label: string; hint: string }[] = [
  { value: 'kg', label: 'Kilograms', hint: 'kg' },
  { value: 'lb', label: 'Pounds', hint: 'lb' },
];

// Onboarding (DESIGN §7.15 steps 3–5, FR-12.1, FR-7.8): units, then where the data lives, then
// what to do first. The disclaimer (step 1) is its own screen; the restore offer is v1.1.
export default function OnboardingScreen() {
  const c = useColors();
  const type = useTypography();
  const { complete, saving } = useOnboarding();

  const [step, setStep] = useState(0);
  const [unit, setUnit] = useState<Unit>('kg');
  const [failed, setFailed] = useState(false);

  // Onboarding closes before navigating, so the stack can't land back here (§7.1 rule 3).
  const finish = async (go: '/plans' | '/') => {
    setFailed(false);
    if (await complete(unit)) router.replace(go);
    else setFailed(true);
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        {step === 0 && (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={[type.display, { color: c.ink }]}>
              Which weights do you use?
            </Text>
            <Text style={[type.body, { color: c.inkMuted }]}>
              You can change this later in Settings.
            </Text>
            {UNITS.map((option) => (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{
                  selected: unit === option.value,
                  checked: unit === option.value,
                }}
                accessibilityLabel={option.label}
                onPress={() => setUnit(option.value)}
                style={[
                  styles.choice,
                  {
                    backgroundColor: unit === option.value ? c.plateBlue : c.surface,
                    borderColor: unit === option.value ? c.plateBlue : c.line,
                  },
                ]}
              >
                <Text style={[type.title, { color: unit === option.value ? c.onPlate : c.ink }]}>
                  {option.label}
                </Text>
                <Text
                  style={[type.label, { color: unit === option.value ? c.onPlate : c.inkMuted }]}
                >
                  {option.hint}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {step === 1 && (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={[type.display, { color: c.ink }]}>
              Your data stays on this phone
            </Text>
            <Text style={[type.body, { color: c.ink }]}>
              There&apos;s no account and no server. Nothing you log leaves your device.
            </Text>
            <Text style={[type.body, { color: c.ink }]}>
              That also means it&apos;s yours to keep safe: leave your phone&apos;s backups on, or
              export your data from Settings now and then.
            </Text>
          </View>
        )}

        {step === 2 && (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={[type.display, { color: c.ink }]}>
              Get started
            </Text>
            <Text style={[type.body, { color: c.inkMuted }]}>
              Start from a ready-made plan, or come back to it later.
            </Text>
            {failed && (
              <Text accessibilityRole="alert" style={[type.body, { color: c.plateRedText }]}>
                That didn&apos;t save. Try again.
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      <BottomBar>
        {step < 2 ? (
          <Button label="Next" onPress={() => setStep(step + 1)} />
        ) : (
          <>
            <Button label="Pick a plan" disabled={saving} onPress={() => void finish('/plans')} />
            {/* The builder is Slice 12; until then a plan starts from a template. */}
            <Button label="Build a plan" variant="secondary" disabled onPress={() => {}} />
            <Button
              label="Skip for now"
              variant="ghost"
              disabled={saving}
              onPress={() => void finish('/')}
            />
          </>
        )}
        {step > 0 && step < 2 && (
          <Button label="Back" variant="ghost" onPress={() => setStep(step - 1)} />
        )}
      </BottomBar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.cardGap },
  section: { gap: spacing.cardGap },
  choice: {
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.card,
    minHeight: touch.min,
    gap: spacing.xs,
  },
});
