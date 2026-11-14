interface PrismBrandMarkProps {
  size?: number;
  isRefracting?: boolean;
}

export function PrismBrandMark({ size = 24, isRefracting = false }: PrismBrandMarkProps) {
  return (
    <svg
      class={`prism-brand-mark${isRefracting ? ' is-refracting' : ''}`}
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="pm-hdr-warm" x1="16" y1="11" x2="26" y2="6.5" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#FB7185" />
          <stop offset="100%" stop-color="#FBBF24" />
        </linearGradient>
        <linearGradient id="pm-hdr-mid" x1="17" y1="14.5" x2="26.5" y2="14.2" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#34D399" />
          <stop offset="100%" stop-color="#22D3EE" />
        </linearGradient>
        <linearGradient id="pm-hdr-cool" x1="18" y1="18" x2="26" y2="21.5" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#60A5FA" />
          <stop offset="100%" stop-color="#C084FC" />
        </linearGradient>
      </defs>

      {/* Incoming coherent light beam */}
      <path
        d="M2 16.5L10.2 12.6"
        stroke="var(--prism-mark-stroke)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-opacity="0.88"
      />

      {/* Dispersed spectral rays */}
      <path
        class="prism-ray prism-ray-1"
        d="M16.2 11L25.5 6.8"
        stroke="url(#pm-hdr-warm)"
        stroke-width="2.1"
        stroke-linecap="round"
      />
      <path
        class="prism-ray prism-ray-2"
        d="M17.2 14.3L26 14.1"
        stroke="url(#pm-hdr-mid)"
        stroke-width="2.1"
        stroke-linecap="round"
      />
      <path
        class="prism-ray prism-ray-3"
        d="M18.2 17.6L25.2 21.4"
        stroke="url(#pm-hdr-cool)"
        stroke-width="2.1"
        stroke-linecap="round"
      />

      {/* Faceted crystal prism */}
      <polygon
        points="13.5,4.2 5,22.2 22,22.2"
        fill="var(--prism-mark-glass)"
        stroke="var(--prism-mark-stroke)"
        stroke-width="1.8"
        stroke-linejoin="round"
      />
      <line
        x1="13.5"
        y1="5.2"
        x2="13.5"
        y2="21.4"
        stroke="var(--prism-mark-stroke)"
        stroke-width="0.9"
        stroke-opacity="0.38"
      />
    </svg>
  );
}
