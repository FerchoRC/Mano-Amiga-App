# Mano Amiga App

Monorepo del proyecto de plataforma comunitaria para puntos de recogida ante emergencias.

## Estructura

```text
Mano-Amiga-App/
├── frontend/   # App móvil React Native/Expo
├── backend/    # API Node.js + PostgreSQL
├── README.md   # Documentación general
└── Manual de marca/  # Assets y guía visual de la marca
```

## Requisitos

- Node.js 18+
- npm
- Docker Desktop (para PostgreSQL)

## Iniciar el backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

## Iniciar PostgreSQL

```bash
cd backend
docker compose up -d
```

## Iniciar el frontend

```bash
cd frontend
npm install
npm start
```

## Ejecutar ambos a la vez

```bash
cd Mano-Amiga-App
npm install
npm run dev
```
