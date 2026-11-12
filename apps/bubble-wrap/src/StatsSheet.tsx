import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic } from '@wildchild/kit';
import { C, F } from './theme';
import { bestDay, lastWeek, popsToday, type Stats } from './stats';

type Props = {
  visible: boolean;
  stats: Stats;
  onClose: () => void;
  onChange: (patch: Partial<Stats>) => void;
  onReset: () => void;
  reduce: boolean;
  removeAds: { show: boolean; owned: boolean; price: string | null; buy: () => void; restore: () => void };
};

function confirmReset(onReset: () => void) {
  const title = 'Reset all counts?';
  const body = "Today, all time, sheets and your best day go back to zero. This can't be undone.";
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${body}`)) onReset();
    return;
  }
  Alert.alert(title, body, [
    { text: 'Keep counts', style: 'cancel' },
    { text: 'Reset counts', style: 'destructive', onPress: onReset },
  ]);
}

export function StatsSheet({ visible, stats, onClose, onChange, onReset, reduce, removeAds }: Props) {
  const insets = useSafeAreaInsets();
  const week = lastWeek(stats);
  const max = Math.max(1, ...week.map((d) => d.value));
  const tiles = [
    { label: 'Today', value: popsToday(stats) },
    { label: 'All time', value: stats.total },
    { label: 'Sheets cleared', value: stats.sheets },
    { label: 'Best day', value: bestDay(stats) },
  ];
  const toggles: { key: 'muted' | 'haptics' | 'tilt'; label: string; hint?: string; on: boolean }[] = [
    { key: 'muted', label: 'Sound', on: !stats.muted },
    { key: 'haptics', label: 'Vibration', on: stats.haptics },
    { key: 'tilt', label: 'Tilt shine', hint: 'Bubbles catch the light as you tilt', on: stats.tilt },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close stats" />
      {visible && (
        <Animated.View
          entering={reduce ? undefined : SlideInDown.springify().damping(18).stiffness(160)}
          style={[styles.sheet, { paddingTop: 12 }]}
          accessibilityViewIsModal
        >
          <View style={styles.grabber} />
          <View style={styles.head}>
            <Text style={styles.title} accessibilityRole="header">
              Your pops
            </Text>
            <Pressable
              onPress={onClose}
              style={styles.close}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
            >
              <Text style={styles.closeX}>×</Text>
            </Pressable>
          </View>

          <ScrollView
            style={{ flexGrow: 0 }}
            contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 20 }]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.tiles}>
              {tiles.map((t) => (
                <View key={t.label} style={styles.tile} accessible accessibilityLabel={`${t.label}, ${t.value}`}>
                  <Text style={styles.tileLabel}>{t.label}</Text>
                  <Text style={styles.tileValue}>{t.value.toLocaleString()}</Text>
                </View>
              ))}
            </View>

            <View style={{ gap: 10 }}>
              <Text style={styles.tileLabel}>This week</Text>
              <View
                style={styles.chart}
                accessible
                accessibilityLabel={`Pops per day this week: ${week.map((d) => `${d.label} ${d.value}`).join(', ')}`}
              >
                {week.map((d, i) => (
                  <View key={i} style={styles.barCol}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: Math.max(4, Math.round((d.value / max) * 72)),
                          backgroundColor: d.isToday ? C.ground : C.barIdle,
                        },
                      ]}
                    />
                    <Text style={styles.barLabel}>{d.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.list}>
              {toggles.map((t, i) => (
                <View key={t.key} style={[styles.row, i < toggles.length - 1 && styles.rowLine]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>{t.label}</Text>
                    {t.hint && <Text style={styles.rowHint}>{t.hint}</Text>}
                  </View>
                  <Switch
                    value={t.on}
                    onValueChange={(v) => {
                      haptic.tap();
                      onChange({ [t.key]: t.key === 'muted' ? !v : v });
                    }}
                    trackColor={{ true: C.ground, false: '#D9D6EA' }}
                    thumbColor="#FFFFFF"
                    {...({ activeThumbColor: '#FFFFFF' } as object)}
                    accessibilityLabel={t.label}
                  />
                </View>
              ))}
            </View>

            {removeAds.show && (
              <View style={styles.list}>
                {removeAds.owned ? (
                  <View style={styles.row} accessible accessibilityLabel="Ads removed">
                    <Text style={[styles.rowLabel, { flex: 1 }]}>Ads removed</Text>
                    <Text style={styles.owned}>Thanks!</Text>
                  </View>
                ) : (
                  <>
                    <Pressable onPress={removeAds.buy} style={[styles.row, styles.rowLine]} accessibilityRole="button">
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowLabel}>Remove ads</Text>
                        <Text style={styles.rowHint}>One-time purchase. Pop without breaks.</Text>
                      </View>
                      <Text style={styles.priceTag}>{removeAds.price ?? 'Buy'}</Text>
                    </Pressable>
                    <Pressable onPress={removeAds.restore} style={styles.row} accessibilityRole="button">
                      <Text style={[styles.rowLabel, { flex: 1, color: C.ground }]}>Restore purchase</Text>
                    </Pressable>
                  </>
                )}
              </View>
            )}

            <Pressable
              onPress={() => confirmReset(onReset)}
              style={styles.reset}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={styles.resetText}>Reset counts</Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,8,50,0.55)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    maxHeight: '92%',
    gap: 16,
  },
  body: { gap: 20 },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: '#D9D6EA' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: F.black, fontSize: 26, color: C.ink, letterSpacing: -0.5 },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeX: { fontFamily: F.bold, fontSize: 28, lineHeight: 30, color: C.ink },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { flexBasis: '47%', flexGrow: 1, padding: 16, borderRadius: 20, backgroundColor: C.tint, gap: 2 },
  tileLabel: { fontFamily: F.xbold, fontSize: 13, color: C.inkSoft },
  tileValue: { fontFamily: F.black, fontSize: 32, color: C.ground },
  chart: { height: 96, flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  bar: { width: '100%', borderRadius: 8 },
  barLabel: { fontFamily: F.xbold, fontSize: 12, color: C.inkSoft },
  list: { borderTopWidth: 1, borderTopColor: C.line },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: 12 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: C.line },
  rowLabel: { fontFamily: F.xbold, fontSize: 16, color: C.ink },
  rowHint: { fontFamily: F.bold, fontSize: 13, color: C.inkSoft },
  reset: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  owned: { fontFamily: F.xbold, fontSize: 15, color: C.ground },
  priceTag: {
    fontFamily: F.black,
    fontSize: 15,
    color: '#FFFFFF',
    backgroundColor: C.ground,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  resetText: { fontFamily: F.xbold, fontSize: 15, color: C.danger },
});
