# MagicVS 🎴

**MagicVS** es una plataforma web competitiva para jugar y gestionar mazos de **Magic: The Gathering (MTG)**, con enfoque en el formato Standard, sistema de ranking ELO, y simulación completa de batallas PvP por turnos con más de 35 mecánicas implementadas.

Proyecto grupal universitario desarrollado con **Angular 21 + Spring Boot 4.0.5 + PostgreSQL 16 + Docker**.

---

## 🚀 Características Principales

- **Catálogo de Cartas**: Explorador con patrón Maestro+Detalle, filtros por color/tipo/rareza/favoritos, SVGs de maná, efecto 3D tilt, y vista previa al hacer hover.
- **Gestión de Mazos**: Crea y edita mazos de 60 cartas (máx 4 copias), import/export, mazos públicos.
- **Batallas PvP**: Motor de juego por turnos completo con fases (Mulligan → Untap → Upkeep → Draw → Main 1 → Combat → Main 2 → End), más de 35 mecánicas implementadas (Landfall, Fight, Modal, Kicker, Adventure, MDFC, Convoke, Crew, etc.), y sincronización entre jugadores mediante polling.
- **Matchmaking**: Cola de emparejamiento automatizada por rango de ELO con tiempo de espera progresivo.
- **Sistema ELO**: Cálculo estándar con K adaptativo según experiencia del jugador.
- **Amigos y Chat**: Sistema de amistades con solicitudes, chat en tiempo real y notificaciones SSE.
- **Logros**: 43 logros en 4 categorías con progreso y notificaciones al desbloquear.
- **Noticias**: Scraping diario de MTGGoldfish con CRON programado.
- **Metajuego**: Análisis de arquetipos con datos scrapeados de MTGGoldfish.
- **Torneos**: Sistema de torneos con participantes y rondas.
- **Booster 3D**: Apertura de sobres con renderizado Three.js.
- **Espectador**: Vista de solo lectura de partidas en vivo de amigos.
- **Colección**: Cartas en propiedad por usuario.

---

## 🛠️ Stack Tecnológico

### Frontend
- **Framework**: [Angular 21](https://angular.io/) con standalone components
- **UI**: Angular Material + [Tailwind CSS 3.4](https://tailwindcss.com/)
- **Estado**: Signals + RxJS
- **3D**: Three.js (boosters)
- **Empaquetado**: Nginx (Docker multi-stage)

### Backend
- **Framework**: [Spring Boot 4.0.5](https://spring.io/projects/spring-boot) (Java 21)
- **Persistencia**: Spring Data JPA + [PostgreSQL 16](https://www.postgresql.org/)
- **Documentación API**: Swagger UI en `/api/docs` (Springdoc OpenAPI)
- **Tiempo real**: SSE (Server-Sent Events)
- **Colas**: Redis Streams para ingestión de datos
- **Scraping**: Jsoup para MTGGoldfish
- **Email**: SMTP Brevo

### Infraestructura
- **Contenedores**: Docker + Docker Compose (5 servicios)
- **Proxy**: Nginx para SPA

---

## 📂 Estructura del Repositorio

```
ProyectoGrupal/
├── backend/                           # Spring Boot (Java 21)
│   └── src/main/java/com/magicvs/backend/
│       ├── config/                    # CORS, Swagger, Scheduling, initializers
│       ├── controller/                # 25 controladores REST
│       ├── dto/                       # ~20 DTOs
│       ├── model/                     # 39 entidades JPA
│       ├── repository/                # 30 repositorios Spring Data
│       └── service/                   # 27 servicios
├── frontend/                          # Angular 21 SPA
│   └── src/app/
│       ├── core/services/             # 20 servicios HTTP/SSE
│       ├── features/                  # 19 módulos funcionales
│       ├── layouts/                   # Layout principal (navbar, chat, notis)
│       ├── models/                    # Interfaces TypeScript
│       └── shared/                    # Componentes + pipes
├── scripts/                           # SQL de seed y utilidades
├── docs/                              # Documentación y guía de defensa
├── docker-compose.yml                 # Orquestación completa
└── README.md
```

---

## 🐳 Despliegue con Docker

```bash
docker compose up --build
```

**5 servicios:**

| Servicio | Puerto | Perfil | Función |
|---|---|---|---|
| `postgres` | 5433 | — | Base de datos PostgreSQL 16 |
| `redis` | — | — | Cola de ingestión + caché |
| `backend` | 8080 | `backend` | API REST Spring Boot |
| `data-ingestion-worker` | — | `worker` | Procesa colas de importación |
| `frontend` | 4200 | — | Angular vía Nginx |

---

## 📡 Fuentes de Datos Externas

- **Scryfall API**: Importación de cartas del formato Standard con rate limiting (10 req/s). Más de 60 campos mapeados por carta.
- **MTGGoldfish (Scraping)**: Noticias (CRON 00:00) y metajuego (CRON 04:00) con Jsoup.

---

## ⚙️ CRONs Programados

| Tarea | Cada | Descripción |
|---|---|---|
| Matchmaking | 2s | Emparejar jugadores |
| Worker poll | 1s | Procesar cola Redis |
| Worker retry | 5s | Reintentar trabajos fallidos |
| Scryfall sync | 3:00 AM | Sincronizar cartas |
| News sync | 00:00 | Scrapear noticias |
| Meta sync | 4:00 AM | Scrapear metajuego |
| Daily report | 8:00 AM | Reportes por email |

---

## 🧩 Mecánicas del Motor de Batalla

35+ mecánicas implementadas en `battle-engine.service.ts` (4627 líneas):

Landfall, Animar tierra, Habilidades activadas, Sacrifice lands, Condition mana, X cost, Kicker, Adventure, MDFC, Modal spells, Fight, Death triggers, Stun counters, Convoke, Crew, Equipment, Aura, Erode, Plot, Warp, Scry, Surveil, y más.

---

## 📋 Cumplimiento de Requisitos

| Requisito | Implementación |
|---|---|
| Gestión de Tareas | GitHub Projects, ramas, Pull Requests, Code Review |
| GitHub | PRs con approvals, rama `main` protegida |
| Persistencia | PostgreSQL 16 con JPA (39 entidades) |
| Patrón Maestro-Detalle | Catálogo de cartas (`/cartas` → `/cartas/:id`) |
| API REST | 25 controladores, documentados con Swagger |
| Dockerización | 5 contenedores, multi-stage builds |
| Fuentes externas | Scryfall API + scraping MTGGoldfish |
| Tiempo real | SSE para notificaciones y chat |
| Autenticación | Login con token, authGuard, Google OAuth |

---

## 📄 Documentación

- **Guía completa**: `docs/magicvs-guia-completa.md` / `.pdf`
- **Banco de preguntas**: `docs/banco-preguntas-defensa.md` / `.pdf`
- **API Swagger**: `http://localhost:8080/api/docs`
- **Diseño UI**: `DESIGN.md`

---

## 👥 Colaboradores

| Usuario | Rol |
|---|---|
| **@aaf925** | — |
| **@amm927** | — |
| **@anm0200** | — |
| **@jgm847** | — |
| **@jsh336** | — |
| **@lsa180** | — |

---

## 📄 Licencia

Proyecto con fines educativos universitarios.
