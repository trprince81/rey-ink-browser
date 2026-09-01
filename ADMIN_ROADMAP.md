# Rey Ink — Arquitectura vigente

## Objetivo
Centro de control web para administrar PCs, licencias y planes, y generar links individuales para clientes.

## Flujo
1. Administrador asigna PCs y licencias desde el Control Center.
2. Cada PC se registra y mantiene heartbeat.
3. La extensión se empareja mediante código de 6 dígitos.
4. El cliente recibe un link individual seguro.
5. Desde ese link puede editar, activar/detener el bot y consultar su perfil de MegaPersonals.
6. Los comandos viajan por el backend/Supabase hacia la extensión.

## Regla de desarrollo
No reemplazar la extensión estable ni desviarse hacia rediseños visuales. Primero completar la comunicación PC ↔ Rey Ink y el panel administrativo funcional; el diseño definitivo queda para el final.

## Estado conocido
- Vercel despliega este repositorio desde `main`.
- El frontend actual contiene el centro de control y la página de dispositivo.
- La carpeta `extension/` contiene la extensión.
- El backend está bajo `api/`.
