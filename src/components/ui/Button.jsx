import React from 'react'

const VARIANTS = {
  primary: 'bg-zinc-900 text-white hover:bg-zinc-700',
  outline: 'border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50',
  danger: 'border border-red-300 bg-white text-red-700 hover:bg-red-50',
  ghost: 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900',
}

const SIZES = {
  xs: 'px-2 py-1 text-[10px]',
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
  icon: 'p-1.5',
}

export function Button({ 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  children, 
  ...props 
}) {
  const baseClass = 'inline-flex items-center justify-center font-semibold rounded-full outline-none transition-colors disabled:opacity-50 disabled:pointer-events-none'
  const variantClass = VARIANTS[variant] || VARIANTS.primary
  const sizeClass = SIZES[size] || SIZES.md

  return (
    <button 
      className={`${baseClass} ${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
