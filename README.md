# CRM-ACADÉMICO

Sistema CRM académico orientado a la gestión de clientes, líneas de crédito, cuentas corrientes, alertas, interacciones y conciliación de saldos. Desarrollado utilizando React, Vite, Node.js, Express, TypeScript y PostgreSQL 17, con Docker Compose para facilitar la instalación, configuración y ejecución del sistema.

El proyecto permite levantar los servicios necesarios mediante contenedores, evitando tener que instalar y configurar PostgreSQL, Node.js o Nginx manualmente para ejecutar la aplicación en su entorno principal.

---

## 1. Tecnologías utilizadas

| Tecnología | Descripción |
|---|---|
| React | Desarrollo de la interfaz de usuario. |
| Vite | Herramienta de desarrollo y construcción del frontend. |
| Node.js 22 | Entorno de ejecución del backend. |
| Express | Framework para la API REST. |
| TypeScript | Tipado estático para el desarrollo del backend. |
| PostgreSQL 17 | Sistema de gestión de base de datos. |
| Docker | Contenerización de los servicios. |
| Docker Compose | Orquestación del frontend, backend y base de datos. |
| Nginx | Servidor web y proxy para el frontend y la API. |

---

## 2. Verificar las instalaciones

Antes de clonar el repositorio, verifica que las herramientas necesarias estén instaladas y funcionando correctamente.

Abre Windows PowerShell y ejecuta los siguientes comandos:

### 2.1. Verificar Git

```powershell
git --version
```

Este comando muestra la versión instalada de Git. Si devuelve un número de versión, significa que Git está disponible desde la terminal.

### 2.2. Verificar Docker

```powershell
docker --version
```

Permite comprobar que Docker está instalado y disponible desde PowerShell.

### 2.3. Verificar Docker Compose

```powershell
docker compose version
```

Este comando verifica que Docker Compose esté disponible para gestionar los servicios del proyecto.

### 2.4. Verificar que Docker Engine esté funcionando

```powershell
docker info
```

Este comando permite comprobar que Docker Engine se encuentra accesible y funcionando. Si devuelve información del sistema Docker, puedes continuar con la instalación.

Si aparece un error relacionado con la conexión al motor Docker, abre Docker Desktop y espera a que termine de iniciar.

Una vez verificadas las herramientas, puedes continuar con la clonación del repositorio.

## 2.5. Requisitos previos

Antes de instalar y ejecutar el proyecto, es necesario contar con los siguientes programas:

- **Git:** para clonar el repositorio.
- **Docker Desktop:** para ejecutar los contenedores y administrar Docker Engine.

### 2.6. Iniciar Docker Desktop

1. Abre Docker Desktop desde Windows.
2. Espera a que Docker Engine termine de iniciar.
3. Verifica que Docker Desktop se encuentre funcionando antes de continuar.

<text>Todos los comandos de esta guía se ejecutarán desde <bold>Windows PowerShell</bold>. No es necesario alternar entre terminales.</text>

<text color="warning" weight="semibold">No ejecutes los comandos del proyecto mientras Docker Desktop se encuentre cerrado o Docker Engine no esté funcionando.</text>

---

## 3. Clonar el repositorio

Abre Windows PowerShell y ejecuta el siguiente comando para descargar el proyecto:

```powershell
git clone https://github.com/Joshua8801/CRM_SIA_PROYECTO.git
```

Una vez finalizada la descarga, ingresa a la carpeta del proyecto:

```powershell
cd CRM_SIA_PROYECTO
```

Los siguientes pasos deben ejecutarse desde esta carpeta, donde se encuentra el archivo `docker-compose.yml`.

---

## 4. Configuración del entorno

El proyecto utiliza archivos de variables de entorno para definir las configuraciones necesarias para el funcionamiento de sus servicios.

### 4.1. Crear los archivos de configuración

A partir de las plantillas proporcionadas en el repositorio, genera los archivos de configuración locales:

```powershell
Copy-Item .env.example .env
```

```powershell
Copy-Item backend/.env.example backend/.env
```

Estos archivos contienen variables que permiten configurar aspectos como los puertos de acceso, las credenciales de conexión a PostgreSQL y la clave utilizada para la autenticación del backend, según corresponda a cada plantilla.

### 4.2. Configurar las variables de entorno

Abre los archivos `.env` y `backend/.env` con tu editor de texto preferido y revisa las variables incluidas en sus respectivas plantillas.

Configura los valores requeridos sin eliminar variables necesarias para el funcionamiento del sistema.

Entre las configuraciones que pueden estar presentes se encuentran:

- Puerto de acceso al frontend.
- Puerto de acceso a PostgreSQL.
- Credenciales del usuario de PostgreSQL.
- Configuración de conexión a la base de datos.
- Clave secreta para la autenticación JWT.
- Configuración de origen permitido para el frontend y backend.

