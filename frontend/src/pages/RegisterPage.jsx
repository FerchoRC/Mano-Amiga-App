import { ArrowLeft, CircleCheck, Scale } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { useAuth } from '../auth/AuthProvider.jsx';
import Alert from '../components/Alert.jsx';
import Button from '../components/Button.jsx';
import { Checkbox, PasswordField, SelectField, TextField } from '../components/Field.jsx';
import { api } from '../lib/api.js';
import { estadoNit, formatearNit, soloDigitosNit } from '../lib/nit.js';
import {
  limpiarErrores,
  validarContrasena,
  validarCorreo,
  validarNombre,
} from '../lib/validators.js';
import styles from './AuthPages.module.css';
import PasswordRules from './PasswordRules.jsx';

// Coincide con backend/src/lib/sectores.js
const SECTORES = [
  'Manufactura',
  'Bodegas y logística',
  'Construcción',
  'Educación',
  'Salud',
  'Comercio',
  'Hotelería y turismo',
  'Propiedad horizontal',
  'Servicios',
  'Otro',
];

// Campos del backend → campos del formulario.
const CAMPOS_API = {
  'empresa.nit': 'nit',
  'empresa.razonSocial': 'razonSocial',
  'empresa.sector': 'sector',
  'empresa.numEmpleados': 'numEmpleados',
  'administrador.nombre': 'nombre',
  'administrador.correo': 'correo',
  'administrador.contrasena': 'contrasena',
  aceptaTratamientoDatos: 'acepta',
};
const CAMPOS_PASO_1 = ['nit', 'razonSocial', 'sector', 'numEmpleados'];

const MENSAJE_NIT_OCUPADO =
  'Ya hay una empresa registrada con este NIT. Pide a su administrador que te invite.';

// Qué exige la Resolución 0312 de 2019 según el tamaño de la empresa.
function obligacionNormativa(numEmpleados) {
  const n = Number(numEmpleados);
  if (!Number.isInteger(n) || n < 1) return null;
  if (n <= 10) {
    return 'Con 10 trabajadores o menos, la norma exige capacitación básica en primeros auxilios, incendios y evacuación.';
  }
  return 'Con más de 10 trabajadores, la Resolución 0312 de 2019 exige plan de emergencias y brigada.';
}

