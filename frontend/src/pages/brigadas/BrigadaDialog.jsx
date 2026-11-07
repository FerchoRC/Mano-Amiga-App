import { CircleAlert, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import Alert from '../../components/Alert.jsx';
import Avatar from '../../components/Avatar.jsx';
import Button from '../../components/Button.jsx';
import Dialog from '../../components/Dialog.jsx';
import { TextField } from '../../components/Field.jsx';
import { useToast } from '../../components/Toast.jsx';
import { api } from '../../lib/api.js';
import { validarBrigada, tipoBrigada } from '../../lib/brigadas.js';
import styles from './Brigadas.module.css';

const normalizar = (texto = '') =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export default function BrigadaDialog({ open, onClose, sede, tipo, brigada, brigadas = [], onSave }) {
  const toast = useToast();
  const [candidatos, setCandidatos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [miembrosIds, setMiembrosIds] = useState([]);
  const [liderId, setLiderId] = useState('');
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const infoTipo = tipoBrigada(tipo) ?? tipoBrigada(brigada?.tipo) ?? null;

  useEffect(() => {
    if (!open) return;
    const base = (brigada?.miembros ?? []).map((miembro) => ({ ...miembro, activo: miembro.activo ?? true }));
    setMiembrosIds(base.map((miembro) => miembro.id));
    setLiderId(brigada?.lider?.id ?? base[0]?.id ?? '');
    setErrores({});
    setError(null);

    async function cargar() {
      try {
        const { usuarios = [] } = await api('/api/usuarios');
        const activos = usuarios.filter((usuario) => usuario.rol === 'brigadista' && usuario.estado === 'activo');
        const actuales = base.filter((usuario) => usuario.rol !== 'brigadista' || usuario.estado !== 'activo');
        setCandidatos([...activos, ...actuales]);
      } catch (err) {
        setError(err.message);
      }
    }

    cargar();
  }, [open, brigada]);

  const candidatosFiltrados = useMemo(() => {
    const termino = normalizar(busqueda);
    return candidatos.filter((usuario) => {
      const texto = `${usuario.nombre} ${usuario.correo}`;
      return !termino || normalizar(texto).includes(termino);
    });
  }, [busqueda, candidatos]);

  const toggleMiembro = (usuarioId) => {
    setMiembrosIds((actual) => {
      const existe = actual.includes(usuarioId);
      const siguiente = existe ? actual.filter((id) => id !== usuarioId) : [...actual, usuarioId];
      if (liderId === usuarioId && !siguiente.includes(usuarioId)) setLiderId('');
      return siguiente;
    });
    setErrores((actual) => ({ ...actual, miembrosIds: undefined, liderId: undefined }));
  };

  const seleccionados = candidatos.filter((usuario) => miembrosIds.includes(usuario.id));
  const otrasBrigadas = (usuario) =>
    brigadas.filter(
      (item) =>
        item.id !== brigada?.id &&
        (item.lider?.id === usuario.id || (item.miembros ?? []).some((miembro) => miembro.id === usuario.id))
    );

  async function onSubmit(event) {
    event.preventDefault();
    const validacion = validarBrigada({ miembrosIds, liderId });
    setErrores(validacion);
    if (Object.keys(validacion).length) return;

    setEnviando(true);
    setError(null);
    try {
      const payload = { liderId, miembrosIds };
      const response = brigada
        ? await api(`/api/brigadas/${brigada.id}`, { method: 'PUT', body: payload })
        : await api('/api/brigadas', { method: 'POST', body: { ...payload, sedeId: sede.id, tipo: infoTipo.id } });
      const brigadaGuardada = response?.brigada ?? response;
      onSave(brigadaGuardada);
      toast(brigada ? `Brigada de ${infoTipo.etiqueta.toLowerCase()} actualizada.` : `Brigada de ${infoTipo.etiqueta.toLowerCase()} creada.`);
      onClose();
    } catch (err) {
      setErrores(err.campos ?? {});
      setError(Object.keys(err.campos ?? {}).length ? null : err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={infoTipo ? `Brigada de ${infoTipo.etiqueta}` : 'Brigada'}
      description={sede ? `Elige a los brigadistas de ${sede.nombre} y quién la lidera.` : 'Elige a los brigadistas y quién la lidera.'}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="brigada-form" loading={enviando}>
            {brigada ? 'Guardar cambios' : 'Crear brigada'}
          </Button>
        </>
      }
    >
      <form id="brigada-form" className={styles.dialogForm} onSubmit={onSubmit} noValidate>
        {error && <Alert tone="error">{error}</Alert>}

        <TextField
          label="Buscar brigadista"
          type="search"
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          placeholder="Nombre o correo"
          autoComplete="off"
        />

        <div className={styles.selectionHeader}>
          <p>{seleccionados.length} seleccionados</p>
          {liderId && (
            <span className={styles.liderPill}>Líder: {candidatos.find((item) => item.id === liderId)?.nombre ?? 'sin nombre'}</span>
          )}
        </div>

        {errores.liderId && (
          <p className={styles.inlineError} role="alert">
            <CircleAlert size={15} aria-hidden="true" />
            <span>{errores.liderId}</span>
          </p>
        )}

        {errores.miembrosIds && (
          <p className={styles.inlineError} role="alert">
            <CircleAlert size={15} aria-hidden="true" />
            <span>{errores.miembrosIds}</span>
          </p>
        )}

        <div className={styles.candidateList}>
          {candidatosFiltrados.length ? (
            candidatosFiltrados.map((usuario) => {
              const checked = miembrosIds.includes(usuario.id);
              const otras = otrasBrigadas(usuario);
              return (
                <label key={usuario.id} className={`${styles.candidate} ${checked ? styles.checked : ''}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggleMiembro(usuario.id)} />
                  <div className={styles.candidateBody}>
                    <Avatar nombre={usuario.nombre} size={34} muted={usuario.estado !== 'activo'} />
                    <div className={styles.candidateText}>
                      <strong>{usuario.nombre}</strong>
                      <span>{usuario.correo}</span>
                      {usuario.estado !== 'activo' && <small className={styles.metaBadge}>Inactivo</small>}
                      {otras.length > 0 && (
                        <small className={styles.metaMuted}>
                          También en:{' '}
                          {otras
                            .map((item) => `${tipoBrigada(item.tipo)?.etiqueta ?? 'Brigada'} (${item.sede?.nombre ?? sede.nombre})`)
                            .join(', ')}
                        </small>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={styles.leaderToggle}
                    onClick={() => setLiderId(usuario.id)}
                    disabled={!checked}
                    aria-pressed={liderId === usuario.id}
                  >
                    Liderar
                  </button>
                </label>
              );
            })
          ) : (
            <div className={styles.emptyCandidate}>
              <p>Aún no tienes brigadistas</p>
              <a href="/equipo">Invita personas con rol brigadista desde Equipo</a>
            </div>
          )}
        </div>

        {liderId && !miembrosIds.includes(liderId) && (
          <p className={styles.inlineHint}>Elige un nuevo líder.</p>
        )}
      </form>
    </Dialog>
  );
}
