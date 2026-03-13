import { useRef, useCallback } from 'react';

/**
 * Custom hook that speaks a label aloud after the user hovers
 * for a specified duration. Uses the Web Speech API.
 * Default delay: 2 seconds.
 */

// Pick a better voice — prefer a clear female English voice
function getPreferredVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  // Priority order of preferred voices
  const preferred = [
    'Google UK English Female',
    'Microsoft Zira',
    'Samantha',
    'Google US English',
    'Microsoft David',
  ];
  for (const name of preferred) {
    const found = voices.find(v => v.name.includes(name));
    if (found) return found;
  }
  // Fallback: any English voice
  return voices.find(v => v.lang.startsWith('en')) || null;
}

export function useVoiceFeedback(label: string, delayMs = 2000) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onMouseEnter = useCallback(() => {
    timerRef.current = setTimeout(() => {
      if ((window as any).isTourActive) return; // Suppress during tutorial
      if ((window as any).voiceFeedbackDisabled) return; // Suppress if user disabled voice
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(label);
        const voice = getPreferredVoice();
        if (voice) utterance.voice = voice;
        utterance.rate = 0.95;
        utterance.pitch = 1.1;
        utterance.volume = 1;
        utterance.lang = 'en-US';
        window.speechSynthesis.speak(utterance);
      }
    }, delayMs);
  }, [label, delayMs]);

  const onMouseLeave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return { onMouseEnter, onMouseLeave };
}

/**
 * Wrapper component for adding voice feedback to any element.
 * Usage: <VoiceHint label="Name"><TextField ... /></VoiceHint>
 */
import React from 'react';

export const VoiceHint: React.FC<{
  label: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ label, children, style }) => {
  const voice = useVoiceFeedback(label);
  return (
    <div
      onMouseEnter={voice.onMouseEnter}
      onMouseLeave={voice.onMouseLeave}
      style={style}
    >
      {children}
    </div>
  );
};
