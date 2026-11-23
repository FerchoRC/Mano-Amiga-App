import { Link } from 'react-router';

import Logo from '../../components/Logo.jsx';
import styles from './Legal.module.css';

// Ley 1581 de 2012 y Decreto 1377 de 2013. Si cambia este texto, cambiar también
// VERSION_POLITICA en backend/src/services/consentimiento.js: así todas las personas
// la aceptan de nuevo. El correo de contacto debe confirmarse antes de salir a producción.
export const VERSION_POLITICA = '2026-11-23';
const CORREO_CONTACTO = 'privacidad@manoamiga.co';

export default function PoliticaDatosPage() {
  return (
    <div className={styles.pagina}>
      <header className={styles.cabecera}>
        <Link to="/ingresar" aria-label="ManoAmiga">
          <Logo height={30} />
        </Link>
      </header>

      <article className={styles.texto}>
        <p className="eyebrow">Versión del {VERSION_POLITICA}</p>
        <h1>Política de tratamiento de datos personales</h1>

        <p>
          ManoAmiga es una plataforma para que las empresas preparen y atiendan emergencias. Esta
          política explica qué datos personales se recogen, para qué se usan y cómo puedes ejercer
          tus derechos, según la Ley 1581 de 2012 y el Decreto 1377 de 2013.
        </p>

        <h2>Quién es responsable</h2>
        <p>
          La <strong>empresa</strong> que te registró o te invitó es la responsable de tus datos: decide
          para qué se usan dentro de su sistema de seguridad y salud en el trabajo. ManoAmiga actúa
          como <strong>encargado</strong>: guarda y procesa los datos por cuenta de la empresa y solo
          para las finalidades de esta política.
        </p>

        <h2>Qué datos se recogen</h2>
        <ul>
          <li>Tu nombre, correo, rol y la sede donde trabajas.</li>
          <li>Tu estado durante una emergencia («Estoy a salvo» o «Necesito ayuda») y el mensaje que escribas.</li>
          <li>Las brigadas a las que perteneces.</li>
          <li>Datos técnicos de tus sesiones: fecha de ingreso y de última actividad.</li>
        </ul>
        <p>
          ManoAmiga no pide datos sensibles como información de salud. No escribas datos médicos en
          los mensajes de emergencia más allá de lo necesario para recibir ayuda.
        </p>

        <h2>Para qué se usan</h2>
        <ul>
          <li>Darte acceso a la plataforma según tu rol.</li>
          <li>Avisarte de una emergencia en tu sede y saber si estás a salvo.</li>
          <li>Organizar las brigadas y el plan de emergencias de la empresa.</li>
          <li>Generar los reportes que la empresa presenta en auditorías del SG-SST.</li>
        </ul>
        <p>Los datos no se venden ni se usan para publicidad.</p>

        <h2>Tus derechos</h2>
        <p>Como titular puedes, en cualquier momento:</p>
        <ul>
          <li>Conocer, actualizar y rectificar tus datos.</li>
          <li>Pedir prueba de la autorización que diste.</li>
          <li>Saber cómo se han usado tus datos.</li>
          <li>Revocar la autorización o pedir que se borren, cuando no exista un deber legal de conservarlos.</li>
          <li>Presentar quejas ante la Superintendencia de Industria y Comercio.</li>
        </ul>

        <h2>Cómo ejercerlos</h2>
        <p>
          Escribe al administrador de tu empresa en ManoAmiga o a <strong>{CORREO_CONTACTO}</strong>.
          Las consultas se responden en un máximo de 10 días hábiles y los reclamos en 15, como lo
          establece la ley.
        </p>

        <h2>Seguridad</h2>
        <p>
          Las contraseñas se guardan cifradas, las sesiones se cierran por inactividad y cada empresa
          solo puede ver sus propios datos.
        </p>

        <p className={styles.volver}>
          <Link to="/ingresar">Volver a ManoAmiga</Link>
        </p>
      </article>
    </div>
  );
}
