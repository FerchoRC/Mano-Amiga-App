import Button from '../components/Button.jsx';
import Logo from '../components/Logo.jsx';

export default function NotFoundPage() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--gutter)',
      }}
    >
      <div style={{ display: 'grid', gap: 16, justifyItems: 'start', maxWidth: 420 }}>
        <Logo height={32} />
        <p className="eyebrow" style={{ marginTop: 24 }}>
          Error 404
        </p>
        <h1>No encontramos esta página</h1>
        <p className="muted">Es posible que el enlace esté mal escrito o que la página ya no exista.</p>
        <Button to="/inicio">Ir al inicio</Button>
      </div>
    </div>
  );
}
