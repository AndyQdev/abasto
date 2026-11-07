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
 * 5. conecta-integraciones: cuenta de servicio con la que Conecta crea y borra el cliente de cada llave de API (CU-10).
 * 7. En la nube (infra/despliegue): con PANEL_URL, GESTION_URL, INTELIGENCIA_URL y SUPERADMIN_URL, el Panel y el Superadmin
 *    aceptan volver a sus direcciones públicas. KEYCLOAK_ADMIN y KEYCLOAK_ADMIN_CLAVE cambian la cuenta de administrador.
 */
const BASE = process.env.KEYCLOAK_URL ?? 'http://localhost:8180';
const REALM = 'abasto';
const SECRETO = process.env.KEYCLOAK_CUENTAS_SECRETO ?? 'catalogo-cuentas-local';
const SECRETO_COBROS = process.env.KEYCLOAK_COBROS_SECRETO ?? 'cobros-servicio-local';
const SECRETO_CONECTA = process.env.KEYCLOAK_CONECTA_SECRETO ?? 'conecta-integraciones-local';

async function json(r) {
  const texto = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${r.url}: ${texto.slice(0, 200)}`);
  return texto ? JSON.parse(texto) : null;
}

const { access_token: token } = await json(
  await fetch(`${BASE}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: process.env.KEYCLOAK_ADMIN ?? 'admin', password: process.env.KEYCLOAK_ADMIN_CLAVE ?? 'admin' }),
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

// 6. Cuenta de servicio de Conecta (CU-10: una cuenta por cada llave de API)
if (!(await cliente('conecta-integraciones'))) {
  await json(
    await admin('/clients', {
      method: 'POST',
      body: JSON.stringify({
        clientId: 'conecta-integraciones',
        name: 'Conecta · llaves de API de las tiendas',
        publicClient: false,
        secret: SECRETO_CONECTA,
        serviceAccountsEnabled: true,
        standardFlowEnabled: false,
        directAccessGrantsEnabled: false,
      }),
    }),
  );
  console.log('Keycloak: creado conecta-integraciones');
}
const integraciones = await cliente('conecta-integraciones');
const cuentaDeConecta = await json(await admin(`/clients/${integraciones.id}/service-account-user`));
const necesitaConecta = disponibles.filter((r) => ['manage-clients', 'view-clients', 'query-clients', 'manage-users', 'view-users', 'query-users', 'view-realm'].includes(r.name));
const tieneConecta = await json(await admin(`/users/${cuentaDeConecta.id}/role-mappings/clients/${gestion.id}`));
const faltanConecta = necesitaConecta.filter((r) => !tieneConecta.some((t) => t.name === r.name));
if (faltanConecta.length) {
  await json(await admin(`/users/${cuentaDeConecta.id}/role-mappings/clients/${gestion.id}`, { method: 'POST', body: JSON.stringify(faltanConecta) }));
  console.log(`Keycloak: conecta-integraciones puede ${faltanConecta.map((r) => r.name).join(', ')}`);
}

// 7. Direcciones públicas de las webs (solo en la nube; en desarrollo no hay variables y no cambia nada)
const sinBarra = (u) => u.replace(/\/+$/, '');
const publicas = [
  ['abasto-panel', process.env.PANEL_URL, [process.env.GESTION_URL, process.env.INTELIGENCIA_URL]],
  ['abasto-superadmin', process.env.SUPERADMIN_URL, []],
];
for (const [clientId, url, extras] of publicas) {
  if (!url) continue;
  const c = await cliente(clientId);
  const origen = sinBarra(url);
  const redirige = `${origen}/*`;
  const origenes = [origen, ...extras.filter(Boolean).map(sinBarra)];
  const salida = (c.attributes?.['post.logout.redirect.uris'] ?? '').split('##').filter(Boolean);
  const faltaAlgo =
    !c.redirectUris.includes(redirige) || origenes.some((o) => !c.webOrigins.includes(o)) || !salida.includes(redirige);
  if (!faltaAlgo) continue;
  await json(
    await admin(`/clients/${c.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...c,
        rootUrl: origen,
        redirectUris: [...new Set([...c.redirectUris, redirige])],
        webOrigins: [...new Set([...c.webOrigins, ...origenes])],
        attributes: { ...c.attributes, 'post.logout.redirect.uris': [...new Set([...salida, redirige])].join('##') },
      }),
    }),
  );
  console.log(`Keycloak: ${clientId} acepta ${origen}`);
}

console.log('Keycloak al día');
