// Símbolo oficial de ManoAmiga, vectorizado a partir del diseño de marca:
// techo rojo de protección sobre las iniciales "MA".
export default function Logo({ inverse = false, height = 28 }) {
  const navy = inverse ? '#FFFFFF' : '#16325C';
  return (
    <svg
      viewBox="0 0 384 227"
      height={height}
      width={Math.round((height * 384) / 227)}
      role="img"
      aria-label="ManoAmiga"
      focusable="false"
      style={{ flex: 'none', display: 'block' }}
    >
      <polygon fill="#D7263D" points="0,106 192,0 384,106 384,145 192,38 0,145" />
      <polygon fill={navy} points="0,168 45,143 45,227 0,227" />
      <path
        fill={navy}
        fillRule="evenodd"
        d="M56 143 85 122 107 154 152 84 192 61 384 168V227H349V193H215V227H170V121L119 201H95ZM215 113 300 159H215Z"
      />
    </svg>
  );
}
