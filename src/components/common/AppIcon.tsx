import { memo } from 'react';

interface AppIconProps {
  size?: number;
  className?: string;
}

export const AppIcon = memo(function AppIcon({ size = 24, className }: AppIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      className={className}
    >
      <defs>
        <linearGradient id="appIconShadowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#64748b" />
          <stop offset="30%" stopColor="#475569" />
          <stop offset="60%" stopColor="#1e3a5f" />
          <stop offset="100%" stopColor="#0f1f33" />
        </linearGradient>
        <linearGradient id="appIconShieldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="20%" stopColor="#93c5fd" />
          <stop offset="50%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id="appIconBoltGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="40%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        <filter id="appIconBoltBlur" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="12" />
        </filter>
      </defs>

      <g transform="translate(256, 256) scale(1.19) translate(-256, -267.5)">
        {/* Shadow shield */}
        <path
          d="M 256 75 L 115 145 Q 115 285 115 320 Q 127 385 256 460 Q 385 385 397 320 Q 397 285 397 270 L 270 270 M 397 205 L 397 145 L 256 75"
          stroke="url(#appIconShadowGradient)"
          strokeWidth={46}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x={363} y={171} width={68} height={68} rx={8} fill="#1e3a5f" />

        {/* Main shield */}
        <path
          d="M 256 75 L 115 145 Q 115 285 115 320 Q 127 385 256 460 Q 385 385 397 320 Q 397 285 397 270 L 270 270 M 397 205 L 397 145 L 256 75"
          stroke="url(#appIconShieldGradient)"
          strokeWidth={26}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x={375} y={183} width={44} height={44} rx={6} fill="#60a5fa" />

        {/* Lightning bolt */}
        <g transform="rotate(-15, 256, 267) translate(256, 267) scale(1.5) translate(-269, -250)">
          <path
            d="M 280 140 L 269 217 L 302 228 L 258 283 L 291 294 L 247 360 L 269 290 L 236 279 L 280 224 L 247 213 Z"
            fill="url(#appIconBoltGradient)"
            filter="url(#appIconBoltBlur)"
            opacity={0.9}
          />
          <path
            d="M 280 140 L 269 217 L 302 228 L 258 283 L 291 294 L 247 360 L 269 290 L 236 279 L 280 224 L 247 213 Z"
            fill="url(#appIconBoltGradient)"
            filter="url(#appIconBoltBlur)"
            opacity={0.7}
          />
          <path
            d="M 280 140 L 269 217 L 302 228 L 258 283 L 291 294 L 247 360 L 269 290 L 236 279 L 280 224 L 247 213 Z"
            fill="url(#appIconBoltGradient)"
          />
        </g>
      </g>
    </svg>
  );
});
