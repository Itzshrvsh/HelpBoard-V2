import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
  onClick?: () => void;
}

export default function Card({ children, className, hover = true, glow = false, onClick }: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={hover ? { y: -2 } : {}}
      onClick={onClick}
      className={cn(
        'bg-surface-900/60 backdrop-blur-sm border border-surface-800/60 rounded-xl p-5',
        'transition-all duration-200',
        hover && 'hover:border-surface-700/60 hover:bg-surface-900/80',
        glow && 'shadow-lg shadow-primary-500/5',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </motion.div>
  );
}
