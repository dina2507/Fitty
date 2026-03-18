import React from 'react'

export function Card({ className = '', children, ...props }) {
  return (
    <div 
      className={`rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
