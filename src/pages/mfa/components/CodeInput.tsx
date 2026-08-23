import { useRef } from 'react';

interface CodeInputProps {
  code: string[];
  onChange: (code: string[]) => void;
  disabled?: boolean;
}

export default function CodeInput({ code, onChange, disabled }: CodeInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...code];
    next[index] = digit;
    onChange(next);
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!digits) return;
    const next = ['', '', '', '', '', ''];
    digits.split('').forEach((ch, i) => { next[i] = ch; });
    onChange(next);
    inputRefs.current[Math.min(digits.length, 5)]?.focus();
  };

  return (
    <div className="flex justify-between gap-2" onPaste={handlePaste}>
      {code.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="w-12 h-14 text-center bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg text-lg font-semibold text-foreground-100 outline-none transition-colors duration-200 disabled:opacity-50"
        />
      ))}
    </div>
  );
}