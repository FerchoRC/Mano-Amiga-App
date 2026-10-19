import { ArrowLeft, CircleAlert, MapPin, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import Alert from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import { TextField } from '../../components/Field.jsx';
import LocationPicker from '../../components/map/LocationPicker.jsx';
import { useToast } from '../../components/Toast.jsx';
import { api } from '../../lib/api.js';
import { limpiarErrores } from '../../lib/validators.js';
import styles from './Sedes.module.css';

const CIUDADES = [
  'Medellín',
  'Bello',
  'Itagüí',
  'Envigado',
  'Sabaneta',
  'La Estrella',
  'Caldas',
  'Copacabana',
  'Girardota',
  'Barbosa',
  'Rionegro',
  'Bogotá',
  'Cali',
];

const VACIA = { nombre: '', direccion: '', ciudad: '', ubicacion: null };

// HU-04: registrar o editar una sede con su ubicación marcada en el mapa.
export default function SedeFormPage() {
  const { id } = useParams();
  const editando = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();

  const [datos, setDatos] = useState(editando ? null : VACIA);
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const [busqueda, setBusqueda] = useState('');
  const busquedaEditada = useRef(false);
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState(null);
  const [errorBusqueda, setErrorBusqueda] = useState(null);
  const [enfoque, setEnfoque] = useState(0);

  useEffect(() => {
    if (!editando) return;
    const controller = new AbortController();
    api(`/api/sedes/${id}`, { signal: controller.signal })
      .then(({ sede }) => {
        setDatos({
          nombre: sede.nombre,
          direccion: sede.direccion,
          ciudad: sede.ciudad,
          ubicacion: { lat: sede.lat, lng: sede.lng },
        });
        busquedaEditada.current = true;
      })
      .catch((err) => err.name !== 'AbortError' && setError(err.message));
    return () => controller.abort();
  }, [editando, id]);

  // La búsqueda se arma sola con la dirección y la ciudad, hasta que la persona la edite.
  useEffect(() => {
    if (!datos || busquedaEditada.current) return;
    setBusqueda([datos.direccion, datos.ciudad].filter((v) => v.trim()).join(', '));
  }, [datos]);

  const set = (campo) => (event) => {
    const valor = event.target.value;
    setDatos((d) => ({ ...d, [campo]: valor }));
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: null }));
  };

  const setUbicacion = (ubicacion) => {
    setDatos((d) => ({ ...d, ubicacion }));
    if (errores.ubicacion) setErrores((e) => ({ ...e, ubicacion: null }));
  };

  async function buscar() {
    // La dirección colombiana con placa ("# 41-20") confunde al buscador; se busca la vía.
    const texto = busqueda.replace(/#.*?(,|$)/, '$1').trim();
    if (texto.length < 3) return;
    setBuscando(true);
    setErrorBusqueda(null);
    try {
      const res = await api(`/api/sedes/geocodificar?q=${encodeURIComponent(texto)}`);
      setResultados(res.resultados);
      if (res.resultados.length === 1) elegir(res.resultados[0]);
    } catch (err) {
      setErrorBusqueda(err.message);
      setResultados(null);
    } finally {
      setBuscando(false);
    }
  }

  function elegir(resultado) {
    setUbicacion({ lat: resultado.lat, lng: resultado.lng });
    setEnfoque((n) => n + 1);
    setResultados(null);
  }

  async function onSubmit(event) {
    event.preventDefault();
    const nuevos = limpiarErrores({
      nombre: datos.nombre.trim().length < 2 ? 'Escribe el nombre de la sede.' : null,
      direccion: datos.direccion.trim().length < 5 ? 'Escribe la dirección de la sede.' : null,
      ciudad: datos.ciudad.trim().length < 2 ? 'Escribe la ciudad.' : null,
      ubicacion: datos.ubicacion ? null : 'Marca la ubicación de la sede en el mapa.',
    });
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return;

    setGuardando(true);
    setError(null);
    try {
      const { nombre, direccion, ciudad, ubicacion } = datos;
      const { sede } = await api(editando ? `/api/sedes/${id}` : '/api/sedes', {
        method: editando ? 'PUT' : 'POST',
        body: { nombre, direccion, ciudad, ...ubicacion },
      });
      toast(editando ? 'Los datos de la sede quedaron actualizados.' : `${sede.nombre} quedó registrada.`);
      navigate(`/sedes/${sede.id}`, { replace: true });
    } catch (err) {
      const { lat, lng, ...resto } = err.campos;
      const campos = lat || lng ? { ...resto, ubicacion: lat ?? lng } : resto;
      setErrores(campos);
      if (!Object.keys(campos).length) setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  if (!datos) {
    return error ? (
      <Alert tone="error">{error}</Alert>
    ) : (
      <div className={styles.loading} aria-busy="true">
        <span className="spinner" />
      </div>
    );
  }

  const volver = editando ? `/sedes/${id}` : '/sedes';

  return (
    <form className={styles.page} onSubmit={onSubmit} noValidate>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <Link to={volver} className={styles.back}>
            <ArrowLeft size={16} aria-hidden="true" />
            {editando ? datos.nombre : 'Sedes'}
          </Link>
          <h1>{editando ? 'Editar sede' : 'Registrar sede'}</h1>
          <p className="muted">
            La ubicación en el mapa es la que verán tus empleados en el mapa de evacuación.
          </p>
        </div>
      </header>

      {error && <Alert tone="error">{error}</Alert>}

      <div className={styles.formLayout}>
        <div className={styles.formFields}>
          <TextField
            label="Nombre de la sede"
            placeholder="Planta principal, Bodega norte…"
            value={datos.nombre}
            onChange={set('nombre')}
            error={errores.nombre}
            autoFocus={!editando}
          />
          <TextField
            label="Dirección"
            placeholder="Calle 50 # 41-20"
            autoComplete="street-address"
            value={datos.direccion}
            onChange={set('direccion')}
            error={errores.direccion}
          />
          <TextField
            label="Ciudad"
            list="ciudades"
            autoComplete="address-level2"
            value={datos.ciudad}
            onChange={set('ciudad')}
            error={errores.ciudad}
          />
          <datalist id="ciudades">
            {CIUDADES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>

          <div>
            <div className={styles.searchRow}>
              <TextField
                label="Buscar en el mapa"
                placeholder="Barrio, vía o lugar cercano"
                value={busqueda}
                onChange={(e) => {
                  busquedaEditada.current = true;
                  setBusqueda(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    buscar();
                  }
                }}
                hint="Luego ajusta el punto exacto en el mapa."
              />
              <Button
                variant="secondary"
                icon={Search}
                onClick={buscar}
                loading={buscando}
                aria-label="Buscar dirección"
                style={{ marginTop: 26 }}
              />
            </div>
            {errorBusqueda && (
              <div style={{ marginTop: 10 }}>
                <Alert tone="warning">{errorBusqueda}</Alert>
              </div>
            )}
            {resultados?.length === 0 && (
              <div style={{ marginTop: 10 }}>
                <Alert tone="info">
                  No encontramos ese lugar. Prueba con el barrio o una vía principal, o marca la sede
                  directamente en el mapa.
                </Alert>
              </div>
            )}
            {resultados?.length > 1 && (
              <ul className={styles.results} style={{ marginTop: 10 }} aria-label="Resultados de la búsqueda">
                {resultados.map((r) => (
                  <li key={`${r.lat},${r.lng}`}>
                    <button type="button" className={styles.result} onClick={() => elegir(r)}>
                      <span className={styles.resultLabel}>{r.etiqueta}</span>
                      <span className={styles.resultDetail}>{r.detalle}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className={styles.pickerWrap}>
          <div className={`${styles.picker} ${errores.ubicacion ? styles.pickerInvalid : ''}`}>
            <LocationPicker value={datos.ubicacion} onChange={setUbicacion} enfoque={enfoque} />
          </div>
          {errores.ubicacion ? (
            <p className={styles.pickerHint} style={{ color: 'var(--red-700)' }} role="alert">
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <CircleAlert size={15} aria-hidden="true" />
                {errores.ubicacion}
              </span>
            </p>
          ) : (
            <p className={styles.pickerHint}>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <MapPin size={15} aria-hidden="true" />
                Haz clic en el mapa o arrastra el marcador hasta la entrada de la sede.
              </span>
              {datos.ubicacion && (
                <span className={styles.coords}>
                  {datos.ubicacion.lat.toFixed(5)}, {datos.ubicacion.lng.toFixed(5)}
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      <div className={styles.formActions}>
        <Button variant="secondary" to={volver}>
          Cancelar
        </Button>
        <Button type="submit" loading={guardando}>
          {editando ? 'Guardar cambios' : 'Registrar sede'}
        </Button>
      </div>
    </form>
  );
}
