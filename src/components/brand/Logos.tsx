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

/**
 * GoogleIcon component (Clean single-contour path for monochrome)
 */
export const GoogleIcon = ({ className }: LogoProps) => (
  <svg viewBox="0 0 24 24" className={clsx(className)} aria-label="Google">
    <path 
      fill="currentColor"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09zM12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23zM5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84zM12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1c-4.3 0-8 2.5-9.7 6.1l3.6 2.8c.9-2.6 3.3-4.5 6.1-4.5z"
    />
  </svg>
);
