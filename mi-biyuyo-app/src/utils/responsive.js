// Base reference: iPhone 14 — 390×844
import { Dimensions } from "react-native";

const { width, height } = Dimensions.get("window");
const BASE_W = 390;
const BASE_H = 844;

const widthScale = width / BASE_W;
const heightScale = height / BASE_H;

const clamp = (v, min = 0.85, max = 1.6) => Math.min(Math.max(v, min), max);

export const s = (size) =>
  Math.round(size * clamp(Math.min(widthScale, heightScale)));
export const ms = (size, factor = 0.7) =>
  Math.round(size + (s(size) - size) * factor);
export const rf = (size, factor = 0.8) =>
  Math.round(size + (s(size) - size) * factor);
export const vs = (size) => Math.round(size * clamp(heightScale));
export const hs = (size) => Math.round(size * clamp(widthScale));

export const spacing = {
  xs: s(4),
  sm: s(8),
  md: s(12),
  lg: s(16),
  xl: s(24),
  xxl: s(36),
};

export const borderRadius = {
  sm: s(6),
  md: s(12),
  lg: s(18),
  xl: s(24),
};

export const iconSize = {
  sm: s(18),
  md: s(24),
  lg: s(32),
  xl: s(44),
  xxl: s(56),
};

export const isTablet = () => Math.min(width, height) >= 600;
export const isSmallDevice = () => Math.min(width, height) < 375;
export const isLargeDevice = () => Math.min(width, height) > 800;
