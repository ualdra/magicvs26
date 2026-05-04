# 📖 Documentación de Swagger (OpenAPI 3) en MagicVS

Este documento detalla la configuración y el uso de **Swagger UI** para la documentación interactiva de la API REST de MagicVS.

## 🚀 Acceso
Una vez levantado el backend, la documentación es accesible en:
- **Swagger UI:** `http://localhost:8080/api/docs`
- **OpenAPI JSON:** `http://localhost:8080/api/docs-json`

---

## 🛠️ Configuración del Sistema

### 1. Dependencia (Maven)
Se utiliza `springdoc-openapi` para la integración con Spring Boot 3.
**Ubicación:** `backend/pom.xml`
```xml
<dependency>
    <groupId>org.springdoc</groupId>
    <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
    <version>2.8.5</version>
</dependency>
```

### 2. Configuración Global de OpenAPI
Define la información general de la API y el esquema de seguridad para JWT.
**Ubicación:** `backend/src/main/java/com/magicvs/backend/config/OpenApiConfig.java`
- **Security Scheme:** Configurado como `bearerAuth` (Tipo HTTP, esquema Bearer, formato JWT).
- **Info:** Título "MagicVS API" y versión "1.0".

### 3. Propiedades de la Interfaz (application.properties)
Personaliza el comportamiento y las rutas de Swagger.
**Ubicación:** `backend/src/main/resources/application.properties`
```properties
# Rutas personalizadas
springdoc.swagger-ui.path=/api/docs
springdoc.api-docs.path=/api/docs-json

# Mejoras visuales
springdoc.swagger-ui.operationsSorter=alpha      # Ordena endpoints alfabéticamente
springdoc.swagger-ui.tagsSorter=alpha            # Ordena controladores alfabéticamente
springdoc.swagger-ui.displayRequestDuration=true # Muestra tiempo de respuesta
springdoc.swagger-ui.docExpansion=none           # Mantiene los grupos cerrados al inicio
springdoc.swagger-ui.filter=true                 # Habilita barra de búsqueda
```

---

## 📝 Guía de Uso para Desarrolladores

### Documentación de Controladores
Para proteger endpoints con JWT y agruparlos:
- `@Tag`: (Opcional) Define el nombre del grupo. Si se omite, usa el nombre del controlador.
- `@Operation`: Describe la funcionalidad del endpoint.
- `@SecurityRequirement(name = "bearerAuth")`: Indica que el endpoint requiere el token JWT.

### Documentación de DTOs (Modelos)
Usa `@Schema` para proporcionar ejemplos y descripciones que aparecerán en la sección "Schemas" de Swagger.
- `example`: Valor de ejemplo (ej. "Jace_Beleren").
- `description`: Explicación del campo.
- `accessMode`: Usar `Schema.AccessMode.READ_ONLY` para campos de solo salida (IDs, timestamps).

---

## 🔒 Seguridad (JWT)
Para probar endpoints protegidos en Swagger:
1. Haz clic en el botón **"Authorize"** (icono de candado).
2. Pega tu token JWT (sin el prefijo "Bearer").
3. Haz clic en "Authorize" y cierra el modal.
4. Ahora todas las peticiones incluirán el header `Authorization: Bearer <tu_token>`.
