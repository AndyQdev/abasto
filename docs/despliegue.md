# Despliegue de Abasto en tres nubes

Todo lo del despliegue está aquí: qué va en cada nube, cómo se creó, cómo se actualiza, los problemas que aparecieron y cómo se borra. Este archivo **no lleva claves**. Jhoel pasa a mano el `.env` de cada nube y las llaves SSH.

Lo pidió el ingeniero: los microservicios en Google Cloud, Azure y AWS, y que al cambiar un módulo no se reinicie todo el sistema. Lo arma Jhoel con Claude Code. Presentación el 10/11/2026, revisión hasta el 12/11, y **el 13/11 se borra todo** para no gastar crédito.

## 1. Qué va en cada nube y por qué

| Nube | Qué corre | Por qué ahí |
|---|---|---|
| **AWS** | Keycloak, Apollo Router, Conecta + DynamoDB, n8n, webs (Shell, Gestión, Inteligencia, Superadmin) | DynamoDB es de AWS. Es la puerta de entrada (login y GraphQL) |
| **Azure** | Pedidos, Cobros, Asistente, Postgres, RabbitMQ | Los tres usan el mismo Postgres: van juntos. RabbitMQ va con quien más lo usa |
| **Google Cloud** | Catálogo + Mongo | Tiene su propia base y nadie más la usa |

Hay una sola regla que importa: **cada servicio queda en la misma nube que su base de datos**. Lo que cruza de una nube a otra aguanta bien la distancia:
- **El Router** hace una llamada por pantalla a cada servicio.
- **Los servicios** validan el token de Keycloak con su llave guardada y no le preguntan en cada pedido.
- **RabbitMQ** es asíncrono.

### Cómo se conectan

```
              navegador / app móvil
                       │ HTTPS
   ┌───────────────────▼────────────────────┐
   │ AWS · Ohio (us-east-2)                 │
   │ Caddy → auth (Keycloak) · api (Router) │
   │       → conecta · n8n                  │
   │       → panel · gestion · inteligencia │
   │       → superadmin                     │
   │ DynamoDB ◄─ Conecta (rol de la EC2)    │
   │          ◄─ Asistente de Azure (llave) │
   └───┬──────────────────────────┬─────────┘
       │ HTTPS (Router → subgrafos)│ AMQP 5672 (solo la IP de AWS)
   ┌───▼──────────────────────────▼─────────┐      ┌─────────────────────────┐
   │ Azure · centralus                      │      │ Google · pendiente      │
   │ Caddy → pedidos · cobros · asistente   │◄────►│ Catálogo + Mongo        │
   │ Postgres · RabbitMQ                    │      └─────────────────────────┘
   └────────────────────────────────────────┘
```

**Dominios:** no compramos dominio. Cada máquina usa su IP con guiones + `.sslip.io` (`3.140.59.13` → `auth.3-140-59-13.sslip.io`), y Caddy saca el certificado HTTPS de Let's Encrypt solo.

## 2. Estado

| Nube | Máquina | IP fija | Dominio | Estado |
|---|---|---|---|---|
| AWS | EC2 `m7i-flex.large` (x86, 2 vCPU, 8 GB), Ubuntu 24.04, 30 GB | 3.140.59.13 | `3-140-59-13.sslip.io` | arriba (07/11) |
| Azure | VM `Standard_B2pls_v2` (ARM, 2 vCPU, 4 GB + 4 GB de swap), Ubuntu 24.04, 30 GB | 52.230.165.148 | `52-230-165-148.sslip.io` | arriba (07/11) |
| Google | — | — | — | sin cuenta |

### Direcciones

| Qué | Dirección |
|---|---|
| Panel Mayorista | https://panel.3-140-59-13.sslip.io |
| Superadmin | https://superadmin.3-140-59-13.sslip.io |
| Keycloak (consola en `/admin`) | https://auth.3-140-59-13.sslip.io |
| Apollo Router | https://api.3-140-59-13.sslip.io |
| Conecta | https://conecta.3-140-59-13.sslip.io |
| n8n | https://n8n.3-140-59-13.sslip.io |
| Gestión, Inteligencia | `gestion.` e `inteligencia.` del mismo dominio, cargadas dentro del Panel |
| Pedidos, Cobros, Asistente | `pedidos.`, `cobros.` y `asistente.52-230-165-148.sslip.io` |

**Usuarios:** los de prueba, con sus contraseñas de siempre; el realm se importó igual. Keycloak (admin) y n8n (`admin@abasto.bo`) tienen claves nuevas, que están en el `.env` de AWS.

### Costo y crédito

