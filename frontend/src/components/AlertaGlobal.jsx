import { ChevronRight, Siren } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';

import { tipoEmergencia } from '../lib/alertas.js';
import { api } from '../lib/api.js';
import { useRealtimeEvent } from '../lib/useRealtime.js';
import styles from './AlertaGlobal.module.css';

const ESTADO = {
  a_salvo: 'Marcaste que estás a salvo',
  necesita_ayuda: 'Pediste ayuda',
};

// HU-09: si hay una emergencia activa en la sede de la persona, se ve en todas las
// pantallas (en Inicio ya está el aviso completo con los botones de HU-10).
export default function AlertaGlobal() {
  const location = useLocation();
  const [alerta, setAlerta] = useState(null);

  const cargar = useCallback(() => {
    api('/api/alertas/activa')
      .then((res) => setAlerta(res.alerta ?? null))
      .catch(() => {});
  }, []);

  // Al navegar se refresca: así se refleja si la persona ya confirmó su estado.
  useEffect(() => {
    cargar();
  }, [cargar, location.pathname]);

  useRealtimeEvent('alerta:nueva', cargar);
  useRealtimeEvent('alerta:finalizada', cargar);

  if (!alerta || location.pathname === '/inicio') return null;

  const tipo = tipoEmergencia(alerta.tipo);
  const Icono = tipo.icono ?? Siren;

  return (
    <Link to="/inicio" className={styles.banner} role="alert">
      <span className={styles.icon}>
        <Icono size={18} aria-hidden="true" />
      </span>
      <span className={styles.text}>
        <strong>
          Emergencia activa: {tipo.etiqueta} · {alerta.sedeNombre}
        </strong>
        <span>{ESTADO[alerta.miRespuesta?.estado] ?? 'Confirma cómo estás'}</span>
      </span>
      <ChevronRight size={18} aria-hidden="true" className={styles.chevron} />
    </Link>
  );
}
