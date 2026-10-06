# Dashboard INNVIDA

## Acceso de edición de detalle

El usuario `jefecito` con contraseña `jefecito1` puede modificar desde la
tabla todos los datos de una cotización excepto **Marca** y **Fecha de
emisión**. Los cambios se guardan automáticamente al salir de cada campo o al
presionar Enter; el borde verde confirma que Firebase aceptó la actualización.

Los demás perfiles conservan sus permisos previos de seguimiento.

## Firebase

El tablero actualiza los documentos directamente en las colecciones Firebase
ya configuradas. Para que los cambios se persistan, las reglas de Firestore de
cada proyecto deben permitir `update` en las colecciones usadas:

- `cotizaciones` en Sanaré, Nomad y Nuevo Sanaré.
- `solicitudes` en Prixz Nomad.

El inicio de sesión de este proyecto es local (está en `index.html`), por lo
que las reglas de Firestore no pueden reconocer por sí solas al usuario
`jefecito`. Si se necesita restringir el guardado en el servidor únicamente a
ese perfil, hay que migrar el acceso a Firebase Authentication y usar reglas
basadas en el usuario autenticado.
