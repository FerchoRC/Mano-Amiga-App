# Cómo trabajamos en ManoAmiga

## Tablero (Trello)

- Cada tarjeta tiene **responsable** y etiqueta **Backend** o **Frontend** (o las dos).
- Las listas se usan en orden: Product Backlog → En progreso → **En revisión** → Terminado.
- Una tarjeta pasa a **En revisión** cuando su PR está abierto, y a **Terminado** solo cuando
  cumple la definición de terminado.

## Definición de terminado

Una historia está terminada cuando:

1. Está en `main` por medio de un PR que revisó otra persona del equipo.
2. Cumple todos sus criterios de aceptación y se probó en el navegador (escritorio y celular).
3. Tiene pruebas automáticas de sus criterios y la integración continua (GitHub Actions) pasa.
4. La documentación (README o `backend/README.md`) refleja lo nuevo.

## Ramas

- Una rama corta **por historia**, creada desde `main`: `hu-14-rutas`, `fix-contraste-textos`.
- Antes de abrir el PR, actualiza tu rama con `main` (`git pull origin main`).
- No se sube directo a `main` ni a ramas de otra persona.

## Mensajes de commit

Empiezan con la historia o el tipo de cambio y dicen qué cambia, en presente:

```
HU-14: traza rutas de evacuación en el mapa
fix: responde 413 cuando el cuerpo es demasiado grande
docs: explica cómo desplegar en Vercel
```

## Antes de subir

```bash
cd backend && npm run lint && npm test
cd frontend && npm run lint && npm test && npm run build
```

Los finales de línea se normalizan solos con `.gitattributes`; no hace falta configurar el editor.
