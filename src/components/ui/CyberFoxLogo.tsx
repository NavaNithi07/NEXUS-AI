// src/components/ui/CyberFoxLogo.tsx
import React from 'react';
import { motion } from 'framer-motion';

interface CyberFoxLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  animated?: boolean;
  className?: string;
  showGlow?: boolean;
}

export const CyberFoxLogo: React.FC<CyberFoxLogoProps> = ({
  size = 'md',
  animated = false,
  className = '',
  showGlow = true,
}) => {
  const dimensionMap = {
    sm: { w: 32, h: 40 },
    md: { w: 44, h: 56 },
    lg: { w: 64, h: 80 },
    xl: { w: 100, h: 125 },
    hero: { w: 250, h: 310 },
  };

  const { w, h } = dimensionMap[size];

  const svgContent = (
    <svg
      width={w}
      height={h}
      viewBox="0 0 320 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="overflow-visible filter drop-shadow-[0_0_20px_rgba(34,211,238,0.4)]"
    >
      <defs>
        {/* Core Electric Neon Gradients */}
        <linearGradient id="foxNeonCyan" x1="80" y1="40" x2="260" y2="340" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="30%" stopColor="#0ea5e9" />
          <stop offset="70%" stopColor="#0284c7" />
          <stop offset="100%" stopColor="#0369a1" />
        </linearGradient>

        <linearGradient id="foxNeonViolet" x1="160" y1="60" x2="280" y2="320" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="40%" stopColor="#6366f1" />
          <stop offset="80%" stopColor="#4338ca" />
          <stop offset="100%" stopColor="#1e1b4b" />
        </linearGradient>

        <linearGradient id="foxNeonDeepBack" x1="180" y1="70" x2="290" y2="280" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="50%" stopColor="#312e81" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>

        <linearGradient id="foxWhiteHighlight" x1="90" y1="120" x2="210" y2="260" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="35%" stopColor="#f0f9ff" />
          <stop offset="70%" stopColor="#bae6fd" />
          <stop offset="100%" stopColor="#7dd3fc" />
        </linearGradient>

        <linearGradient id="foxNeonMane1" x1="130" y1="140" x2="250" y2="370" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="40%" stopColor="#0284c7" />
          <stop offset="80%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>

        <linearGradient id="foxNeonMane2" x1="110" y1="180" x2="210" y2="390" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="40%" stopColor="#0284c7" />
          <stop offset="80%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#1e1b4b" />
        </linearGradient>

        <linearGradient id="foxEarInnerFold" x1="160" y1="40" x2="195" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#e0f2fe" />
          <stop offset="80%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>

        <linearGradient id="foxFaceShadow" x1="130" y1="140" x2="185" y2="195" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0369a1" />
          <stop offset="50%" stopColor="#1e3a8a" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>

      {/* 1. DEEPEST BACK MANE (Far Right Silhouette Curve) */}
      <path
        d="M200 102 C230 110, 268 135, 282 172 C295 208, 288 250, 256 280 C242 260, 236 238, 232 215 C222 172, 208 135, 200 102 Z"
        fill="url(#foxNeonDeepBack)"
      />

      {/* 2. SECOND BACK MANE SWOOP (Upper Right Crest) */}
      <path
        d="M226 122 C255 142, 282 175, 282 214 C282 248, 260 286, 228 304 C236 282, 238 255, 226 232 C216 210, 202 188, 192 165 L226 122 Z"
        fill="url(#foxNeonViolet)"
      />

      {/* 3. THIRD FLOWING MANE SWOOP (Middle Cascading Plume) */}
      <path
        d="M192 165 C215 192, 248 225, 248 266 C248 298, 224 330, 196 350 C206 325, 208 296, 195 270 C182 242, 165 220, 148 198 L192 165 Z"
        fill="url(#foxNeonMane1)"
      />

      {/* 4. FOURTH LOWER MANE PLUME (Curving down to the final hook tip) */}
      <path
        d="M162 205 C186 238, 212 278, 212 320 C212 355, 190 388, 168 402 C178 376, 176 345, 160 320 C146 295, 128 274, 114 250 L162 205 Z"
        fill="url(#foxNeonMane2)"
      />

      {/* 5. BACK EAR (LEFT) */}
      <path
        d="M125 56 L158 98 L142 112 L125 56 Z"
        fill="#0369a1"
      />
      <path
        d="M130 64 L152 95 L144 104 L130 64 Z"
        fill="#082f49"
      />

      {/* 6. FRONT EAR (RIGHT - Tall, Majestic & Pointed) */}
      <path
        d="M172 40 C175 42, 198 80, 204 116 L174 125 C170 102, 169 70, 172 40 Z"
        fill="url(#foxNeonCyan)"
      />
      {/* Front Ear Inner Fold (Crisp White/Cyan highlight) */}
      <path
        d="M174 52 C178 66, 190 90, 194 110 L180 118 C175 98, 174 74, 174 52 Z"
        fill="url(#foxEarInnerFold)"
      />

      {/* 7. FOREHEAD PLANE & CROWN */}
      <path
        d="M172 40 C170 70, 156 100, 136 116 C134 102, 138 74, 148 60 L172 40 Z"
        fill="url(#foxNeonCyan)"
      />
      <path
        d="M136 116 C152 102, 170 100, 192 108 C204 122, 214 138, 216 156 C194 146, 172 142, 150 148 L136 116 Z"
        fill="url(#foxNeonCyan)"
      />

      {/* 8. SNOUT BRIDGE — smooth aerodynamic slope from crown down to nose */}
      <path
        d="M136 116 C122 138, 102 164, 73 193 L83 197 C104 178, 126 156, 148 148 L136 116 Z"
        fill="url(#foxNeonCyan)"
      />

      {/* 9. BROW SHADOW FOLD — defining the eye socket exactly like the reference */}
      <path
        d="M118 165 C132 150, 152 142, 180 144 C166 152, 150 156, 136 168 L118 165 Z"
        fill="url(#foxFaceShadow)"
      />

      {/* 10. FOX EYE — sleek, slanted, solid black closed eye matching reference photo */}
      {/* Slanted closed eye wedge: angled at ~32 degrees, nestled at the base of the brow and resting directly on the cheek */}
      <path
        d="M116 166 C124 156, 140 148, 152 147 C144 154, 130 162, 116 166 Z"
        fill="#050811"
      />
      {/* Upper crease line */}
      <path
        d="M115 164 C124 154, 140 146, 154 146"
        stroke="#020617"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* Subtle crisp glint along the eyelid contour */}
      <path
        d="M136 151 C142 149, 148 148, 151 148"
        stroke="#ffffff"
        strokeWidth="0.9"
        strokeLinecap="round"
        opacity="0.85"
      />

      {/* 11. WHITE CHEEK FLUFF — Upper & Lower plumes sweeping back */}
      {/* Upper white plume sweeping from below eye to back right */}
      <path
        d="M116 166 C104 180, 88 196, 76 197 L88 202 C102 200, 120 190, 142 178 C168 166, 194 160, 222 164 C202 168, 178 178, 154 192 C136 202, 122 214, 108 218 L116 166 Z"
        fill="url(#foxWhiteHighlight)"
      />

      {/* 12. DELICATE BLACK NOSE TIP */}
      <path
        d="M72 192 C70 194, 71 197, 74 198 L78 196 C78 193, 75 191, 72 192 Z"
        fill="#020617"
      />

      {/* 13. SLEEK LOWER JAW / CHIN */}
      <path
        d="M78 198 C88 206, 100 214, 116 216 C108 218, 96 220, 86 216 C78 212, 76 204, 78 198 Z"
        fill="#082f49"
      />

      {/* 14. LOWER CHEEK FLUFF (White/Cyan Wing sweeping back) */}
      <path
        d="M116 216 C140 210, 168 196, 196 186 C210 182, 226 182, 238 188 C218 190, 196 202, 178 214 C158 226, 138 238, 118 246 L116 216 Z"
        fill="url(#foxWhiteHighlight)"
      />

      {/* 15. CHEST SWEEP (Flowing gracefully down to the inner point) */}
      <path
        d="M124 244 C144 234, 162 222, 180 210 C170 226, 156 250, 144 276 C134 298, 128 322, 130 350 C120 326, 118 298, 120 274 C121 262, 122 252, 124 244 Z"
        fill="url(#foxWhiteHighlight)"
      />

      {/* 16. FLOWING CHEST WING 1 (Lower Fluff Segment) */}
      <path
        d="M194 186 C214 192, 240 206, 256 226 C272 250, 280 278, 274 306 C258 300, 248 286, 238 272 C222 244, 204 222, 184 206 L194 186 Z"
        fill="url(#foxNeonViolet)"
      />

      {/* 17. FLOWING CHEST WING 2 (Cascading Cyan/Blue) */}
      <path
        d="M184 206 C206 226, 228 250, 238 276 C250 304, 246 332, 226 354 C228 326, 218 304, 206 286 C190 264, 170 244, 150 230 L184 206 Z"
        fill="url(#foxNeonMane1)"
      />

      {/* 18. LOWEST INNER FLUFF (Downwards Cyan Spike) */}
      <path
        d="M150 230 C172 254, 192 284, 198 314 C204 344, 192 370, 172 388 C182 364, 178 338, 168 316 C158 294, 144 276, 130 260 L150 230 Z"
        fill="url(#foxNeonMane2)"
      />

      {/* 19. SHARP NEON ACCENT LINES & SPECULAR EDGES */}
      <path
        d="M146 75 C156 88, 168 102, 182 112"
        stroke="#67e8f9"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d="M162 160 C182 168, 204 178, 220 192"
        stroke="#38bdf8"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.75"
      />
      <path
        d="M146 240 C166 265, 182 292, 188 324"
        stroke="#a78bfa"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.8"
      />
      <path
        d="M136 116 C122 138, 102 164, 73 193"
        stroke="#67e8f9"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.65"
      />
    </svg>
  );

  if (!animated) {
    return (
      <div className={`relative inline-flex items-center justify-center ${className}`}>
        {showGlow && (
          <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full scale-110 pointer-events-none" />
        )}
        {svgContent}
      </div>
    );
  }

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      {/* Background Animated Neon Pulsing Aura */}
      {showGlow && (
        <>
          <motion.div
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.35, 0.7, 0.35],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute inset-0 bg-cyan-500/25 blur-3xl rounded-full pointer-events-none"
          />
          <motion.div
            animate={{
              scale: [1.1, 0.95, 1.1],
              opacity: [0.2, 0.5, 0.2],
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute inset-0 bg-violet-600/25 blur-2xl rounded-full pointer-events-none"
          />
        </>
      )}

      {/* Floating Mascot Animation */}
      <motion.div
        animate={{
          y: [-6, 6, -6],
          rotate: [-1, 1, -1],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="relative z-10"
      >
        {svgContent}
      </motion.div>
    </div>
  );
};

export default CyberFoxLogo;
