/** Two nodes joined by a wire: the product in one mark. */
export function Wordmark() {
  return (
    <span className="wordmark">
      <svg width="28" height="14" viewBox="0 0 28 14" aria-hidden="true">
        <line x1="6" y1="7" x2="22" y2="7" stroke="var(--signal)" strokeWidth="2" />
        <circle cx="6" cy="7" r="5" fill="var(--panel)" stroke="var(--ink)" strokeWidth="2" />
        <circle cx="22" cy="7" r="5" fill="var(--signal)" stroke="var(--signal)" strokeWidth="2" />
      </svg>
      Kydos Connect
    </span>
  );
}
