// Sanie ciągnięte przez renifera — w stylu ikon lucide (stroke, 24×24).
export default function SleighIcon({ size = 24, className = "" }: { size?: number | string; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {/* Sanie */}
      <path d="M1.5 8v3.5a3 3 0 0 0 3 3h5l1.5-4" />
      <path d="M1 17.5h10a2 2 0 0 0 2-2" />
      <path d="M4.5 14.5v3M8.5 14.5v3" />
      {/* Uprząż */}
      <path d="M11 12.5 14.5 11" />
      {/* Renifer */}
      <path d="M14.5 11h4.5" />
      <path d="M15 11v6M18.5 11v6" />
      <path d="M19 11l1.5-2.5H22" />
      <path d="M20.5 8.5 19.5 5M20 6.7l-1.3-.6M21 7.6l1-2.4" />
      <circle className="xmas-nose" cx="22.6" cy="8.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}
