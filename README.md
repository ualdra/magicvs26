# MagicVS 🎴

**MagicVS** es una plataforma web para jugar y gestionar mazos de **Magic: The Gathering (MTG)**, con un enfoque competitivo en formato Standard y un sistema de simulación de batallas PvP.

Este proyecto ha sido desarrollado como parte del **Proyecto Grupal de la Universidad**, integrando tecnologías modernas de Frontend, Backend e Infraestructura.

## 🚀 Características Principales

- **Gestión de Mazos**: Crea y edita tus propios mazos de 60 cartas, respetando la regla de máximo 4 copias por carta (excepto tierras básicas).
- **Pool de Cartas Standard**: Acceso a un subconjunto de cartas seleccionadas del formato Standard para una experiencia equilibrada.
- **Batallas PvP**: Un simulador de combate por turnos donde podrás enfrentarte a otros jugadores.
- **Sección de Noticias**: Scrapping en tiempo real de las últimas novedades del mundo de Magic.
- **Explorador de Cartas**: Interfaz Maestro-Detalle para visualizar artes, habilidades y precios de las cartas.

---

## 🛠️ Stack Tecnológico

### Frontend
- **Framework**: [Angular](https://angular.io/) (Última versión).
- **Diseño**: Arquitectura basada en componentes con patrón Maestro + Detalle.
- **Librerías**: RxJS para reactividad y Angular Material para la interfaz.

### Backend
- **Framework**: [Spring Boot](https://spring.io/projects/spring-boot) (Java).
- **Persistencia**: Por definir (PostgreSQL / MySQL / MariaDB).
- **API**: Arquitectura RESTful para la comunicación con el Frontend.

### Datos Externos
- **API**: Integración con [Scryfall API](https://scryfall.com/docs/api) para obtener datos de cartas.
- **Scrapping**: Implementado para extraer noticias de sitios oficiales de MTG.

### Infraestructura
- **Docker**: Contenedores para soporte al desarrollo y empaquetado final para despliegue.

---

## 📂 Estructura del Repositorio

- `/frontend`: Aplicación Angular.
- `/backend`: API REST en Spring Boot.
- `/docker`: Archivos de configuración de Docker y docker-compose.

---

## 📋 Requisitos del Proyecto (Cumplimiento)

1. **Gestión de Tareas**: Uso de GitHub Projects/Issues.
2. **GitHub**: Flujo de trabajo basado en Pull Requests y Code Review.
3. **Persistencia**: Base de Datos relacional integrada en el Backend.
4. **Patrón Maestro-Detalle**: Implementado en la visualización de cartas en Angular.
5. **Dockerización**: Proyecto completamente empaquetado con Docker.

---

## 🤝 Colaboradores

- **@aaf925**
- **@amm927**
- **@anm0200**
- **@jgm847**
- **@jsh336**
- **@lsa180**

---

## 📄 Licencia

Este proyecto es para fines educativos en el ámbito universitario.