### 4.3. Generar la clave JWT_SECRET

Si la configuración del backend requiere una variable `JWT_SECRET`, puedes generar una clave aleatoria utilizando Node.js desde PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

El comando genera una cadena hexadecimal aleatoria que puedes utilizar como clave secreta.

Copia el resultado y colócalo en la variable `JWT_SECRET` del archivo de configuración que corresponda.

<text color="warning" weight="semibold">No reutilices claves públicas, no compartas tus archivos de configuración privados y no subas tus archivos .env al repositorio.</text>

---

## 5. Inicialización del sistema

Una vez clonado el repositorio y configurados los archivos de entorno, se puede iniciar el sistema mediante Docker Compose.

### 5.1. Validar la configuración de Docker Compose

Antes de iniciar los servicios, puedes verificar que la configuración sea válida ejecutando:

```powershell
docker compose config --quiet
```

Si el comando termina sin mostrar errores, la configuración de Compose puede procesarse correctamente.

### 5.2. Construir e iniciar los servicios

Ejecuta el siguiente comando desde la carpeta raíz del proyecto:

```powershell
docker compose up -d --build
```

Este comando realiza las siguientes acciones:

1. Construye las imágenes del frontend y backend cuando corresponda.
2. Descarga las imágenes necesarias, como PostgreSQL 17, si aún no se encuentran disponibles localmente.
3. Crea la red utilizada por los servicios.
4. Crea los contenedores.
5. Inicia los servicios en segundo plano.
6. Ejecuta los mecanismos de inicialización de la base de datos cuando corresponda a una instalación nueva.

El sistema está compuesto por los siguientes contenedores:

| Contenedor | Función |
|---|---|
| `crm_postgres17` | Ejecuta PostgreSQL 17 y almacena los datos del sistema. |
| `crm_backend` | Ejecuta la API REST del CRM. |
| `crm_frontend` | Ejecuta la interfaz web del sistema mediante Nginx. |

La primera ejecución puede demorar algunos minutos dependiendo de la conexión a internet, la descarga de imágenes y la construcción de los servicios.

---

## 6. Verificar el funcionamiento del sistema

Una vez ejecutado el comando de inicialización, se recomienda realizar las siguientes comprobaciones básicas para confirmar que el sistema se encuentra disponible.

### 6.1. Verificar el estado de los contenedores

Ejecuta:

```powershell
docker compose ps
```

Este comando permite visualizar los contenedores del proyecto, sus estados y los puertos publicados.

Comprueba que los servicios se encuentren iniciados. Si algún contenedor aparece como `Exited`, `Restarting` o `Unhealthy`, revisa los registros antes de continuar.

### 6.2. Acceder a la aplicación web

Abre tu navegador y accede a la siguiente dirección:

<text color="success" weight="semibold">http://localhost:5173</text>

Desde esta dirección podrás visualizar la interfaz web del CRM-ACADÉMICO.

Si la página carga correctamente, el frontend está disponible para su uso.

### 6.3. Verificar el backend (opcional)

Si deseas comprobar que la API está respondiendo, puedes utilizar PowerShell:

```powershell
Invoke-RestMethod http://localhost:5173/api/v1/health
```

Si la ruta de salud está configurada en el proyecto y responde correctamente, debería devolver una respuesta indicando que el servicio se encuentra operativo.

Esta verificación es opcional si la aplicación ya carga y funciona correctamente.

---

## 7. Detener y volver a iniciar el sistema

Una vez que hayas terminado de utilizar el CRM, puedes detener los servicios y volver a iniciarlos posteriormente sin necesidad de reinstalar el proyecto.

### 7.1. Detener los contenedores

Desde PowerShell y dentro de la carpeta del proyecto, ejecuta:

```powershell
docker compose down
```

Este comando detiene y elimina los contenedores y la red asociada al proyecto.

<text color="success" weight="semibold">Los datos almacenados en el volumen persistente de PostgreSQL se conservan.</text>

### 7.2. Volver a iniciar el sistema

Para volver a utilizar el CRM en otra ocasión:

1. Abre Docker Desktop.
2. Espera a que Docker Engine se encuentre funcionando.
3. Abre Windows PowerShell.
4. Ingresa a la carpeta del proyecto, si todavía no te encuentras en ella.
5. Ejecuta:

```powershell
docker compose up -d
```

Este comando inicia los contenedores existentes utilizando la configuración actual, sin reconstruir las imágenes.

### 7.3. Reconstruir los servicios

Si se realizaron cambios en el código fuente, Dockerfile o configuración que requieren actualizar las imágenes, ejecuta:

```powershell
docker compose up -d --build
```

Esto permite reconstruir las imágenes necesarias y volver a iniciar los servicios.

