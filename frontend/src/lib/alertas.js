// HU-09: Definición de tipos de emergencias para alertas.
import {
  Activity,
  Flame,
  HeartPulse,
  LogOut,
  ShieldAlert,
  TriangleAlert,
  Waves,
} from 'lucide-react';

export const TIPOS_EMERGENCIA = [
  {
    id: 'incendio',
    etiqueta: 'Incendio o conato',
    icono: Flame,
    color: 'red',
    instruccionSugerida: 'Evacúa de inmediato por la ruta señalizada hacia el punto de encuentro. No uses ascensores.',
  },
  {
    id: 'sismo',
    etiqueta: 'Sismo o terremoto',
    icono: Activity,
    color: 'orange',
    instruccionSugerida: 'Protégete bajo una estructura resistente. Al terminar el movimiento, evacúa calmadamente.',
  },
  {
    id: 'evacuacion',
    etiqueta: 'Evacuación general',
    icono: LogOut,
    color: 'red',
    instruccionSugerida: 'Desocupa las instalaciones siguiendo las instrucciones de los brigadistas hacia el punto de encuentro.',
  },
  {
    id: 'inundacion',
    etiqueta: 'Inundación o fuga',
    icono: Waves,
    color: 'blue',
    instruccionSugerida: 'Corta suministros si es seguro y dirígete a las zonas altas o punto de encuentro seguro.',
  },
  {
    id: 'medica',
    etiqueta: 'Emergencia médica',
    icono: HeartPulse,
    color: 'red',
    instruccionSugerida: 'Mantén el área despejada y permite el paso a los brigadistas de primeros auxilios.',
  },
  {
    id: 'amenaza',
    etiqueta: 'Amenaza de seguridad',
    icono: ShieldAlert,
    color: 'orange',
    instruccionSugerida: 'Permanece en un lugar seguro bajo llave o sigue las instrucciones del equipo de seguridad.',
  },
  {
    id: 'otra',
    etiqueta: 'Otra emergencia',
    icono: TriangleAlert,
    color: 'orange',
    instruccionSugerida: 'Sigue atentamente las indicaciones de los brigadistas de tu sede.',
  },
];

export function tipoEmergencia(id) {
  return TIPOS_EMERGENCIA.find((t) => t.id === id) ?? TIPOS_EMERGENCIA[TIPOS_EMERGENCIA.length - 1];
}
