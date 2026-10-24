import React from 'react'

export default function SangitaLogo({
  size = 24,
  width,
  height,
  color = 'currentColor',
  className = '',
  style = {},
  ...props
}) {
  const w = width || size
  const h = height || size

  return (
    <svg
      viewBox="20 -25 440 440"
      width={w}
      height={h}
      fill={color}
      className={`sangita-logo-svg ${className}`}
      style={{
        display: 'block',
        background: 'transparent',
        flexShrink: 0,
        ...style
      }}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <g id="markGroup" transform="translate(2.5, 0)">
        {/* Rounded-Corner Play Button Outline */}
        <path
          d="M 62,102 C 62,78 82,68 102,80 L 185,165 C 201,176 201,194 185,205 L 102,290 C 82,302 62,292 62,268 Z"
          fill="none"
          stroke={color}
          strokeWidth="16"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* 12-Column Morse Code Soundwave */}
        <g id="morseWaveGroup" transform="translate(22, 0)">
          {/* Col 1 */}
          <rect x="213" y="170" width="10" height="30" rx="5" />

          {/* Col 2 */}
          <circle cx="234" cy="152" r="5" />
          <rect x="229" y="168" width="10" height="34" rx="5" />
          <circle cx="234" cy="218" r="5" />

          {/* Col 3 */}
          <circle cx="250" cy="130" r="5" />
          <circle cx="250" cy="146" r="5" />
          <rect x="245" y="160" width="10" height="70" rx="5" />
          <circle cx="250" cy="244" r="5" />

          {/* Col 4 - Main Peak */}
          <circle cx="266" cy="72" r="5" />
          <rect x="261" y="90" width="10" height="42" rx="5" />
          <circle cx="266" cy="146" r="5" />
          <circle cx="266" cy="162" r="5" />
          <rect x="261" y="176" width="10" height="44" rx="5" />
          <circle cx="266" cy="234" r="5" />
          <rect x="261" y="248" width="10" height="36" rx="5" />
          <circle cx="266" cy="298" r="5" />

          {/* Col 5 */}
          <rect x="277" y="118" width="10" height="48" rx="5" />
          <circle cx="282" cy="180" r="5" />
          <rect x="277" y="194" width="10" height="54" rx="5" />

          {/* Col 6 */}
          <circle cx="298" cy="152" r="5" />
          <rect x="293" y="168" width="10" height="36" rx="5" />
          <circle cx="298" cy="218" r="5" />
          <circle cx="298" cy="234" r="5" />

          {/* Col 7 - Center Valley */}
          <rect x="309" y="168" width="10" height="34" rx="5" />

          {/* Col 8 */}
          <rect x="325" y="160" width="10" height="42" rx="5" />
          <circle cx="330" cy="216" r="5" />

          {/* Col 9 - Second Peak */}
          <circle cx="346" cy="98" r="5" />
          <circle cx="346" cy="114" r="5" />
          <rect x="341" y="130" width="10" height="86" rx="5" />
          <circle cx="346" cy="230" r="5" />
          <rect x="341" y="244" width="10" height="24" rx="5" />
          <circle cx="346" cy="282" r="5" />
          <circle cx="346" cy="296" r="5" />

          {/* Col 10 */}
          <rect x="357" y="142" width="10" height="52" rx="5" />
          <rect x="357" y="204" width="10" height="40" rx="5" />

          {/* Col 11 */}
          <circle cx="378" cy="168" r="5" />
          <rect x="373" y="182" width="10" height="32" rx="5" />
          <circle cx="378" cy="228" r="5" />

          {/* Col 12 */}
          <rect x="389" y="174" width="10" height="22" rx="5" />
        </g>
      </g>
    </svg>
  )
}
