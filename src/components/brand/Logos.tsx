import clsx from 'clsx';

interface LogoProps {
  className?: string;
}

/**
 * DitiroBanner component
 * Uses mask-image to allow color styling via Tailwind classes (e.g., text-[#d48c2b] bg-current)
 */
export const DitiroBanner = ({ className }: LogoProps) => (
  <div 
    className={clsx("bg-current transition-colors", className)} 
    style={{
      maskImage: "url('/ditiro-banner.svg')",
      maskRepeat: "no-repeat",
      maskSize: "contain",
      maskPosition: "center",
      WebkitMaskImage: "url('/ditiro-banner.svg')",
      WebkitMaskRepeat: "no-repeat",
      WebkitMaskSize: "contain",
      WebkitMaskPosition: "center",
    }}
    aria-label="Ditiro"
  />
);

/**
 * DitiroIcon component
 */
export const DitiroIcon = ({ className }: LogoProps) => (
  <div 
    className={clsx("bg-current transition-colors", className)} 
    style={{
      maskImage: "url('/ditiro-icon.svg')",
      maskRepeat: "no-repeat",
      maskSize: "contain",
      maskPosition: "center",
      WebkitMaskImage: "url('/ditiro-icon.svg')",
      WebkitMaskRepeat: "no-repeat",
      WebkitMaskSize: "contain",
      WebkitMaskPosition: "center",
    }}
    aria-label="Ditiro Icon"
  />
);

/**
 * LXGLogo component
 */
export const LXGLogo = ({ className }: LogoProps) => (
  <svg viewBox="0 0 100 40" className={clsx("fill-current", className)} aria-label="LXG">
    <path d="M10 5h10v30H10zM25 5h10l10 15-10 15h-10l10-15zM60 5h10v20h10V5h10v30H80V15H70v20H60z" />
  </svg>
);

/**
 * SparkleIcon component
 */
export const SparkleIcon = ({ className }: LogoProps) => (
  <svg viewBox="0 0 24 24" className={clsx("fill-current", className)} aria-label="Sparkle">
    <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
  </svg>
);
