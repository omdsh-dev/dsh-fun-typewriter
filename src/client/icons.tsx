/**
 * Inline speaker icons for the header mute button. The canonical SVG markup
 * lives in `assets/speaker_on.svg` / `assets/speaker_muted.svg`; this module
 * mirrors it as React JSX because the client bundler (tsdown) has no SVG
 * loader, and `fill="currentColor"` lets the glyphs follow the shell theme.
 */

export interface SpeakerIconProps {
  size?: number
  className?: string
}

/** Speaker with two sound waves (audible state). */
export function SpeakerOnIcon({ size = 14, className }: SpeakerIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <title>sound on</title>
      {/* speaker body */}
      <path
        d="M2 6.2C2 6.09 2.09 6 2.2 6h2.06c.06 0 .12-.024.163-.066l2.368-2.564a.3.3 0 0 1 .51.212v8.836a.3.3 0 0 1-.51.212L4.423 10.066A.23.23 0 0 0 4.26 10H2.2a.2.2 0 0 1-.2-.2V6.2Z"
        fill="currentColor"
      />
      {/* inner wave */}
      <path d="M9.6 5.4a2.6 2.6 0 0 1 0 5.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      {/* outer wave */}
      <path d="M11.2 3.8a5 5 0 0 1 0 8.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

/** Speaker with a strike-through slash (muted state). */
export function SpeakerMutedIcon({ size = 14, className }: SpeakerIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <title>sound muted</title>
      {/* speaker body (waves dropped in the muted state) */}
      <path
        d="M2 6.2C2 6.09 2.09 6 2.2 6h2.06c.06 0 .12-.024.163-.066l2.368-2.564a.3.3 0 0 1 .51.212v8.836a.3.3 0 0 1-.51.212L4.423 10.066A.23.23 0 0 0 4.26 10H2.2a.2.2 0 0 1-.2-.2V6.2Z"
        fill="currentColor"
      />
      {/* muted waves */}
      <path d="M9.5 6.5l.6.6M10.8 5.2l1.6 1.6M9.9 5.2l2.5 2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      {/* slash */}
      <path d="M9.1 3.9l4.6 8.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}
