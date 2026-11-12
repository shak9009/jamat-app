import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, PanResponder } from 'react-native';

/**
 * Reusable touch-and-drag slider with zero native dependencies.
 * Works seamlessly in React Native, Expo Go, Web, and EAS updates.
 */
export default function CustomSlider({
  value = 0,
  minimumValue = 0,
  maximumValue = 100,
  step = 0,
  onValueChange,
  onSlidingComplete,
  minimumTrackTintColor = '#1b6b3c',
  maximumTrackTintColor = '#e2e8f0',
  thumbTintColor = '#1b6b3c',
  thumbSize = 16,
  trackHeight = 4,
  disabled = false,
  style,
}) {
  const containerRef = useRef(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [internalValue, setInternalValue] = useState(value);

  const trackLeftRef = useRef(0);
  const trackWidthRef = useRef(0);
  const valueRef = useRef(value);

  trackWidthRef.current = trackWidth;
  valueRef.current = internalValue;

  useEffect(() => {
    if (!isDragging) {
      setInternalValue(value);
    }
  }, [value, isDragging]);

  const measureTrack = () => {
    if (containerRef.current && containerRef.current.measure) {
      containerRef.current.measure((fx, fy, width, height, px) => {
        if (typeof px === 'number') {
          trackLeftRef.current = px;
        }
        if (typeof width === 'number' && width > 0) {
          setTrackWidth(width);
        }
      });
    }
  };

  const calculateValueFromPageX = (pageX) => {
    const width = trackWidthRef.current;
    if (width <= 0) return minimumValue;
    const relX = pageX - trackLeftRef.current;
    const clampedX = Math.max(0, Math.min(relX, width));
    const ratio = clampedX / width;
    let computed = minimumValue + ratio * (maximumValue - minimumValue);
    if (step > 0) {
      computed = Math.round((computed - minimumValue) / step) * step + minimumValue;
    }
    return Math.max(minimumValue, Math.min(maximumValue, computed));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: (evt) => {
        setIsDragging(true);
        measureTrack();
        const newVal = calculateValueFromPageX(evt.nativeEvent.pageX);
        setInternalValue(newVal);
        if (onValueChange) onValueChange(newVal);
      },
      onPanResponderMove: (evt) => {
        const newVal = calculateValueFromPageX(evt.nativeEvent.pageX);
        setInternalValue(newVal);
        if (onValueChange) onValueChange(newVal);
      },
      onPanResponderRelease: (evt) => {
        setIsDragging(false);
        const finalVal = calculateValueFromPageX(evt.nativeEvent.pageX);
        setInternalValue(finalVal);
        if (onSlidingComplete) {
          onSlidingComplete(finalVal);
        }
      },
      onPanResponderTerminate: () => {
        setIsDragging(false);
      },
    })
  ).current;

  const range = maximumValue - minimumValue || 1;
  const currentVal = isDragging ? internalValue : value;
  const progressRatio = Math.max(0, Math.min(1, (currentVal - minimumValue) / range));

  return (
    <View
      ref={containerRef}
      style={[styles.container, style]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0) setTrackWidth(w);
        measureTrack();
      }}
      {...panResponder.panHandlers}
    >
      {/* Background Track */}
      <View style={[styles.track, { height: trackHeight, backgroundColor: maximumTrackTintColor }]}>
        {/* Filled Minimum Track */}
        <View
          style={[
            styles.filledTrack,
            {
              width: `${(progressRatio * 100).toFixed(2)}%`,
              height: trackHeight,
              backgroundColor: minimumTrackTintColor,
            },
          ]}
        />
      </View>

      {/* Draggable Thumb */}
      <View
        pointerEvents="none"
        style={[
          styles.thumb,
          {
            left: `${(progressRatio * 100).toFixed(2)}%`,
            width: thumbSize,
            height: thumbSize,
            borderRadius: thumbSize / 2,
            backgroundColor: thumbTintColor,
            marginLeft: -thumbSize / 2,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 30,
    justifyContent: 'center',
    width: '100%',
  },
  track: {
    borderRadius: 3,
    width: '100%',
    overflow: 'hidden',
  },
  filledTrack: {
    borderRadius: 3,
  },
  thumb: {
    position: 'absolute',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
});

