/**
 * Deja el Keycloak que está corriendo igual que realm-abasto.json. El realm vive en Postgres y
 * --import-realm no lo vuelve a importar, así que los cambios posteriores se aplican aquí.
 * Se puede correr las veces que haga falta (lo corre `pnpm todo`). Contraseñas solo de desarrollo.
 *
 * 1. abasto-app acepta usuario y contraseña desde la app (login nativo, sin navegador).
 * 2. catalogo-cuentas: cuenta de servicio con la que Catálogo crea usuarios y abre la sesión
 *    de quien entra con su celular.
 * 3. El apellido es opcional: un cliente que se llama «Rosa» entra sin inventar un apellido.
 * 4. cobros-servicio: cuenta de servicio con la que Cobros le pide a Catálogo el nombre de los productos de un pedido
 *    entregado (para «Mi negocio» del cliente). Solo client credentials y audiencia abasto-api; sin roles.
 */
const BASE = process.env.KEYCLOAK_URL ?? 'http://localhost:8180';
const REALM = 'abasto';
const SECRETO = process.env.KEYCLOAK_CUENTAS_SECRETO ?? 'catalogo-cuentas-local';
const SECRETO_COBROS = process.env.KEYCLOAK_COBROS_SECRETO ?? 'cobros-servicio-local';

async function json(r) {
  const texto = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${r.url}: ${texto.slice(0, 200)}`);
  return texto ? JSON.parse(texto) : null;
}

const { access_token: token } = await json(
  await fetch(`${BASE}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: 'admin', password: 'admin' }),
  }),
);
const admin = (ruta, opciones = {}) =>
  fetch(`${BASE}/admin/realms/${REALM}${ruta}`, {
    ...opciones,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(opciones.headers ?? {}) },
  });
const cliente = async (clientId) => (await json(await admin(`/clients?clientId=${clientId}`)))[0];

// 1. Login nativo de la app
const app = await cliente('abasto-app');
if (!app.directAccessGrantsEnabled) {
  await json(await admin(`/clients/${app.id}`, { method: 'PUT', body: JSON.stringify({ ...app, directAccessGrantsEnabled: true }) }));
  console.log('Keycloak: abasto-app acepta el login nativo');
}

// 2. Cuenta de servicio de Catálogo
let cuentas = await cliente('catalogo-cuentas');
if (!cuentas) {
  await json(
    await admin('/clients', {
      method: 'POST',
      body: JSON.stringify({
        clientId: 'catalogo-cuentas',
        name: 'Catálogo · crear cuentas y sesiones',
        publicClient: false,
        secret: SECRETO,
        serviceAccountsEnabled: true,
        standardFlowEnabled: false,
        directAccessGrantsEnabled: false,
      }),
    }),
  );
  cuentas = await cliente('catalogo-cuentas');
  console.log('Keycloak: creado catalogo-cuentas');
}
const servicio = await json(await admin(`/clients/${cuentas.id}/service-account-user`));
const gestion = await cliente('realm-management');
const disponibles = await json(await admin(`/clients/${gestion.id}/roles`));
const necesarios = disponibles.filter((r) => ['manage-users', 'view-users', 'query-users', 'view-realm'].includes(r.name));
const tiene = await json(await admin(`/users/${servicio.id}/role-mappings/clients/${gestion.id}`));
const faltan = necesarios.filter((r) => !tiene.some((t) => t.name === r.name));
if (faltan.length) {
  await json(await admin(`/users/${servicio.id}/role-mappings/clients/${gestion.id}`, { method: 'POST', body: JSON.stringify(faltan) }));
  console.log(`Keycloak: catalogo-cuentas puede ${faltan.map((r) => r.name).join(', ')}`);
}

// 3. Grupos con los que Catálogo crea las cuentas en un solo pedido (rol + sesión larga en la app)
const rolesDelRealm = await json(await admin('/roles'));
for (const [grupo, rol] of [['clientes', 'tienda'], ['mayoristas', 'mayorista']]) {
  let g = (await json(await admin(`/groups?search=${grupo}&exact=true`)))?.find((x) => x.name === grupo);
  if (!g) {
    await json(await admin('/groups', { method: 'POST', body: JSON.stringify({ name: grupo }) }));
    g = (await json(await admin(`/groups?search=${grupo}&exact=true`))).find((x) => x.name === grupo);
    console.log(`Keycloak: creado el grupo ${grupo}`);
  }
  const quiere = rolesDelRealm.filter((r) => [rol, 'offline_access'].includes(r.name)).map(({ id, name }) => ({ id, name }));
  const tieneG = await json(await admin(`/groups/${g.id}/role-mappings/realm`));
  const faltanG = quiere.filter((r) => !tieneG.some((t) => t.name === r.name));
  if (faltanG.length) await json(await admin(`/groups/${g.id}/role-mappings/realm`, { method: 'POST', body: JSON.stringify(faltanG) }));
}

// 4. Apellido opcional
const perfil = await json(await admin('/users/profile'));
const apellido = perfil.attributes.find((a) => a.name === 'lastName');
if (apellido?.required) {
  delete apellido.required;
  await json(await admin('/users/profile', { method: 'PUT', body: JSON.stringify(perfil) }));
  console.log('Keycloak: el apellido ya no es obligatorio');
}

// 5. Cuenta de servicio de Cobros («Mi negocio»: nombre y rubro de lo entregado)
if (!(await cliente('cobros-servicio'))) {
  await json(
    await admin('/clients', {
      method: 'POST',
      body: JSON.stringify({
        clientId: 'cobros-servicio',
        name: 'Cobros · leer productos para Mi negocio',
        publicClient: false,
        secret: SECRETO_COBROS,
        serviceAccountsEnabled: true,
        standardFlowEnabled: false,
        directAccessGrantsEnabled: false,
        protocolMappers: [
          {
            name: 'audiencia-api',
            protocol: 'openid-connect',
            protocolMapper: 'oidc-audience-mapper',
            config: { 'included.custom.audience': 'abasto-api', 'access.token.claim': 'true', 'id.token.claim': 'false', 'introspection.token.claim': 'true' },
          },
        ],
      }),
    }),
  );
  console.log('Keycloak: creado cobros-servicio');
}

console.log('Keycloak al día');
