import React from 'react';
import logoSvg from '../assets/logo.svg?raw';
import wordmarkSvg from '../assets/wordmark.svg?raw';

export function Logo({ size = 22, style }) {
  return (
    <span
      className="brand-svg"
      style={{ width: size, height: size, ...style }}
      dangerouslySetInnerHTML={{ __html: logoSvg }}
    />
  );
}

export function Wordmark({ width = 186, style }) {
  // viewBox aspect ratio is ~17.7:1
  return (
    <span
      className="brand-svg"
      style={{ width, height: Math.round(width / 17.7), ...style }}
      dangerouslySetInnerHTML={{ __html: wordmarkSvg }}
    />
  );
}
