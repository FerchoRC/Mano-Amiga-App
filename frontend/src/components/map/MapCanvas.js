import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Svg, { Circle, G, Line, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { PanGestureHandler, PinchGestureHandler, State } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import floorPlan from '../../data/floor-p1.json';
import theme from '../../theme.js';

const POI_COLORS = {
  salida: '#1E9E5A',
  extintor: '#D93B3B',
  manguera: '#D93B3B',
  botiquin: '#1E9E5A',
  atencion: '#2F6FDB',
};

const statusColors = {
  optimo: '#1E9E5A',
  vencer: '#E9A31A',
  vencido: '#D93B3B',
};

function getPoiGlyph(type) {
  switch (type) {
    case 'salida':
      return 'M';
    case 'extintor':
      return 'E';
    case 'manguera':
      return 'H';
    case 'botiquin':
      return '+';
    case 'atencion':
      return 'A';
    default:
      return '•';
  }
}

export function MapCanvas() {
  const [selectedId, setSelectedId] = useState('EXT-P1-01');
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const offsetXValue = useSharedValue(0);
  const offsetYValue = useSharedValue(0);
  const scaleValue = useSharedValue(1);

  const mapScale = useMemo(() => Math.min(Math.max(zoom, 0.6), 4), [zoom]);

  const animatedStyles = useAnimatedStyle(() => ({
    transform: [
      { translateX: withSpring(offsetXValue.value) },
      { translateY: withSpring(offsetYValue.value) },
      { scale: withSpring(scaleValue.value) },
    ],
  }));

  const onPinch = (event) => {
    const nextScale = Math.min(Math.max(event.nativeEvent.scale * mapScale, 0.6), 4);
    setZoom(nextScale);
    scaleValue.value = nextScale;
  };

  const onPan = (event) => {
    if (event.nativeEvent.state === State.ACTIVE) {
      const nextX = Math.min(120, Math.max(-120, event.nativeEvent.translationX + offsetX));
      const nextY = Math.min(120, Math.max(-120, event.nativeEvent.translationY + offsetY));
      offsetXValue.value = nextX;
      offsetYValue.value = nextY;
      setOffsetX(nextX);
      setOffsetY(nextY);
    }
  };

  return (
    <View style={styles.mapShell}>
      <PanGestureHandler onActivated={onPan} onHandlerStateChange={onPan}>
        <Animated.View style={[styles.mapArea, animatedStyles]}>
          <PinchGestureHandler onGestureEvent={onPinch} onHandlerStateChange={onPinch}>
            <Animated.View style={styles.mapInner}>
              <Svg width="100%" height="100%" viewBox="0 0 1000 700" style={styles.svg}>
                <G>
                  <Rect x={0} y={0} width={1000} height={700} rx={16} fill="#EAF0F7" stroke="#D8E0EB" strokeWidth={2} />

                  {floorPlan.rooms.map((room) => (
                    <G key={room.id}>
                      <Rect x={room.points[0][0]} y={room.points[0][1]} width={room.points[2][0] - room.points[0][0]} height={room.points[2][1] - room.points[0][1]} fill="#F7FAFD" />
                      <SvgText x={room.points[0][0] + 20} y={room.points[0][1] + 28} fill="#5F6B7F" fontSize={11} fontWeight="600">{room.name}</SvgText>
                    </G>
                  ))}

                  {floorPlan.walls.map((wall, index) => (
                    <Path
                      key={`wall-${index}`}
                      d={wall.points.map((point, pointIndex) => `${pointIndex === 0 ? 'M' : 'L'} ${point[0]} ${point[1]}`).join(' ')}
                      fill="none"
                      stroke="#5B6B85"
                      strokeWidth={6}
                      strokeLinejoin="miter"
                      strokeLinecap="square"
                    />
                  ))}

                  {floorPlan.routes.map((route) => (
                    <G key={route.id}>
                      <Path
                        d={route.points.map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${point[0]} ${point[1]}`).join(' ')}
                        stroke="#1E9E5A"
                        strokeWidth={4}
                        strokeDasharray="10 8"
                        fill="none"
                        strokeLinecap="round"
                      />
                      {route.points.map((point, idx) => {
                        if (idx % 4 !== 0) return null;
                        const next = route.points[Math.min(idx + 1, route.points.length - 1)];
                        const angle = Math.atan2(next[1] - point[1], next[0] - point[0]);
                        const x2 = point[0] + Math.cos(angle) * 12;
                        const y2 = point[1] + Math.sin(angle) * 12;
                        return (
                          <Polygon
                            key={`${route.id}-arrow-${idx}`}
                            points={`${point[0]},${point[1]} ${x2 - 6},${y2 - 6} ${x2},${y2} ${x2 - 6},${y2 + 6}`}
                            fill="#1E9E5A"
                          />
                        );
                      })}
                    </G>
                  ))}

                  {floorPlan.pois.map((poi) => {
                    const isSelected = selectedId === poi.id;
                    const fill = POI_COLORS[poi.type] || '#2F6FDB';
                    const status = statusColors[poi.status] || '#1E9E5A';

                    return (
                      <G key={poi.id} onPress={() => setSelectedId(poi.id)}>
                        {isSelected ? <Circle cx={poi.x} cy={poi.y} r={28} fill="rgba(27,47,82,0.08)" stroke="#1B2F52" strokeWidth={2} /> : null}
                        <Rect x={poi.x - 16} y={poi.y - 16} width={32} height={32} rx={8} fill={fill} stroke="#FFFFFF" strokeWidth={2} />
                        <SvgText x={poi.x} y={poi.y + 5} fill="#FFFFFF" fontSize={15} fontWeight="700" textAnchor="middle">{getPoiGlyph(poi.type)}</SvgText>
                        <Circle cx={poi.x + 11} cy={poi.y - 11} r={5} fill={status} stroke="#FFFFFF" strokeWidth={2} />
                      </G>
                    );
                  })}
                </G>
              </Svg>
            </Animated.View>
          </PinchGestureHandler>
        </Animated.View>
      </PanGestureHandler>

      <View style={styles.bottomSheet}>
        <Text style={styles.sheetTitle}>{selectedId}</Text>
        <Text style={styles.sheetMeta}>Estado: óptimo · Próxima revisión: 2026-12-07</Text>
        <Text style={styles.sheetMeta}>Ubicación: Planta 1</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapShell: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#EAF0F7',
  },
  mapArea: {
    width: '100%',
    height: 420,
    backgroundColor: '#EAF0F7',
  },
  mapInner: {
    flex: 1,
  },
  svg: {
    width: '100%',
    height: '100%',
  },
  bottomSheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#14213D',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  sheetMeta: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
});
