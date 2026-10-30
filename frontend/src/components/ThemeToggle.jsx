import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({
  id = 'theme-toggle',
  showLabel = true,
  labelPosition = 'left',
  size = 'md', // 'sm' | 'md'
  className = '',
  style = {}
}) {
  const { theme, toggleTheme, isDark } = useTheme();

  const isSmall = size === 'sm';
  const trackWidth = isSmall ? 48 : 58;
  const trackHeight = isSmall ? 26 : 30;
  const knobSize = isSmall ? 20 : 24;
  const offset = 3;
  const travelDistance = trackWidth - knobSize - offset * 2;

  const handleKeyDown = (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      toggleTheme();
    }
  };

  return (
    <div
      className={`theme-toggle-wrapper ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '9px',
        userSelect: 'none',
        ...style
      }}
    >
      {showLabel && labelPosition === 'left' && (
        <span
          onClick={toggleTheme}
          style={{
            fontSize: isSmall ? '0.75rem' : '0.8125rem',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'color 0.2s ease',
            letterSpacing: '-0.01em',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px'
          }}
          title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
        >
          {isDark ? (
            <>
              <Moon size={14} style={{ color: '#f85d3f' }} />
              <span>Dark</span>
            </>
          ) : (
            <>
              <Sun size={14} style={{ color: '#F54927' }} />
              <span>Light</span>
            </>
          )}
        </span>
      )}

      {/* Switch Track */}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={`Toggle theme (currently ${theme} mode)`}
        title={`Click to switch to ${isDark ? 'Light' : 'Dark'} mode`}
        onClick={toggleTheme}
        onKeyDown={handleKeyDown}
        style={{
          position: 'relative',
          width: `${trackWidth}px`,
          height: `${trackHeight}px`,
          borderRadius: '9999px',
          background: isDark
            ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
            : 'linear-gradient(135deg, #fff0ec 0%, #fed7cc 100%)',
          border: isDark ? '1px solid #334155' : '1px solid #fca58f',
          boxShadow: isDark
            ? 'inset 0 2px 4px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(255, 255, 255, 0.05)'
            : 'inset 0 2px 4px rgba(245, 73, 39, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)',
          cursor: 'pointer',
          padding: 0,
          outline: 'none',
          display: 'flex',
          alignItems: 'center',
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          flexShrink: 0
        }}
      >
        {/* Background icon indicator (Sun on left) */}
        <span
          style={{
            position: 'absolute',
            left: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#F54927',
            opacity: isDark ? 0.35 : 0.9,
            transition: 'opacity 0.25s ease, transform 0.25s ease',
            transform: isDark ? 'scale(0.85)' : 'scale(1)',
            pointerEvents: 'none'
          }}
        >
          <Sun size={isSmall ? 12 : 14} />
        </span>

        {/* Background icon indicator (Moon on right) */}
        <span
          style={{
            position: 'absolute',
            right: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f85d3f',
            opacity: isDark ? 0.9 : 0.3,
            transition: 'opacity 0.25s ease, transform 0.25s ease',
            transform: isDark ? 'scale(1)' : 'scale(0.85)',
            pointerEvents: 'none'
          }}
        >
          <Moon size={isSmall ? 11 : 13} />
        </span>

        {/* Sliding thumb knob */}
        <span
          style={{
            position: 'absolute',
            left: `${offset}px`,
            width: `${knobSize}px`,
            height: `${knobSize}px`,
            borderRadius: '50%',
            background: isDark
              ? 'linear-gradient(135deg, #f85d3f 0%, #dc3b19 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #fff2ee 100%)',
            boxShadow: isDark
              ? '0 2px 8px rgba(245, 73, 39, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1)'
              : '0 2px 8px rgba(245, 73, 39, 0.35), 0 0 0 1px rgba(245, 73, 39, 0.2)',
            transform: isDark ? `translateX(${travelDistance}px)` : 'translateX(0px)',
            transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.3s ease, box-shadow 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isDark ? '#ffffff' : '#F54927'
          }}
        >
          {isDark ? (
            <Moon size={isSmall ? 12 : 13} style={{ transform: 'rotate(-10deg)', transition: 'transform 0.3s ease' }} />
          ) : (
            <Sun size={isSmall ? 12 : 14} style={{ transform: 'rotate(0deg)', transition: 'transform 0.3s ease' }} />
          )}
        </span>
      </button>

      {showLabel && labelPosition === 'right' && (
        <span
          onClick={toggleTheme}
          style={{
            fontSize: isSmall ? '0.75rem' : '0.8125rem',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'color 0.2s ease',
            letterSpacing: '-0.01em',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px'
          }}
          title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
        >
          {isDark ? 'Dark Mode' : 'Light Mode'}
        </span>
      )}
    </div>
  );
}
