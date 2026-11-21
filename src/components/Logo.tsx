import s from "./Logo.module.css";

/** Felt mark: a red ink stamp with a hand-set italic "f". */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg className={s.logo} width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <circle cx="32" cy="32" r="30" fill="#D9472B" />
      <circle cx="32" cy="32" r="25.5" fill="none" stroke="#FFF9F0" strokeWidth="1.4" strokeDasharray="2.2 3" />
      <text x="33" y="44" textAnchor="middle" fontSize="38" fontStyle="italic" fontWeight="400" fill="#FFF9F0" style={{ fontFamily: "var(--font-serif)" }}>f</text>
    </svg>
  );
}