| Nube | Crédito | Costo encendida | Apagada |
|---|---|---|---|
| AWS | 100 USD (plan con créditos) | ~2,50 USD/día | ~0,20 USD/día (disco + IP) |
| Azure | Azure for Students, ~79 USD estimados al 07/11 | ~0,80 USD/día | ~0,20 USD/día |

El crédito exacto de Azure for Students se ve en el portal, en **Education › Overview**. Desde la terminal no se puede leer. La prueba gratuita de 200 USD de esa cuenta venció el 16/04/2026.

## 3. Archivos del repo

| Archivo | Qué hace |
|---|---|
| `infra/despliegue/aws/compose.yml` | Los contenedores de AWS, uno por módulo, cada uno con su tope de memoria |
| `infra/despliegue/aws/Caddyfile` | HTTPS y un subdominio por módulo |
| `infra/despliegue/aws/web.Caddyfile` | Lo que corre dentro de cada contenedor web: sirve los archivos de una sola web |
| `infra/despliegue/aws/router.yaml` | El Router con las webs públicas en CORS y los subgrafos de las otras nubes |
| `infra/despliegue/aws/preparar.sh` | Tablas de DynamoDB, Keycloak al día y flujos de n8n. Se puede repetir |
| `infra/despliegue/azure/compose.yml` | Pedidos, Cobros, Asistente, Postgres y RabbitMQ. El Asistente usa el DynamoDB de AWS |
| `infra/despliegue/azure/Caddyfile`, `rabbitmq.conf` | HTTPS; RabbitMQ con la clave de producción |
| `infra/despliegue/construir-webs.mjs` | Construye las webs con las direcciones públicas en `infra/despliegue/aws/webs/` |
| `infra/despliegue/<nube>/.env.example` | Qué variables lleva cada nube. El `.env` real no se sube |

**Cambios al código para poder desplegar** (en local todo sigue igual):
- `packages/sesion`: el emisor de Keycloak y las direcciones del Panel y del Superadmin salen de `VITE_KEYCLOAK_URL`, `VITE_PANEL_URL` y `VITE_SUPERADMIN_URL`.
- `apps/superadmin/src/servicios.ts`: la salud de cada servicio sale de `VITE_SALUD_<SERVICIO>`.
- `apps/panel-shell/src/sw.ts`: el service worker reconoce a Keycloak por su dirección.
- `apps/panel-shell/vite.config.ts`: `remotos.json` queda fuera del precache.
- `infra/keycloak/al-dia.mjs`: agrega las direcciones públicas a los clientes, y la clave de admin sale del entorno.
- `infra/dynamodb/crear-tablas.mjs`: espera a que cada tabla quede activa.

## 4. Cómo se creó (07/11/2026)

Claude Code lo hizo con el CLI de cada nube. Jhoel solo inició sesión en el navegador: con `aws login` y `az login` las credenciales son temporales y vencen solas, sin llaves guardadas.

### AWS (cuenta 893685200562, proyecto «Hold My Coffee», us-east-2)

1. Se instaló el AWS CLI (`winget install Amazon.AWSCLI`). Jhoel corrió `aws login --region us-east-2`.
2. **Llave SSH:** el key pair `abasto-aws`, guardado en `~/.ssh/abasto-aws.pem` de la computadora de Jhoel.
3. **Grupo de seguridad** `abasto-aws` (`sg-0b7114b419c779e3c`): el 22 solo desde la IP de Jhoel; el 80 y el 443 abiertos.
4. **Rol IAM** `abasto-ec2` con `AmazonDynamoDBFullAccess` y su instance profile. Así Conecta usa DynamoDB sin llaves.
5. **La máquina:** EC2 `i-014fdde045fa13ab7` con Ubuntu 24.04 (AMI de Canonical por SSM) y un script de inicio que agrega 4 GB de swap, Docker y la zona horaria de La Paz.
6. **IP elástica:** `eipalloc-07276b950896ef0aa`.
7. **Código y claves:** el código se mandó con `git archive` y el `.env` con claves nuevas (`openssl rand -hex 24`).
8. **Arranque:** `docker compose up -d --build` y `sh preparar.sh`.
9. **Webs:** se construyeron en la computadora de Jhoel y se subieron.
10. **n8n:** se creó su cuenta de dueño por la API (`/rest/owner/setup`), para que nadie más la tome.
11. **Prueba desde afuera:**
    - las 8 direcciones responden 200;
    - el token sale con el emisor público;
    - el Router contesta y deja pasar al Panel (CORS).

### Azure (suscripción «Azure for Students», centralus)

1. Se instaló el Azure CLI (`winget install Microsoft.AzureCLI`). Jhoel corrió `az login --tenant 6e7206c5-5f9a-4c9d-814c-aa37c41e21bd` (ver el problema 4 del punto 6).
2. **Revisión de la suscripción:**
   - permite solo 5 regiones;
   - deja 4 vCPU libres de un máximo de 6;
   - en centralus solo hay máquinas ARM disponibles.
