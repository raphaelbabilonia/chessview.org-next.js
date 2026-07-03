/* eslint-disable @next/next/no-img-element */

const logoSources = {
  primary: "/brand/chessview-logo-horizontal-primary.svg",
  reversed: "/brand/chessview-logo-horizontal-reversed.svg",
  icon: "/brand/chessview-icon-primary.svg",
};

export function ChessViewLogo({ alt = "ChessView", ariaHidden = false, className = "", variant = "primary", height = 44 }) {
  const src = logoSources[variant] || logoSources.primary;

  return (
    <img
      alt={alt}
      aria-hidden={ariaHidden ? "true" : undefined}
      className={className}
      height={height}
      src={src}
    />
  );
}
