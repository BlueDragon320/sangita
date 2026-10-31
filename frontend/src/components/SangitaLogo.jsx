import React from 'react'
import logoImg from '../assets/logo.png'

export default function SangitaLogo({
  size = 24,
  width,
  height,
  color,
  className = '',
  style = {},
  alt = 'Sangita',
  'data-testid': dataTestId = 'sangita-logo',
  ...props
}) {
  const w = width || size
  const h = height || size

  return (
    <img
      src={logoImg || '/logo.png'}
      alt={alt}
      width={w}
      height={h}
      data-testid={dataTestId}
      className={`sangita-logo sangita-logo-svg ${className}`.trim()}
      style={{
        display: 'block',
        objectFit: 'contain',
        width: typeof w === 'number' ? `${w}px` : w,
        height: typeof h === 'number' ? `${h}px` : h,
        flexShrink: 0,
        ...style
      }}
      {...props}
    />
  )
}
