import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { colors, radius, type } from '../theme';
import { haptic } from '../haptics';

type Props = {
  label: string;
  onPress: () => void;
  color?: string;
  textColor?: string;
  style?: ViewStyle;
};

/** The one button every app shares: squishes on press, taps the haptic engine. */
export function PillButton({ label, onPress, color = colors.paper, textColor = colors.ink, style }: Props) {
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      onPressIn={() => {
        s.value = withSpring(0.94, { damping: 15, stiffness: 400 });
        haptic.light();
      }}
      onPressOut={() => (s.value = withSpring(1, { damping: 10, stiffness: 300 }))}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Animated.View style={[styles.btn, { backgroundColor: color }, anim, style]}>
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  label: { ...type.title, fontSize: 18 },
});
