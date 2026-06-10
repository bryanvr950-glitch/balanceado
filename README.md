# Balanceado Beta — Guía de despliegue en 30 minutos

## Qué incluye esta beta

- ✅ Login con email/contraseña
- ✅ Stock diario de los 11 campos (edición inline)
- ✅ Carga de CAF con análisis por IA (Claude Vision)
- ✅ Vista de consumo Kg/Ha
- ✅ Historial de registros guardados
- ✅ Base de datos persistente (nunca se pierde)
- ✅ Multi-usuario

## Paso 1 — Supabase (base de datos, gratis)

1. Ir a **https://supabase.com** → New project
2. Nombre del proyecto: `balanceado-beta`
3. Contraseña: genera una segura, guárdala
4. Región: `us-east-1` (más cercana)
5. Esperar ~2 minutos que termine de crear

**Ejecutar el SQL:**
- Dashboard → SQL Editor → New query
- Pegar TODO el contenido de `supabase/migrations/001_beta_schema.sql`
- Clic en "Run"

**Crear bucket de imágenes:**
- Dashboard → Storage → New bucket
- Nombre: `caf-imagenes`  ← exactamente así
- Marcar: **Public bucket** (para beta)
- Create bucket

**Obtener las credenciales:**
- Dashboard → Settings → API
- Copiar: `Project URL` y `anon public`
- Copiar (revelar primero): `service_role`

## Paso 2 — Anthropic API (análisis de CAF, ~$5/mes)

1. Ir a **https://console.anthropic.com**
2. API Keys → Create Key → nombre: `balanceado-beta`
3. Copiar la clave (`sk-ant-...`) — solo se muestra una vez

## Paso 3 — Crear el primer usuario

En Supabase → Authentication → Users → **Add user**:
- Email: `tu@email.com`
- Password: una contraseña segura
- Clic en "Create user"

Copiar el UUID del usuario que aparece en la lista.

En SQL Editor, ejecutar (reemplazar el UUID):
```sql
INSERT INTO usuarios (id, email, nombre, rol)
VALUES (
  'PEGA_AQUI_EL_UUID',
  'tu@email.com',
  'Tu Nombre',
  'administrador'
);
```

## Paso 4 — Vercel (hosting, gratis)

1. Ir a **https://vercel.com** → Sign up con GitHub
2. New Project → Import Git Repository
   - Si no tienes repo: subir la carpeta como zip en GitHub primero
3. Framework Preset: **Next.js** (lo detecta automático)
4. En **Environment Variables**, agregar:

```
NEXT_PUBLIC_SUPABASE_URL      = https://TU_PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJ... (anon public)
SUPABASE_SERVICE_ROLE_KEY     = eyJ... (service_role)
ANTHROPIC_API_KEY             = sk-ant-...
NEXT_PUBLIC_APP_URL           = https://TU-PROYECTO.vercel.app
```

5. Clic en **Deploy**
6. En ~3 minutos, la URL `https://tu-proyecto.vercel.app` está lista

## Paso 5 — Probar

1. Abrir la URL → redirige a `/login`
2. Ingresar con el email y contraseña del Paso 3
3. Ver el stock de los 11 campos
4. Probar el botón **📷 CAF** para procesar una imagen
5. Editar los números y presionar **💾 Guardar**

## URLs importantes

- Tu app: `https://tu-proyecto.vercel.app`
- Supabase dashboard: `https://app.supabase.com`
- Agregar más usuarios: Supabase → Authentication → Users → Add user
  (+ ejecutar el INSERT en SQL Editor)

## Si algo falla

- **Error de CORS**: verificar que `NEXT_PUBLIC_SUPABASE_URL` no tiene `/` al final
- **Error de login**: verificar que el INSERT de usuarios se ejecutó correctamente
- **CAF no analiza**: verificar `ANTHROPIC_API_KEY` en Vercel → Settings → Environment Variables
- **Imagen no sube**: verificar que el bucket se llama `caf-imagenes` y está como Public

## Para agregar más usuarios

Supabase → Authentication → Users → Add user, luego:
```sql
INSERT INTO usuarios (id, email, nombre, rol)
VALUES ('UUID_DEL_NUEVO_USUARIO', 'email@empresa.com', 'Nombre', 'operador_campo');
-- Roles: administrador | jefe_operaciones | supervisor_campo | operador_campo | analista | gerente_general
```
