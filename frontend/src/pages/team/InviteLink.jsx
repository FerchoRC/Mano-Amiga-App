import { Check, Copy, MailCheck } from 'lucide-react';
import { useRef, useState } from 'react';

import Button from '../../components/Button.jsx';
import { tiempoRelativo } from '../../lib/format.js';
import styles from './Team.module.css';

// Muestra el enlace de invitación listo para copiar y compartir.
export default function InviteLink({ nombre, correo, enlace, correoEnviado, expiraEn }) {
  const [copiado, setCopiado] = useState(false);
  const inputRef = useRef(null);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlace);
    } catch {
      inputRef.current?.select();
      document.execCommand?.('copy');
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className={styles.linkBox}>
      <div className={styles.linkHead}>
        <span className={styles.linkIcon}>
          <MailCheck size={20} aria-hidden="true" />
        </span>
        <p>
          {correoEnviado ? (
            <>
              Enviamos la invitación a <strong>{correo}</strong>. También puedes compartir el enlace
              con {nombre} directamente.
            </>
          ) : (
            <>
              Comparte este enlace con <strong>{nombre}</strong> para que cree su contraseña.
              {expiraEn && ` Vence ${tiempoRelativo(expiraEn)?.toLowerCase()}.`}
            </>
          )}
        </p>
      </div>
      <div className={styles.linkRow}>
        <input
          ref={inputRef}
          className={styles.linkInput}
          value={enlace}
          readOnly
          aria-label="Enlace de invitación"
          onFocus={(e) => e.target.select()}
        />
        <Button variant="secondary" icon={copiado ? Check : Copy} onClick={copiar}>
          {copiado ? 'Copiado' : 'Copiar'}
        </Button>
      </div>
    </div>
  );
}
