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