---

## 8. Acceso a los servicios

| Servicio | Dirección / Puerto |
|---|---|
| Aplicación web | http://localhost:5173 |
| PostgreSQL | localhost:5433 |
| Backend | Acceso interno mediante Docker y el proxy del frontend. |

El backend no necesita exponerse directamente al host para el funcionamiento normal de la aplicación, ya que el frontend utiliza el proxy configurado para comunicarse con la API.

Los puertos pueden personalizarse mediante las variables de entorno contempladas en la configuración de Docker Compose.

---

## 9. Solución de problemas básicos

### 9.1. Docker Desktop no está funcionando

Si aparece un error relacionado con Docker Engine, verifica que Docker Desktop esté abierto y que haya terminado de iniciar.

Puedes comprobar la disponibilidad de Docker ejecutando:

```powershell
docker info
```

Si el comando devuelve información del motor Docker, este se encuentra accesible.

### 9.2. Algún contenedor no inicia correctamente

Si un servicio aparece como `Exited`, `Restarting` o `Unhealthy`, consulta los registros del servicio afectado.

Para revisar todos los servicios:

```powershell
docker compose logs
```

Para revisar únicamente el backend:

```powershell
docker compose logs --tail=100 backend
```

Para revisar PostgreSQL:

```powershell
docker compose logs --tail=100 postgres
```

Los registros permiten identificar problemas relacionados con variables de entorno, autenticación, conexiones a PostgreSQL, dependencias o configuración.

### 9.3. Conflicto de puertos

Si alguno de los puertos configurados ya está siendo utilizado por otra aplicación, Docker puede presentar errores al iniciar los contenedores.

En este caso, revisa los puertos definidos en `.env` y verifica la configuración correspondiente en `docker-compose.yml`.

Si es necesario, modifica el puerto de acceso del servicio utilizando las variables contempladas por el proyecto y vuelve a iniciar los contenedores.

### 9.4. Problemas de autenticación con PostgreSQL

Si el backend presenta un error de autenticación, verifica que las credenciales configuradas para la conexión a PostgreSQL coincidan con las que utiliza la base de datos existente.

Modificar las variables de entorno no cambia automáticamente las credenciales de una base de datos previamente inicializada.

No elimines ni reinicialices el volumen de PostgreSQL para solucionar este problema sin antes verificar la configuración y realizar un respaldo si corresponde.

---

## 10. Consideraciones sobre la base de datos

### 10.1. Persistencia de datos

PostgreSQL utiliza un volumen persistente para almacenar la información del sistema.

Esto permite conservar los datos incluso cuando los contenedores se detienen, se eliminan o se reconstruyen, siempre que el volumen no sea eliminado y se mantenga correctamente asociado.

### 10.2. Precaución con los volúmenes

<text color="warning" weight="semibold">No ejecutes docker compose down -v como parte del procedimiento habitual de apagado.</text>

El parámetro `-v` puede eliminar los volúmenes asociados al proyecto y provocar la pérdida de los datos almacenados.

Para detener el sistema de forma habitual, utiliza:

```powershell
docker compose down
```

### 10.3. Instalación nueva y restauración de respaldos

El procedimiento descrito en esta guía corresponde al inicio del sistema a partir de la configuración del repositorio y sus mecanismos de inicialización.

La restauración de un respaldo SQL existente es un procedimiento diferente y debe realizarse de forma independiente.

Antes de restaurar un respaldo:

- Verifica el estado actual de la base de datos.
- Comprueba que el respaldo corresponda a la versión del sistema.
- Evita restaurar sobre una base de datos que contiene información que deseas conservar.
- Realiza un respaldo previo cuando existan datos importantes.

No se debe utilizar una restauración de respaldo como procedimiento habitual para iniciar el sistema.

---

## 11. Estructura general del proyecto

La estructura general del repositorio se organiza de la siguiente manera:

```text
CRM-ACADÉMICO/
├── backend/
│   ├── src/
│   ├── Dockerfile
│   └── .env.example
├── database/
│   └── scripts de inicialización
├── frontend/
│   ├── src/
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

La estructura puede incluir archivos adicionales relacionados con la documentación, configuración, desarrollo y ejecución del sistema.

---

## 12. Seguridad y buenas prácticas

- No compartir los archivos `.env` ni las credenciales de acceso.
- No subir claves JWT, contraseñas ni información sensible al repositorio.
- Mantener Docker Desktop actualizado.
- Evitar eliminar volúmenes que contengan información importante.
- Realizar respaldos antes de efectuar operaciones que puedan afectar los datos.
- Utilizar los comandos de Docker Compose desde la carpeta raíz del proyecto.
- Verificar los registros de los servicios cuando se presenten errores de inicialización.

---

**CRM-ACADÉMICO | Proyecto universitario**