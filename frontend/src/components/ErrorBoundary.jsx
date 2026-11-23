import { Component } from 'react';

import styles from './ErrorBoundary.module.css';

// Si una pantalla falla al dibujarse, React borra toda la interfaz. Este límite muestra
// un mensaje en su lugar y deja volver a Inicio. `resetKey` (la ruta actual) lo reinicia
// al navegar, para que el error de una pantalla no bloquee las demás.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Error al mostrar la pantalla:', error, info.componentStack);
  }

  componentDidUpdate(anteriores) {
    if (this.state.error && anteriores.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={styles.caja} role="alert">
        <h1 className={styles.titulo}>Esta pantalla no se pudo mostrar</h1>
        <p className="muted">
          Ocurrió un error inesperado. Tus datos están a salvo. Intenta de nuevo o vuelve a Inicio.
        </p>
        <div className={styles.acciones}>
          <button type="button" className={styles.boton} onClick={() => window.location.reload()}>
            Intentar de nuevo
          </button>
          <a className={styles.enlace} href="/inicio">
            Volver a Inicio
          </a>
        </div>
      </div>
    );
  }
}
