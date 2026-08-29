# 👑 Rey ink — Actualizador

Construcción limpia e independiente.

## Primera fase implementada
- Dashboard futurista tipo PS5.
- Registro de dispositivos propios.
- Código único por dispositivo.
- Link privado individual para control desde otro dispositivo.
- Estado online/offline y estado del actualizador.
- Controles remotos: iniciar, detener, bump y MY POSTS.
- Configuración del intervalo del actualizador.
- Base de datos propia en Supabase, separada del sistema de terceros.

## Próximo módulo
Conectar la extensión Chrome al canal de comandos y después construir el editor completo de posts.

## Variables de Vercel
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `REY_INK_ADMIN_KEY`
- `PUBLIC_BASE_URL`

Nunca pongas `SUPABASE_SERVICE_ROLE_KEY` dentro del frontend o de la extensión.
