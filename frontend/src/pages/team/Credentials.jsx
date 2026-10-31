import { Check, Copy, KeyRound } from 'lucide-react';
import { useState } from 'react';

import Button from '../../components/Button.jsx';
import styles from './Team.module.css';

// Datos de acceso recién creados, listos para copiar y entregar a la persona.
export default function Credentials({ nombre, correo, contrasena, debeCambiar }) {
  const [copiado, setCopiado] = useState(false);
  const urlIngreso = `${window.location.origin}/ingresar`;

  async function copiar() {
    const texto = [
      `Hola, ${nombre}. Este es tu acceso a ManoAmiga:`,
      `Ingresa en: ${urlIngreso}`,
      `Correo: ${correo}`,
      `Contraseña: ${contrasena}`,
      debeCambiar ? 'Al entrar te pediremos crear tu propia contraseña.' : '',
    ]
      .filter(Boolean)
      .join('\n');
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* sin portapapeles: los datos siguen visibles para copiarlos a mano */
    }
  }

  return (
    <div className={styles.linkBox}>
      <div className={styles.linkHead}>
        <span className={styles.linkIcon}>
          <KeyRound size={20} aria-hidden="true" />
        </span>
        <p>
          Entrégale estos datos a <strong>{nombre}</strong>.{' '}
          {debeCambiar
            ? 'Al entrar le pediremos crear su propia contraseña.'
            : 'Podrá entrar de inmediato con ellos.'}
        </p>
      </div>

      <dl className={styles.credentials}>
        <div>
          <dt>Ingresa en</dt>
          <dd>{urlIngreso}</dd>
        </div>
        <div>
          <dt>Correo</dt>
          <dd>{correo}</dd>
        </div>
        <div>
          <dt>Contraseña</dt>
          <dd className={styles.secret}>{contrasena}</dd>
        </div>
      </dl>

      <Button variant="secondary" icon={copiado ? Check : Copy} onClick={copiar} block>
        {copiado ? 'Datos copiados' : 'Copiar datos de acceso'}
      </Button>
      <p className={styles.subtle}>Por seguridad, la contraseña no se volverá a mostrar.</p>
    </div>
  );
}
