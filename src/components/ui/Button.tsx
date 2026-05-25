import React from 'react';
import { HTMLMotionProps, motion } from 'framer-motion';
import { cn } from '../../lib/utils';

// interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
//   variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
//   size?: 'sm' | 'md' | 'lg';
//   loading?: boolean;
//   icon?: React.ReactNode;
// }

type ButtonProps = Omit<HTMLMotionProps<"button">, "onDrag" | "children"> & {
  children?: React.ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
};
    
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.01 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      className={cn(
        'relative inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:ring-offset-1 focus:ring-offset-surface-900',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        // Variants
        variant === 'primary' && 'bg-primary-600 hover:bg-primary-500 text-white shadow-lg shadow-primary-600/20',
        variant === 'secondary' && 'bg-surface-800 hover:bg-surface-700 text-surface-200 border border-surface-700',
        variant === 'ghost' && 'text-surface-300 hover:text-white hover:bg-surface-800',
        variant === 'danger' && 'bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30',
        // Sizes
        size === 'sm' && 'text-xs px-3 py-1.5 gap-1.5',
        size === 'md' && 'text-sm px-4 py-2 gap-2',
        size === 'lg' && 'text-base px-6 py-3 gap-2.5',
        loading && 'cursor-wait',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : icon ? (
        <span className="w-4 h-4">{icon}</span>
      ) : null}
      {children}
    </motion.button>
  );
}
