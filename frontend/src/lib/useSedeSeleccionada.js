import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useAuth } from '../auth/AuthProvider.jsx';
import { api } from './api.js';

export default function useSedeSeleccionada() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { session } = useAuth();
  const miSedeId = session?.usuario.sede?.id;
  const [sedes, setSedes] = useState([]);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const { sedes: listado } = await api('/api/sedes');
      setSedes(listado ?? []);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const sedeIdConsulta = searchParams.get('sede');
  const sede = useMemo(() => {
    if (!sedes.length) return null;
    if (sedeIdConsulta && sedes.some((item) => item.id === sedeIdConsulta)) {
      return sedes.find((item) => item.id === sedeIdConsulta);
    }
    // Por defecto, la sede donde trabaja la persona.
    return sedes.find((item) => item.id === miSedeId) ?? sedes[0];
  }, [sedes, sedeIdConsulta, miSedeId]);

  const setSedeId = (id) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('sede', id);
    else next.delete('sede');
    setSearchParams(next, { replace: true });
  };

  return { sedes, sede, setSedeId, error, recargar: cargar };
}
