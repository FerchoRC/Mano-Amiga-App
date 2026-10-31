import { AlertCircle, Crown, Ellipsis, Pencil, Trash2, Users } from 'lucide-react';
import { useMemo, useState } from 'react';

import Alert from '../../components/Alert.jsx';
import Avatar from '../../components/Avatar.jsx';
import Button from '../../components/Button.jsx';
import Dialog from '../../components/Dialog.jsx';
import Menu from '../../components/Menu.jsx';
import { useToast } from '../../components/Toast.jsx';
import { api } from '../../lib/api.js';
import { PERMISOS } from '../../lib/roles.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import styles from './Brigadas.module.css';

function estadoBrigada(brigada) {
  if (!brigada) {
    return { texto: 'Sin conformar', tono: 'warning' };
  }

  const activos = (brigada.miembros ?? []).filter((miembro) => miembro.activo !== false).length;
  const liderActivo = brigada.lider && brigada.lider.id;

  if (liderActivo && activos > 0) return { texto: 'Conformada', tono: 'success' };
  if (!liderActivo) return { texto: 'Sin líder', tono: 'warning' };
  return { texto: 'Sin brigadistas activos', tono: 'warning' };
}

export default function BrigadaCard({ tipo, brigada, sede, brigadas, onEdit, onDelete, onCreate }) {
  const toast = useToast();
  const { can } = useAuth();
  const [expandida, setExpandida] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  const Icon = tipo.icono;
  const estado = useMemo(() => estadoBrigada(brigada), [brigada]);
  const miembros = brigada?.miembros ?? [];
  const lider = brigada?.lider;
  const visible = miembros.slice(0, 4);
  const ocultos = miembros.length - visible.length;
  const puedeGestionar = can(PERMISOS.BRIGADAS_GESTIONAR);

  async function eliminar() {
    if (!brigada) return;
    setEliminando(true);
    try {
      await api(`/api/brigadas/${brigada.id}`, { method: 'DELETE' });
      toast('Brigada eliminada.');
      onDelete?.(brigada.id);
      setConfirmar(false);
    } catch (err) {
      toast(err.message, { tone: 'error' });
    } finally {
      setEliminando(false);
    }
  }

  if (!brigada) {
    return (
      <article className={styles.cardEmpty}>
        <div className={styles.cardHeader}>
          <span className={`${styles.iconWrap} ${styles[tipo.tono]}`}>
            <Icon size={18} aria-hidden="true" />
          </span>
        </div>
        <div className={styles.emptyBody}>
          <h3>{tipo.etiqueta}</h3>
          <p className="muted">{tipo.descripcion}</p>
        </div>
        {puedeGestionar ? (
          <Button icon={Pencil} onClick={onCreate}>
            Crear brigada
          </Button>
        ) : (
          <p className={styles.emptyHint}>El administrador aún no ha conformado esta brigada.</p>
        )}
      </article>
    );
  }

  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={`${styles.iconWrap} ${styles[tipo.tono]}`}>
          <Icon size={18} aria-hidden="true" />
        </span>
        <div className={styles.headerMeta}>
          <h3>{tipo.etiqueta}</h3>
          <p className="muted">{tipo.descripcion}</p>
        </div>
      </div>

      <div className={styles.statusRow}>
        <span className={`${styles.statusBadge} ${styles[estado.tono]}`}>
          {estado.texto}
        </span>
        {puedeGestionar && (
          <div className={styles.cardActions}>
            <Button variant="secondary" size="sm" icon={Pencil} onClick={onEdit}>
              Editar brigada
            </Button>
            <Menu
              label="Más acciones de la brigada"
              trigger={<Ellipsis size={18} aria-hidden="true" />}
              items={[
                { label: 'Eliminar brigada', icon: Trash2, tone: 'danger', onSelect: () => setConfirmar(true) },
              ]}
            />
          </div>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <Crown size={16} aria-hidden="true" />
          <span>Líder</span>
        </div>

        {lider ? (
          <div className={styles.memberRow}>
            <Avatar nombre={lider.nombre} size={32} />
            <div className={styles.memberText}>
              <strong>{lider.nombre}</strong>
              <span className="muted">{lider.correo}</span>
            </div>
            <span className={styles.leaderTag}>Líder</span>
          </div>
        ) : (
          <div className={styles.warnRow}>
            <AlertCircle size={16} aria-hidden="true" />
            <span>Sin líder</span>
          </div>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <Users size={16} aria-hidden="true" />
          <span>{miembros.length} {miembros.length === 1 ? 'brigadista' : 'brigadistas'}</span>
        </div>

        <div className={styles.membersList}>
          {(expandida ? miembros : visible).map((miembro) => (
            <div key={miembro.id} className={`${styles.memberRow} ${!miembro.activo || miembro.rol !== 'brigadista' ? styles.memberMuted : ''}`}>
              <Avatar nombre={miembro.nombre} size={32} muted={miembro.activo === false || miembro.rol !== 'brigadista'} />
              <div className={styles.memberText}>
                <strong>{miembro.nombre}</strong>
                <span className="muted">{miembro.correo}</span>
              </div>
              {miembro.activo === false && <span className={styles.smallTag}>Inactivo</span>}
              {miembro.activo !== false && miembro.rol !== 'brigadista' && <span className={styles.smallTag}>Ya no es brigadista</span>}
            </div>
          ))}
        </div>

        {miembros.length > 4 && (
          <button type="button" className={styles.toggleMembers} onClick={() => setExpandida((actual) => !actual)} aria-expanded={expandida}>
            {expandida ? 'Ocultar miembros' : `Ver los ${miembros.length - 4} miembros`}
          </button>
        )}
      </div>

      <Dialog
        open={confirmar}
        onClose={() => !eliminando && setConfirmar(false)}
        size="sm"
        title="¿Eliminar brigada?"
        description="Se quitará esta brigada y su asignación de líderes y brigadistas. Esta acción no se puede deshacer."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmar(false)} disabled={eliminando}>
              Volver
            </Button>
            <Button variant="danger" onClick={eliminar} loading={eliminando}>
              Eliminar brigada
            </Button>
          </>
        }
      />
    </article>
  );
}
