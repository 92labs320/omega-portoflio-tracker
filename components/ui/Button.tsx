import { TouchableOpacity, Text, ActivityIndicator, type TouchableOpacityProps } from 'react-native';
import { Colors } from '@/constants/Colors';

interface ButtonProps extends TouchableOpacityProps {
  label:    string;
  variant?: 'primary' | 'ghost';
  loading?: boolean;
}

export function Button({ label, variant = 'primary', loading = false, disabled, className = '', ...props }: ButtonProps) {
  const base     = 'rounded-xl py-4 items-center justify-center flex-row';
  const variants = {
    primary: 'bg-accent',
    ghost:   'border border-accent/40 bg-transparent',
  };
  const textColor = variant === 'primary' ? Colors.background : Colors.accent;

  return (
    <TouchableOpacity
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${disabled ? 'opacity-50' : ''} ${className}`}
      {...props}
    >
      {loading
        ? <ActivityIndicator color={textColor} />
        : <Text style={{ color: textColor }} className="font-bold text-base">{label}</Text>
      }
    </TouchableOpacity>
  );
}


