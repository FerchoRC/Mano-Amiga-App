// HU-09: Banner destacado de alerta de emergencia para empleados y brigadistas.
import { CheckCircle2, Siren } from 'lucide-react';
import { useState } from 'react';

import Button from '../../components/Button.jsx';
import Dialog from '../../components/Dialog.jsx';
import { tiempoRelativo } from '../../lib/format.js';
import { tipoEmergencia } from '../../lib/alertas.js';
import styles from './AlertaBanner.module.css';

export default function AlertaBanner({ alerta, puedeFinalizar = false, onFinalizar }) {
  const [confirmar, setConfirmar] = useState(false);
  const [finalizando, setFinalizando] = useState(false);

  if (!alerta || !alerta.activa) return null;

  const infoTipo = tipoEmergencia(alerta.tipo);
  const Icono = infoTipo.icono ?? Siren;

  async function handleFinalizar() {
    setFinalizando(true);
    try {
      await onFinalizar?.(alerta.id);
      setConfirmar(false);
    } finally {
      setFinalizando(false);
    }
  }

  return (
    <>
      <section className={styles.banner} role="alert" aria-live="assertive">
        <div className={styles.beaconWrap}>
          <span className={styles.pulse} aria-hidden="true" />
          <span className={styles.iconWrap}>
            <Icono size={28} aria-hidden="true" />
          </span>
        </div>

        <div className={styles.content}>
          <div className={styles.metaRow}>
            <span className={styles.tag}>Emergencia activa</span>
            <span className={styles.sedeName}>{alerta.sedeNombre}</span>
            <span className={styles.time}>{tiempoRelativo(alerta.creadoEn)}</span>
          </div>

          <h2 className={styles.title}>{infoTipo.etiqueta}</h2>

          <p className={styles.instructions}>{alerta.instrucciones}</p>

          <p className={styles.sender}>
            Reportada por {alerta.remitenteNombre || 'el equipo de brigada'}.
          </p>
        </div>

        {puedeFinalizar && (
          <div className={styles.actionWrap}>
            <Button
              variant="secondary"
              size="sm"
              icon={CheckCircle2}
              onClick={() => setConfirmar(true)}
            >
              Finalizar emergencia
            </Button>
          </div>
        )}
      </section>

      <Dialog
        open={confirmar}
        onClose={() => !finalizando && setConfirmar(false)}
        size="sm"
        title="¿Finalizar esta emergencia?"
        description="Se desactivará la alerta para todos los trabajadores y brigadistas de la sede."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirmar(false)}
              disabled={finalizando}
            >
              Continuar alerta
            </Button>
            <Button
              variant="primary"
              onClick={handleFinalizar}
              loading={finalizando}
            >
              Finalizar emergencia
            </Button>
          </>
        }
      />
    </>
  );
}
