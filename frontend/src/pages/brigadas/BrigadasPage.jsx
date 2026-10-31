import { Building2, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '../../auth/AuthProvider.jsx';
import Alert from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import SedeSelect from '../../components/SedeSelect.jsx';
import { api } from '../../lib/api.js';
import { TIPOS_BRIGADA } from '../../lib/brigadas.js';
import useSedeSeleccionada from '../../lib/useSedeSeleccionada.js';
import { PERMISOS } from '../../lib/roles.js';
import BrigadaCard from './BrigadaCard.jsx';
import BrigadaDialog from './BrigadaDialog.jsx';
import styles from './Brigadas.module.css';

export default function BrigadasPage() {
  const { can } = useAuth();
  const { sedes, sede, setSedeId, error: errorSedes } = useSedeSeleccionada();
  const [brigadas, setBrigadas] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [dialog, setDialog] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const { brigadas: data = [] } = await api('/api/brigadas');
      setBrigadas(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const brigadasSede = useMemo(() => {
    if (!sede) return [];
    return (brigadas ?? []).filter((brigada) => (brigada.sede?.id ?? brigada.sedeId) === sede.id);
  }, [brigadas, sede]);

  const conformadas = TIPOS_BRIGADA.filter((tipo) => brigadasSede.some((brigada) => brigada.tipo === tipo.id)).length;

  const onSave = (brigadaActualizada) => {
    setBrigadas((actual) => {
      const lista = actual ?? [];
      const sinActual = lista.filter((item) => item.id !== brigadaActualizada.id);
      return [...sinActual, brigadaActualizada];
    });
  };

  const onDelete = (id) => {
    setBrigadas((actual) => (actual ?? []).filter((brigada) => brigada.id !== id));
  };

  if (errorSedes) {
    return (
      <div className={styles.page}>
        <Alert tone="error">{errorSedes}</Alert>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1>Brigadas</h1>
          <p className="muted">Quién responde en cada tipo de emergencia, sede por sede.</p>
        </div>
        {can(PERMISOS.BRIGADAS_GESTIONAR) && sede && (
          <Button icon={Plus} onClick={() => setDialog({ sede, tipo: 'primeros_auxilios' })}>
            Crear brigada
          </Button>
        )}
      </header>

      {sedes.length > 0 && (
        <SedeSelect sedes={sedes} value={sede?.id} onChange={setSedeId} />
      )}

      {cargando && !brigadas && (
        <div className={styles.loading} aria-busy="true">
          <span className="spinner" />
          <span className="visually-hidden">Cargando brigadas</span>
        </div>
      )}

      {error && <Alert tone="error" action={<Button variant="secondary" size="sm" onClick={cargar}>Reintentar</Button>} >{error}</Alert>}

      {!sedes.length && !cargando && (
        <section className={styles.empty}>
          <span className={styles.emptyIcon}>
            <Building2 size={24} aria-hidden="true" />
          </span>
          <h2>Primero registra una sede</h2>
          <p className="muted">
            {can(PERMISOS.SEDES_GESTIONAR)
              ? 'Registra la primera sede para configurar sus brigadas y puntos de encuentro.'
              : 'Cuando el administrador registre la sede, podrás ver las brigadas de la empresa aquí.'}
          </p>
          {can(PERMISOS.SEDES_GESTIONAR) && (
            <Button icon={Plus} to="/sedes/nueva">
              Registrar sede
            </Button>
          )}
        </section>
      )}

      {sede && !cargando && (
        <>
          <p className={styles.summary}>
            <strong>{conformadas}</strong> de {TIPOS_BRIGADA.length} brigadas conformadas en {sede.nombre}
          </p>

          <div className={styles.grid}>
            {TIPOS_BRIGADA.map((tipo) => {
              const brigada = brigadasSede.find((item) => item.tipo === tipo.id);
              return (
                <BrigadaCard
                  key={tipo.id}
                  tipo={tipo}
                  brigada={brigada}
                  sede={sede}
                  brigadas={brigadas ?? []}
                  onEdit={() => setDialog({ sede, brigada, tipo: tipo.id })}
                  onDelete={onDelete}
                  onCreate={() => setDialog({ sede, tipo: tipo.id })}
                />
              );
            })}
          </div>
        </>
      )}

      {dialog && (
        <BrigadaDialog
          open={Boolean(dialog)}
          sede={dialog.sede}
          tipo={dialog.tipo}
          brigada={dialog.brigada}
          brigadas={brigadas ?? []}
          onClose={() => setDialog(null)}
          onSave={(brigadaActualizada) => {
            onSave(brigadaActualizada);
            setDialog(null);
          }}
        />
      )}
    </div>
  );
}
