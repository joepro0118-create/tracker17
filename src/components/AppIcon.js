/**
 * AppIcon — thin wrapper around MaterialCommunityIcons.
 *
 * Usage:
 *   <AppIcon name="wallet-outline" size={22} color="#4FD1C5" />
 *
 * All icons default to 22px and the accent teal colour #4FD1C5.
 */
import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function AppIcon({ name, size = 22, color = '#4FD1C5', style }) {
  return <MaterialCommunityIcons name={name} size={size} color={color} style={style} />;
}