3. **Grupo de recursos** `abasto` en centralus, etiquetado `borrar=2026-11-13`. **El grupo `vendfy` es otro proyecto de Jhoel y no se toca.**
4. **La máquina:** VM `abasto-azure` `Standard_B2pls_v2`, Ubuntu 24.04 ARM, IP pública estática y disco StandardSSD de 30 GB. Usa una llave SSH ed25519 nueva, en `~/.ssh/abasto-azure` de la computadora de Jhoel, y el mismo script de inicio que AWS.
5. **Firewall (NSG `abasto-azureNSG`):**
   - 22 solo desde la IP de Jhoel;
   - 80 y 443 abiertos;
   - 5672 (RabbitMQ) solo desde la IP de AWS.
6. **Código y claves:** igual que en AWS, el código con `git archive` y el `.env` con claves nuevas. `KEYCLOAK_COBROS_SECRETO` es el mismo de AWS.
7. **Arranque:** `docker compose up -d --build` (construir Pedidos con Java en ARM tomó unos 10 minutos). El Asistente usa la tabla `asistente` del DynamoDB de AWS con la llave limitada del usuario IAM `abasto-asistente-azure` (ver el problema 10). Al probar, los agentes crearon 5 propuestas y quedaron 9 registros en AWS.
8. **Conexión con AWS:** en AWS se cambiaron `DOMINIO_AZURE` y `RABBITMQ_URL`, se reiniciaron el Router y Conecta, y se reconstruyeron el Shell y el Superadmin, que llevan la dirección del Asistente.
9. **Prueba desde afuera:**
    - Pedidos, Cobros y Asistente responden 200;
    - el Router de AWS devuelve las ventas de Pedidos en Azure;
    - el Asistente acepta el token de AWS y el CORS del Panel, y responde un reporte;
    - Conecta (AWS) escucha los eventos de RabbitMQ (Azure).

    Memoria en uso: 1,3 GB de 4 GB.

## 5. Actualizar un solo módulo

El repo es privado, así que las máquinas no tienen credenciales de GitHub. El código se manda desde la computadora de quien despliega.

```bash
# 1. Mandar el código (desde la raíz del repo)
git archive HEAD | ssh -i ~/.ssh/abasto-aws.pem ubuntu@3.140.59.13 "tar -x -C abasto"
git archive HEAD | ssh -i ~/.ssh/abasto-azure azureuser@52.230.165.148 "tar -x -C abasto"

# 2. Reiniciar solo ese servicio (en la máquina)
cd abasto/infra/despliegue/aws   && docker compose up -d --build conecta
cd abasto/infra/despliegue/azure && docker compose up -d --build cobros
```

**Un microfrontend** se cambia sin tocar el Shell, que lee `remotos.json` cada vez que abre:

```bash
node infra/despliegue/construir-webs.mjs inteligencia
tar -C infra/despliegue/aws -cf - webs/inteligencia | ssh -i ~/.ssh/abasto-aws.pem ubuntu@3.140.59.13 \
  "cd abasto/infra/despliegue/aws && rm -rf webs/inteligencia && tar -x && docker compose restart web-inteligencia"
```

Después del `rm -rf` hay que **reiniciar ese contenedor**; mira el problema 6 del punto 6.

**La app móvil** no va a una nube. Se compila el APK con las direcciones públicas y se instala:

```
EXPO_PUBLIC_KEYCLOAK_URL=https://auth.3-140-59-13.sslip.io/realms/abasto
EXPO_PUBLIC_ROUTER_URL=https://api.3-140-59-13.sslip.io/
EXPO_PUBLIC_CONECTA_URL=https://conecta.3-140-59-13.sslip.io
EXPO_PUBLIC_PANEL_URL=https://panel.3-140-59-13.sslip.io/
```

**Entrar a las máquinas:**
- AWS: `ssh -i ~/.ssh/abasto-aws.pem ubuntu@3.140.59.13`
- Azure: `ssh -i ~/.ssh/abasto-azure azureuser@52.230.165.148`

El puerto 22 solo deja entrar a la IP de Jhoel (189.28.74.156 al 07/11). Si alguien más necesita entrar, o si la IP de Jhoel cambia, hay que agregarla a la regla.

## 6. Problemas que aparecieron y cómo se resolvieron