// Consulta si el NIT ya está registrado mientras la persona escribe.
function useDisponibilidadNit(nit) {
  const [estado, setEstado] = useState('inactivo');
  const valido = estadoNit(nit) === 'valido';

  useEffect(() => {
    if (!valido) {
      setEstado('inactivo');
      return;
    }
    const controller = new AbortController();
    setEstado('verificando');
    const timer = setTimeout(async () => {
      try {
        const res = await api(`/api/empresas/nit-disponible?nit=${soloDigitosNit(nit)}`, {
          signal: controller.signal,
        });
        setEstado(res.disponible ? 'disponible' : 'ocupado');
      } catch (error) {
        if (error.name !== 'AbortError') setEstado('inactivo');
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [nit, valido]);

  return estado;
}

// HU-01: registro de empresa. Quien la registra queda como Administrador.
export default function RegisterPage() {
  const { startSession } = useAuth();
  const navigate = useNavigate();
  const [paso, setPaso] = useState(1);
  const [datos, setDatos] = useState({
    nit: '',
    razonSocial: '',
    sector: '',
    numEmpleados: '',
    nombre: '',
    correo: '',
    contrasena: '',
    acepta: false,
  });
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const formRef = useRef(null);

  const disponibilidad = useDisponibilidadNit(datos.nit);

  const set = (campo) => (event) => {
    const valor = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setDatos((d) => ({ ...d, [campo]: campo === 'nit' ? formatearNit(valor) : valor }));
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: null }));
  };

  const enfocarPrimerError = (campos) => {
    requestAnimationFrame(() => {
      formRef.current?.querySelector(`[name="${campos[0]}"]`)?.focus();
    });
  };

  function validarPaso1() {
    const estado = estadoNit(datos.nit);
    const n = Number(datos.numEmpleados);
    return limpiarErrores({
      nit:
        estado === 'incompleto'
          ? 'Escribe los 9 dígitos del NIT y el dígito de verificación.'
          : estado === 'invalido'
            ? 'El dígito de verificación no coincide. Revisa el NIT.'
            : disponibilidad === 'ocupado'
              ? MENSAJE_NIT_OCUPADO
              : null,
      razonSocial: datos.razonSocial.trim().length < 2 ? 'Escribe la razón social.' : null,
      sector: datos.sector ? null : 'Elige el sector de tu empresa.',
      numEmpleados:
        !Number.isInteger(n) || n < 1 ? 'Escribe cuántas personas trabajan en la empresa.' : null,
    });
  }

  function validarPaso2() {
    return limpiarErrores({
      nombre: validarNombre(datos.nombre),
      correo: validarCorreo(datos.correo),
      contrasena: validarContrasena(datos.contrasena),
      acepta: datos.acepta ? null : 'Debes aceptar la política de tratamiento de datos.',
    });
  }

  function continuar(event) {
    event.preventDefault();
    const nuevos = validarPaso1();
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return enfocarPrimerError(Object.keys(nuevos));
    setPaso(2);
    enfocarPrimerError(['nombre']);
  }

  async function registrar(event) {
    event.preventDefault();
    const nuevos = validarPaso2();
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return enfocarPrimerError(Object.keys(nuevos));

    setEnviando(true);
    setError(null);
    try {
      const data = await api('/api/empresas', {
        method: 'POST',
        body: {
          empresa: {
            nit: datos.nit,
            razonSocial: datos.razonSocial,
            sector: datos.sector,
            numEmpleados: Number(datos.numEmpleados),
          },
          administrador: { nombre: datos.nombre, correo: datos.correo, contrasena: datos.contrasena },
          aceptaTratamientoDatos: datos.acepta,
        },
      });
      startSession(data);
      navigate('/inicio', { replace: true, state: { bienvenida: 'registro' } });
    } catch (err) {
      const campos = Object.fromEntries(
        Object.entries(err.campos).map(([campo, mensaje]) => [CAMPOS_API[campo] ?? campo, mensaje])
      );
      setErrores(campos);
      const delPaso1 = Object.keys(campos).filter((c) => CAMPOS_PASO_1.includes(c));
      if (delPaso1.length) {
        setPaso(1);
        enfocarPrimerError(delPaso1);
      } else if (Object.keys(campos).length) {
        enfocarPrimerError(Object.keys(campos));
      } else {
        setError(err.message);
      }
    } finally {
      setEnviando(false);
    }
  }

  const nitEstado = estadoNit(datos.nit);
  const obligacion = obligacionNormativa(datos.numEmpleados);

  return (
    <>
      <header className={styles.header} style={{ marginBottom: 24 }}>
        <h1>Registra tu empresa</h1>
        <p className={styles.lead}>
          En dos pasos tendrás tu espacio para gestionar sedes, brigadas y emergencias.
        </p>
      </header>

      <ol className={styles.steps}>
        {['Tu empresa', 'Tu cuenta'].map((nombre, i) => {
          const numero = i + 1;
          const clase =
            numero < paso ? styles.stepDone : numero === paso ? styles.stepCurrent : '';
          return (
            <li
              key={nombre}
              className={`${styles.step} ${clase}`}
              aria-current={numero === paso ? 'step' : undefined}
            >
              <span>
                <span className={styles.stepNumber}>{numero}</span>
                {nombre}
              </span>
            </li>
          );
        })}
      </ol>

      {paso === 1 ? (
        <form ref={formRef} className={styles.form} onSubmit={continuar} noValidate>
          <TextField
            name="nit"
            label="NIT"
            inputMode="numeric"
            autoComplete="off"
            placeholder="900.123.456-8"
            value={datos.nit}
            onChange={set('nit')}
            error={errores.nit ?? (disponibilidad === 'ocupado' ? MENSAJE_NIT_OCUPADO : null)}
            autoFocus
            end={
              disponibilidad === 'verificando' ? (
                <span className={styles.adornment}>
                  <span className="spinner" aria-label="Verificando NIT" />
                </span>
              ) : disponibilidad === 'disponible' ? (
                <span className={`${styles.adornment} ${styles.adornmentOk}`}>
                  <CircleCheck size={18} aria-hidden="true" />
                </span>
              ) : null
            }
            hint={
              disponibilidad === 'disponible' ? (
                <span className={styles.ok}>NIT válido y disponible</span>
              ) : nitEstado === 'invalido' ? (
                'El dígito de verificación no coincide. Revisa el NIT.'
              ) : (
                'Los 9 dígitos y el dígito de verificación (DV), tal como aparece en el RUT.'
              )
            }
          />
          <TextField
            name="razonSocial"
            label="Razón social"
            autoComplete="organization"
            placeholder="Mi Empresa S.A.S."
            value={datos.razonSocial}
            onChange={set('razonSocial')}
            error={errores.razonSocial}
          />
          <div className={styles.row}>
            <SelectField
              name="sector"
              label="Sector"
              value={datos.sector}
              onChange={set('sector')}
              error={errores.sector}
            >
              <option value="" disabled>
                Elige uno
              </option>
              {SECTORES.map((sector) => (
                <option key={sector}>{sector}</option>
              ))}
            </SelectField>
            <TextField
              name="numEmpleados"
              label="Número de empleados"
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              placeholder="0"
              value={datos.numEmpleados}
              onChange={set('numEmpleados')}
              error={errores.numEmpleados}
            />
          </div>

          {obligacion && !errores.numEmpleados && (
            <div className={`${styles.norma} muted`} style={{ fontSize: 14, marginTop: -4 }}>
              <Scale size={16} aria-hidden="true" />
              <span>{obligacion}</span>
            </div>
          )}

          <div className={styles.actions}>
            <Button type="submit" block>
              Continuar
            </Button>
          </div>
        </form>
      ) : (
        <form ref={formRef} className={styles.form} onSubmit={registrar} noValidate>
          {error && <Alert tone="error">{error}</Alert>}
          <Alert tone="info">
            Quedarás como <strong>Administrador</strong> de {datos.razonSocial.trim()} y después
            podrás invitar a tu equipo
          </Alert>

          <TextField
            name="nombre"
            label="Tu nombre completo"
            autoComplete="name"
            value={datos.nombre}
            onChange={set('nombre')}
            error={errores.nombre}
          />
          <TextField
            name="correo"
            label="Correo de trabajo"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            placeholder="nombre@empresa.co"
            value={datos.correo}
            onChange={set('correo')}
            error={errores.correo}
          />
          <PasswordField
            name="contrasena"
            label="Contraseña"
            autoComplete="new-password"
            value={datos.contrasena}
            onChange={set('contrasena')}
            error={errores.contrasena}
            hint={<PasswordRules value={datos.contrasena} />}
          />
          <Checkbox
            name="acepta"
            checked={datos.acepta}
            onChange={set('acepta')}
            error={errores.acepta}
            label="Autorizo el tratamiento de los datos de mi empresa y sus trabajadores conforme a la Ley 1581 de 2012."
          />

          <div className={styles.actions}>
            <Button variant="secondary" icon={ArrowLeft} onClick={() => setPaso(1)} aria-label="Volver al paso 1" />
            <Button type="submit" loading={enviando}>
              Crear cuenta
            </Button>
          </div>
        </form>
      )}

      <p className={styles.switch}>
        ¿Ya tienes una cuenta? <Link to="/ingresar">Inicia sesión</Link>
      </p>
    </>
  );
}
