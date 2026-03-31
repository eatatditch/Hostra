interface HostOSLogoProps {
  className?: string;
  height?: number;
}

export function HostOSLogo({ className, height = 32 }: HostOSLogoProps) {
  const scale = height / 100;
  const width = Math.round(380 * scale);

  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox="0 0 380 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* H */}
      <path
        d="M10,20 L10,80 L22,80 L22,55 L48,55 L48,80 L60,80 L60,20 L48,20 L48,43 L22,43 L22,20 Z"
        fill="#2d6a9f"
      />
      {/* o */}
      <path
        d="M72,48 C72,32 83,23 97,23 C111,23 122,32 122,48 L122,52 C122,68 111,77 97,77 C83,77 72,68 72,52 Z M84,52 C84,62 89,67 97,67 C105,67 110,62 110,52 L110,48 C110,38 105,33 97,33 C89,33 84,38 84,48 Z"
        fill="#2d6a9f"
      />
      {/* s */}
      <path
        d="M131,62 C131,55 137,51 149,49 L163,47 L163,44 C163,37 159,33 151,33 C143,33 138,37 137,43 L127,41 C128,31 137,23 151,23 C167,23 175,31 175,45 L175,77 L163,77 L163,71 C160,75 154,78 146,78 C136,78 131,72 131,62 Z M163,58 L163,55 L150,57 C143,58 141,61 141,64 C141,68 144,70 149,70 C157,70 163,65 163,58 Z"
        fill="#2d6a9f"
      />
      {/* t */}
      <path
        d="M189,33 L181,33 L181,24 L193,24 L193,10 L205,10 L205,24 L219,24 L219,33 L205,33 L205,60 C205,66 207,68 213,68 L219,68 L219,77 L210,77 C198,77 193,72 193,60 L193,33 Z"
        fill="#2d6a9f"
      />

      {/* Orange circle O with fork and spoon */}
      <circle cx="262" cy="50" r="36" fill="url(#orangeGrad)" />
      {/* Fork */}
      <g transform="translate(248, 18)" fill="white">
        <rect x="2" y="0" width="2.5" height="22" rx="1" />
        <rect x="7" y="0" width="2.5" height="22" rx="1" />
        <rect x="12" y="0" width="2.5" height="22" rx="1" />
        <rect x="0" y="18" width="17" height="3" rx="1.5" />
        <rect x="6.5" y="18" width="4" height="28" rx="2" />
      </g>
      {/* Spoon */}
      <g transform="translate(266, 22)" fill="white">
        <ellipse cx="6" cy="8" rx="6" ry="9" />
        <rect x="4" y="14" width="4" height="26" rx="2" />
      </g>

      {/* S */}
      <path
        d="M306,62 C307,69 314,74 324,74 C333,74 339,70 339,64 C339,58 335,55 325,53 L316,51 C304,49 297,43 297,33 C297,22 306,14 322,14 C337,14 346,22 347,33 L335,33 C334,27 329,23 322,23 C314,23 309,27 309,33 C309,38 313,41 322,43 L331,45 C344,47 351,54 351,64 C351,76 341,83 324,83 C307,83 296,75 295,62 Z"
        fill="url(#orangeGrad2)"
      />

      <defs>
        <linearGradient id="orangeGrad" x1="226" y1="20" x2="298" y2="80" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f5a623" />
          <stop offset="1" stopColor="#e8751a" />
        </linearGradient>
        <linearGradient id="orangeGrad2" x1="295" y1="14" x2="351" y2="83" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f5a623" />
          <stop offset="1" stopColor="#e8751a" />
        </linearGradient>
      </defs>
    </svg>
  );
}
