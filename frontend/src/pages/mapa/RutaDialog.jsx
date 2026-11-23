// HU-07: nombre y datos de la ruta de evacuación recién trazada.
import { useState } from 'react';

import Alert from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import Dialog from '../../components/Dialog.jsx';
import { TextArea, TextField } from '../../components/Field.jsx';
import { api } from '../../lib/api.js';

export default function RutaDialog({ open, sede, trazado, onClose, onCreada }) {
  const [datos, setDatos] = useState({ nombre: '', origen: '', destino: '', descripcion: '' });
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const set = (campo) => (e) => {
    setDatos((d) => ({ ...d, [campo]: e.target.value }));
    if (errores[campo]) setErrores((x) => ({ ...x, [campo]: null }));
  };

  async function onSubmit(e) {
    e.preventDefault();
    if (datos.nombre.trim().length < 2) {
      setErrores({ nombre: 'Escribe el nombre de la ruta.' });
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const res = await api(`/api/sedes/${sede.id}/mapa/rutas`, {
        method: 'POST',
        body: {
          nombre: datos.nombre.trim(),
          origen: datos.origen.trim(),
          destino: datos.destino.trim(),
          descripcion: datos.descripcion.trim(),
          trazado,
        },
      });
      onCreada(res.ruta);
    } catch (err) {
      setErrores(err.campos ?? {});
      if (!Object.keys(err.campos ?? {}).length || err.campos.trazado) setError(err.campos?.trazado ?? err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => !guardando && onClose()}
      title="Guardar ruta de evacuación"
      description={`Ruta de ${trazado.length} puntos en ${sede?.nombre}. Las flechas seguirán el orden en que la trazaste.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={guardando}>
            Seguir trazando
          </Button>
          <Button type="submit" form="ruta-form" loading={guardando}>
            Guardar ruta
          </Button>
        </>
      }
    >
      <form id="ruta-form" onSubmit={onSubmit} noValidate style={{ display: 'grid', gap: 16 }}>
        {error && <Alert tone="error">{error}</Alert>}
        <TextField
          label="Nombre de la ruta"
          placeholder="Ej. Ruta principal hacia el parqueadero"
          value={datos.nombre}
          onChange={set('nombre')}
          error={errores.nombre}
          maxLength={120}
          autoFocus
        />
        <TextField
          label="Desde"
          placeholder="Ej. Área de producción"
          value={datos.origen}
          onChange={set('origen')}
          error={errores.origen}
          maxLength={120}
        />
        <TextField
          label="Hasta"
          placeholder="Ej. Punto de encuentro principal"
          value={datos.destino}
          onChange={set('destino')}
          error={errores.destino}
          maxLength={120}
        />
        <TextArea
          label="Indicaciones (opcional)"
          rows={3}
          value={datos.descripcion}
          onChange={set('descripcion')}
          error={errores.descripcion}
          maxLength={300}
        />
      </form>
    </Dialog>
  );
}
