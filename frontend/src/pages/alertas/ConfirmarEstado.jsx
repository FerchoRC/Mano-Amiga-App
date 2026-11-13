// HU-10: Confirmar estado en una emergencia ("Estoy a salvo" o "Necesito ayuda").
import { Check, CheckCircle2, CircleAlert, LifeBuoy } from 'lucide-react';
import { useState } from 'react';

import Button from '../../components/Button.jsx';
import Dialog from '../../components/Dialog.jsx';
import { TextArea } from '../../components/Field.jsx';
import { useToast } from '../../components/Toast.jsx';
import { api } from '../../lib/api.js';
import styles from './ConfirmarEstado.module.css';

export default function ConfirmarEstado({ alerta, miRespuesta, onEstadoConfirmado }) {
  const toast = useToast();
  const [enviando, setEnviando] = useState(false);
  const [dialogAyuda, setDialogAyuda] = useState(false);
  const [mensajeAyuda, setMensajeAyuda] = useState('');

  if (!alerta || !alerta.activa) return null;

  const estadoActual = miRespuesta?.estado;

  async function enviarEstado(estado, mensaje = '') {
    setEnviando(true);
    try {
      const res = await api(`/api/alertas/${alerta.id}/respuestas`, {
        method: 'POST',
        body: { estado, mensaje },
      });
      onEstadoConfirmado?.(res.respuesta);
      toast(
        estado === 'a_salvo'
          ? 'Confirmaste que estás a salvo. Mantente en el punto de encuentro.'
          : 'Reportaste que necesitas ayuda. Los brigadistas han sido notificados.',
        { tone: estado === 'a_salvo' ? 'success' : 'error' }
      );
      setDialogAyuda(false);
      setMensajeAyuda('');
    } catch (err) {
      toast(err.message, { tone: 'error' });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className={styles.card} aria-labelledby="confirmar-estado-titulo">
      <div className={styles.header}>
        <div>
          <h3 id="confirmar-estado-titulo">¿Cómo te encuentras en este momento?</h3>
          <p className="muted">
            Tu respuesta ayuda a los brigadistas a saber quién está a salvo y quién necesita apoyo.
          </p>
        </div>

        {estadoActual && (
          <span
            className={`${styles.badge} ${estadoActual === 'a_salvo' ? styles.badgeSafe : styles.badgeHelp}`}
          >
            {estadoActual === 'a_salvo' ? (
              <>
                <Check size={14} aria-hidden="true" />
                Marcaste: Estoy a salvo
              </>
            ) : (
              <>
                <CircleAlert size={14} aria-hidden="true" />
                Marcaste: Necesito ayuda
              </>
            )}
          </span>
        )}
      </div>

      <div className={styles.buttons}>
        <button
          type="button"
          className={`${styles.buttonSafe} ${estadoActual === 'a_salvo' ? styles.selected : ''}`}
          onClick={() => enviarEstado('a_salvo')}
          disabled={enviando}
        >
          <CheckCircle2 size={24} aria-hidden="true" />
          <span className={styles.buttonText}>
            <strong>Estoy a salvo</strong>
            <span>Me encuentro en lugar seguro o en el punto de encuentro</span>
          </span>
        </button>

        <button
          type="button"
          className={`${styles.buttonHelp} ${estadoActual === 'necesita_ayuda' ? styles.selected : ''}`}
          onClick={() => setDialogAyuda(true)}
          disabled={enviando}
        >
          <LifeBuoy size={24} aria-hidden="true" />
          <span className={styles.buttonText}>
            <strong>Necesito ayuda</strong>
            <span>Estoy atrapado, lesionado o requiero asistencia</span>
          </span>
        </button>
      </div>

      <Dialog
        open={dialogAyuda}
        onClose={() => !enviando && setDialogAyuda(false)}
        size="sm"
        title="Reportar que necesitas ayuda"
        description="Indica a los brigadistas dónde estás o qué situación presentas."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDialogAyuda(false)}
              disabled={enviando}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => enviarEstado('necesita_ayuda', mensajeAyuda)}
              loading={enviando}
            >
              Enviar reporte de auxilio
            </Button>
          </>
        }
      >
        <TextArea
          label="Detalles de tu ubicación o condición"
          placeholder="p. ej. Piso 2, oficina 204. Humo en el pasillo."
          value={mensajeAyuda}
          onChange={(e) => setMensajeAyuda(e.target.value)}
          rows={3}
          autoFocus
          optional
        />
      </Dialog>
    </section>
  );
}