| # | Problema | Causa | Solución |
|---|---|---|---|
| 1 | `aws login --region sa-east-1`: «Region not supported for your project» | La cuenta de AWS con créditos usa la «nueva experiencia», y su proyecto quedó fijo en us-east-2 | Todo en **us-east-2 (Ohio)**. Azure y Google van al centro y este de EE. UU. para que la distancia entre nubes sea chica |
| 2 | Algunos tamaños de máquina no se pueden usar en AWS | El plan con créditos solo permite los tamaños de la capa gratuita | `m7i-flex.large` (8 GB), la más grande permitida |
| 3 | `git clone` en la máquina falló («could not read Username») | El repo es privado | El código se manda con `git archive` desde la computadora. No quedan credenciales en el servidor |
| 4 | `az login` entraba con el gmail y decía «No subscriptions found» | El directorio pide verificación en dos pasos, y la ventana de inicio de sesión de Windows (WAM) no la pedía | `az config set core.enable_broker_on_windows=false` (usa el navegador) y `az login --tenant <id>` |
| 5 | `preparar.sh` falló: «Cannot describe time to live while table is in CREATING state» | En el DynamoDB real una tabla tarda unos segundos en crearse; el DynamoDB Local es inmediato | `crear-tablas.mjs` espera con `waitUntilTableExists` |
| 6 | Se subió el Shell nuevo pero se seguía viendo el viejo | Al hacer `rm -rf` de la carpeta montada, el contenedor sigue viendo la carpeta borrada | Después de reemplazar una web, `docker compose restart web-<web>`. Solo se reinicia ese módulo |
| 7 | El service worker del Panel reconocía a Keycloak por el puerto 8180 | En la nube Keycloak está en el 443 de `auth.`, así que se hubiera guardado en caché el login | Ahora lo reconoce por su dirección (`VITE_KEYCLOAK_URL`) |
| 8 | `remotos.json` quedaba en el precache del service worker | Con eso, cambiar un remoto obligaba a reconstruir el Shell | Se sacó del precache (`globIgnores`). Lo atiende su ruta NetworkFirst |
| 9 | Azure for Students solo permite westus, centralus, mexicocentral, canadacentral y brazilsouth, y en centralus solo hay máquinas ARM | Política de la suscripción y capacidad de la región | centralus (a unos 20 ms de Ohio) con `B2pls_v2` ARM. Todas las imágenes de Abasto corren en ARM |
| 10 | El Asistente en Azure necesita DynamoDB, pero el de AWS pide credenciales | El rol de la EC2 solo sirve dentro de AWS; desde Azure hace falta una llave | Primero se usó un DynamoDB Local en Azure. **Jhoel decidió usar uno solo, el de AWS** (DynamoDB Local es para pruebas, sin respaldos). Se creó el usuario IAM `abasto-asistente-azure`, con una llave que **solo puede usar la tabla `asistente`** (probado: leer `conecta` da `AccessDeniedException`). La llave vive solo en el `.env` de Azure |
| 11 | La subida del código a Azure tardó unos 10 minutos | Son 42 MB (modelos e imágenes) con la subida lenta de la casa de Jhoel | A Azure solo le hacen falta `services/` e `infra/`. Para la próxima: `git archive HEAD services infra packages package.json pnpm-lock.yaml pnpm-workspace.yaml` |

**Simplificaciones de la demo:**
- RabbitMQ entre nubes va sin TLS; lo protegen el firewall (solo la IP de AWS y, después, la de Google) y una clave nueva.
- Postgres no se publica y queda solo dentro de la máquina de Azure, con las claves de desarrollo de cada base.
- Los usuarios de prueba conservan `abasto123`.

## 7. Borrar todo (viernes 13/11)

Así ya no se gasta crédito. Hay que tener la sesión iniciada con `aws login --region us-east-2` y `az login --tenant …`.

```bash
# AWS
aws ec2 terminate-instances --instance-ids i-014fdde045fa13ab7
aws ec2 wait instance-terminated --instance-ids i-014fdde045fa13ab7
aws ec2 release-address --allocation-id eipalloc-07276b950896ef0aa
aws ec2 delete-security-group --group-id sg-0b7114b419c779e3c
aws ec2 delete-key-pair --key-name abasto-aws
aws iam remove-role-from-instance-profile --instance-profile-name abasto-ec2 --role-name abasto-ec2
aws iam delete-instance-profile --instance-profile-name abasto-ec2
aws iam detach-role-policy --role-name abasto-ec2 --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess
aws iam delete-role --role-name abasto-ec2
for t in idempotencia conecta asistente; do aws dynamodb delete-table --table-name $t; done
for k in $(aws iam list-access-keys --user-name abasto-asistente-azure --query "AccessKeyMetadata[].AccessKeyId" --output text); do
  aws iam delete-access-key --user-name abasto-asistente-azure --access-key-id $k; done
aws iam delete-user-policy --user-name abasto-asistente-azure --policy-name solo-tabla-asistente
aws iam delete-user --user-name abasto-asistente-azure

# Azure (solo el grupo abasto; vendfy no se toca)
az group delete -n abasto --yes
```
