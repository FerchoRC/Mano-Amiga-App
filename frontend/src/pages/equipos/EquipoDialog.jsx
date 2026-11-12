// HU-11: Diálogo para registrar o editar un equipo de emergencia.
import { useEffect, useState } from 'react';

import Alert from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import Dialog from '../../components/Dialog.jsx';
import { SelectField, TextArea, TextField } from '../../components/Field.jsx';
import { api } from '../../lib/api.js';
import { ESTADOS_EQUIPO, TIPOS_EQUIPO } from '../../lib/equipos.js';

export default function EquipoDialog({ open, onClose, sedeId, equipo = null, onSaved }) {
  const esEdicion = Boolean(equipo);

  const [tipo, setTipo] = useState('extintor');
  const [nombre, setNombre] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [estado, setEstado] = useState('operativo');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (equipo) {
      setTipo(equipo.tipo);
      setNombre(equipo.nombre);
      setUbicacion(equipo.ubicacion);
      setFechaVencimiento(equipo.fechaVencimiento ?? '');
      setEstado(equipo.estado);
      setNotas(equipo.notas ?? '');
    } else {
      setTipo('extintor');
      setNombre('');
      setUbicacion('');
      setFechaVencimiento('');
      setEstado('operativo');
      setNotas('');
    }
    setError(null);
  }, [equipo, open]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nombre.trim()) {
      setError('Escribe el nombre o identificador del equipo.');
      return;
    }
    if (!ubicacion.trim()) {
      setError('Indica la ubicación del equipo en la sede.');
      return;
    }

    setGuardando(true);
    setError(null);

    const payload = {
      tipo,
      nombre: nombre.trim(),
      ubicacion: ubicacion.trim(),
      fechaVencimiento: fechaVencimiento || null,
      estado,
      notas: notas.trim(),
    };

    try {
      const res = esEdicion
        ? await api(`/api/equipos/${equipo.id}`, { method: 'PUT', body: payload })
        : await api(`/api/sedes/${sedeId}/equipos`, { method: 'POST', body: payload });

      onSaved?.(res.equipo);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={esEdicion ? 'Editar equipo' : 'Registrar equipo'}
      description="Registra sus características y fecha de vencimiento o recarga."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="submit" form="equipo-form" loading={guardando}>
            {esEdicion ? 'Guardar cambios' : 'Registrar equipo'}
          </Button>
        </>
      }
    >
      <form id="equipo-form" onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: '16px' }}>
        {error && <Alert tone="error">{error}</Alert>}

        <SelectField
          label="Tipo de equipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
        >
          {TIPOS_EQUIPO.map((t) => (
            <option key={t.id} value={t.id}>
              {t.etiqueta}
            </option>
          ))}
        </SelectField>

        <TextField
          label="Nombre o código"
          placeholder="p. ej. Extintor multipropósito #04"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          autoFocus
        />

        <TextField
          label="Ubicación física"
          placeholder="p. ej. Pasillo central, junto a cafetín"
          value={ubicacion}
          onChange={(e) => setUbicacion(e.target.value)}
        />

        <TextField
          label="Fecha de vencimiento o próxima recarga"
          type="date"
          value={fechaVencimiento}
          onChange={(e) => setFechaVencimiento(e.target.value)}
          hint="Requerido para el cálculo preventivo de alertas y auditorías."
          optional
        />

        <SelectField
          label="Estado actual"
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
        >
          {ESTADOS_EQUIPO.map((est) => (
            <option key={est.id} value={est.id}>
              {est.etiqueta}
            </option>
          ))}
        </SelectField>

        <TextArea
          label="Notas o historial de mantenimiento"
          placeholder="Capacidad en libras, proveedor o fecha de última inspección"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={3}
          optional
        />
      </form>
    </Dialog>
  );
}
