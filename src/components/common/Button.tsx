import { memo } from 'react';
import type { LucideIcon } from 'lucide-react';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export const Button = memo(function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  children,
  onClick,
  disabled = false,
  className = '',
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantStyles = {
    primary: 'bg-accent-blue hover:bg-blue-600 text-white',
    secondary: 'bg-bg-card hover:bg-bg-card-hover text-text-primary border border-zinc-800',
    ghost: 'hover:bg-bg-card-hover text-text-secondary hover:text-text-primary',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  };

  const iconSize = {
    sm: 14,
    md: 16,
    lg: 18,
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {Icon && iconPosition === 'left' && <Icon size={iconSize[size]} />}
      {children}
      {Icon && iconPosition === 'right' && <Icon size={iconSize[size]} />}
    </button>
  );
});
