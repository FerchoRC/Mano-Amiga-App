// HU-09: Diálogo para activar una alerta de emergencia en una sede.
import { Siren } from 'lucide-react';
import { useState } from 'react';

import { useAuth } from '../../auth/AuthProvider.jsx';
import Alert from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import Dialog from '../../components/Dialog.jsx';
import { SelectField, TextArea } from '../../components/Field.jsx';
import { api } from '../../lib/api.js';
import { TIPOS_EMERGENCIA, tipoEmergencia } from '../../lib/alertas.js';
import styles from './EnviarAlertaDialog.module.css';

export default function EnviarAlertaDialog({ open, onClose, sedes = [], onEnviada }) {
  const { session } = useAuth();
  // Por defecto, la sede donde trabaja quien envía la alerta.
  const [sedeId, setSedeId] = useState(() => {
    const mia = session?.usuario.sede?.id;
    return sedes.some((s) => s.id === mia) ? mia : (sedes[0]?.id ?? '');
  });
  const [tipo, setTipo] = useState('incendio');
  const [instrucciones, setInstrucciones] = useState(
    tipoEmergencia('incendio').instruccionSugerida
  );
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const handleTipoChange = (nuevoTipo) => {
    setTipo(nuevoTipo);
    const sugerida = tipoEmergencia(nuevoTipo).instruccionSugerida;
    setInstrucciones(sugerida);
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!sedeId) {
      setError('Selecciona la sede en emergencia.');
      return;
    }
    if (!instrucciones.trim()) {
      setError('Escribe las instrucciones para los empleados.');
      return;
    }

    setEnviando(true);
    setError(null);

    try {
      const res = await api('/api/alertas', {
        method: 'POST',
        body: {
          sedeId,
          tipo,
          instrucciones: instrucciones.trim(),
        },
      });

      onEnviada?.(res.alerta);
      handleClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Activar alerta de emergencia"
      description="Esta alerta notificará de inmediato a todos los empleados de la sede."
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="enviar-alerta-form"
            variant="danger"
            icon={Siren}
            loading={enviando}
          >
            Enviar alerta de emergencia
          </Button>
        </>
      }
    >
      <form id="enviar-alerta-form" onSubmit={handleSubmit} noValidate className={styles.form}>
        <div className={styles.warningBox} role="note">
          <Siren size={20} aria-hidden="true" />
          <span>
            Úsala únicamente ante situaciones reales o simulacros programados.
          </span>
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        {sedes.length > 1 ? (
          <SelectField
            label="Sede afectada"
            value={sedeId}
            onChange={(e) => setSedeId(e.target.value)}
          >
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre} · {s.ciudad}
              </option>
            ))}
          </SelectField>
        ) : (
          <div className={styles.singleSede}>
            <span className="eyebrow">Sede</span>
            <strong>{sedes[0]?.nombre}</strong>
          </div>
        )}

        <SelectField
          label="Tipo de emergencia"
          value={tipo}
          onChange={(e) => handleTipoChange(e.target.value)}
        >
          {TIPOS_EMERGENCIA.map((t) => (
            <option key={t.id} value={t.id}>
              {t.etiqueta}
            </option>
          ))}
        </SelectField>

        <TextArea
          label="Instrucciones para el personal"
          hint="Sé breve y directo. Indica ruta de evacuación o punto de encuentro."
          value={instrucciones}
          onChange={(e) => setInstrucciones(e.target.value)}
          rows={4}
        />
      </form>
    </Dialog>
  );
}
