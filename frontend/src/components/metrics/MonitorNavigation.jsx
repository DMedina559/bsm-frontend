export default function MonitorNavigation({ items, active, onChange, label }) {
  return (
    <nav className="monitor-navigation" aria-label={label}>
      {items.map(([id, title]) => (
        <button
          key={id}
          type="button"
          aria-current={active === id ? "page" : undefined}
          onClick={() => onChange(id)}
        >
          {title}
        </button>
      ))}
    </nav>
  );
}
