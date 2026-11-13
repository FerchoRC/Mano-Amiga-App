// HU-08: Diálogo para agregar un nuevo punto al mapa de la sede.
import { useState } from 'react';

import Alert from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import Dialog from '../../components/Dialog.jsx';
import { SelectField, TextArea, TextField } from '../../components/Field.jsx';
import { api } from '../../lib/api.js';
import { TIPOS_ELEMENTO } from '../../lib/mapa.js';

const TIPOS_PUNTO = TIPOS_ELEMENTO.filter((t) => t.id !== 'ruta_evacuacion');

export default function AddPuntoDialog({ open, onClose, sede, coordenadas, onAdded }) {
  const [tipo, setTipo] = useState('punto_encuentro');
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const reset = () => {
    setTipo('punto_encuentro');
    setNombre('');
    setDescripcion('');
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nombre.trim()) {
      setError('Escribe el nombre del punto.');
      return;
    }

    setGuardando(true);
    setError(null);

    const lat = coordenadas?.lat ?? sede?.lat;
    const lng = coordenadas?.lng ?? sede?.lng;

    try {
      const res = await api(`/api/sedes/${sede.id}/mapa/puntos`, {
        method: 'POST',
        body: {
          tipo,
          nombre: nombre.trim(),
          descripcion: descripcion.trim(),
          lat,
          lng,
        },
      });

      onAdded?.(res.punto);
      handleClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Agregar punto al mapa"
      description="Ubica un equipo de emergencia o punto de encuentro en esta sede."
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="submit" form="agregar-punto-form" loading={guardando}>
            Guardar punto
          </Button>
        </>
      }
    >
      <form id="agregar-punto-form" onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: '16px' }}>
        {error && <Alert tone="error">{error}</Alert>}

        <SelectField
          label="Tipo de punto"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
        >
          {TIPOS_PUNTO.map((t) => (
            <option key={t.id} value={t.id}>
              {t.etiqueta}
            </option>
          ))}
        </SelectField>

        <TextField
          label="Nombre"
          placeholder="p. ej. Extintor pasillo norte, Punto 1"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          autoFocus
        />

        <TextArea
          label="Descripción o referencia"
          placeholder="Ubicación exacta, piso o instrucciones adicionales"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          optional
        />
      </form>
    </Dialog>
  );
}
