// Scaffold check (DESIGN §11, step 1): proves the `app` Jest project renders React Native
// components and can assert on accessibility labels, as §7.17 requires.
// Replace with real AC-named component tests as the design system lands.
import { render, screen } from '@testing-library/react-native';
import { Text, View } from 'react-native';

function Probe() {
  return (
    <View accessibilityLabel="probe">
      <Text>ready</Text>
    </View>
  );
}

describe('scaffold: app test project', () => {
  it('renders a component and finds it by accessibility label', async () => {
    await render(<Probe />);
    expect(screen.getByLabelText('probe')).toBeTruthy();
    expect(screen.getByText('ready')).toBeTruthy();
  });
});
