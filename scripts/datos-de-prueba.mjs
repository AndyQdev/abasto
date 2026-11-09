// Llena el sistema con datos para probarlo de punta a punta, usando el sistema mismo (GraphQL por el Router,
// como lo haría la app o el Panel). Cada pedido pasa por la saga real: Pedidos → Catálogo → Cobros, y sus eventos
// llegan a Reportes. Así los datos quedan coherentes en las tres nubes, cosa que un INSERT a mano no logra.
//
//   node scripts/datos-de-prueba.mjs              todo: tiendas nuevas, clientes, crédito, pedidos en cada estado,
//                                                 pagos, reclamos, un mayorista por verificar y pedidos por WhatsApp
//   node scripts/datos-de-prueba.mjs pendientes   solo pedidos «por confirmar» frescos (vencen a las 2 h)
//
// Por defecto va contra la nube. Para la máquina local: ABASTO_ROUTER=http://localhost:4000/
// ABASTO_KEYCLOAK=http://localhost:8180/realms/abasto ABASTO_N8N=http://localhost:5678
// Ojo: los celulares de las tiendas son de mentira (7700000x). Si el envío de códigos por WhatsApp ya está
// conectado, no lo corras: le mandaría un código a esos números.
import { randomUUID } from 'node:crypto';

const ROUTER = process.env.ABASTO_ROUTER ?? 'https://api.34-136-24-10.sslip.io/';
const KEYCLOAK = process.env.ABASTO_KEYCLOAK ?? 'https://auth.34-136-24-10.sslip.io/realms/abasto';
const N8N = process.env.ABASTO_N8N ?? 'https://n8n.3-140-59-13.sslip.io';
const CLAVE = 'abasto123';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function gql(token, query, variables = {}) {
  const r = await fetch(ROUTER, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors?.length) throw new Error(j.errors.map((e) => e.message).join(' | '));
  return j.data;
}

/** Usuarios del Panel y del Superadmin: usuario y clave (cliente de pruebas de Keycloak). */
async function entrar(usuario) {
  const r = await fetch(`${KEYCLOAK}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'password', client_id: 'abasto-pruebas', username: usuario, password: CLAVE }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`No pude entrar como ${usuario}: ${j.error_description ?? j.error}`);
  return j.access_token;
}

/** Tiendas de la app: entran con el celular y el código (en modo prueba el código vuelve en la respuesta). */
async function entrarConCelular(telefono, nombre, tipo, subtipo) {
  const { pedirCodigo } = await gql(null, 'mutation($t:String!){ pedirCodigo(telefono:$t){ codigoDePrueba } }', { t: telefono });
  if (!pedirCodigo.codigoDePrueba) throw new Error('El servidor no está en modo prueba: no hay código que usar');
  const { entrarConCodigo } = await gql(
    null,
    'mutation($t:String!,$c:String!,$n:String){ entrarConCodigo(telefono:$t,codigo:$c,nombre:$n){ tokenDeAcceso } }',
    { t: telefono, c: pedirCodigo.codigoDePrueba, n: nombre },
  );
  const token = entrarConCodigo.tokenDeAcceso;
  await gql(token, 'mutation($t:String!,$s:String){ elegirTipoDeNegocio(tipo:$t,subtipo:$s){ tipo } }', { t: tipo, s: subtipo ?? null });
  const { miOrganizacion } = await gql(token, '{ miOrganizacion { id } }');
  return { token, id: miOrganizacion.id, nombre };
}

const catalogos = new Map();
/** Productos que esa tienda puede comprarle a ese mayorista (activos, con precio a la vista y stock). */
async function productosDe(tienda, mayoristaId) {
  const llave = `${tienda.id}|${mayoristaId}`;
  if (!catalogos.has(llave)) {
    const { productos } = await gql(
      tienda.token,
      'query($m:ID){ productos(mayoristaId:$m){ id nombre stock estado precioVisible abastecimiento escalas { presentacion cantidad } } }',
      { m: mayoristaId },
    );
    catalogos.set(
      llave,
      productos.filter((p) => p.estado === 'ACTIVO' && p.precioVisible && p.escalas.length && (p.stock > 50 || p.abastecimiento === 'BAJO_PEDIDO')),
    );
  }
  return catalogos.get(llave);
}

let turno = 0;
async function pedir(tienda, mayoristaId, metodoPago, productos = 2) {
  const lista = await productosDe(tienda, mayoristaId);
  if (lista.length < productos) throw new Error(`${tienda.nombre} no ve productos de ${mayoristaId}`);
  const lineas = Array.from({ length: productos }, (_, i) => {
    const p = lista[(turno + i * 3) % lista.length];
    return { productoId: p.id, presentacion: p.escalas[0].presentacion, cantidad: 1 + ((turno + i) % 3) };
  });
  turno += 5;
  const { crearPedido } = await gql(
    tienda.token,
    'mutation($e:CrearPedidoEntrada!){ crearPedido(entrada:$e){ id codigo } }',
    {
      e: {
        clave: randomUUID(),
        mayoristaId,
        metodoPago,
        lineas,
        entrega: { calle: 'Av. Busch 1450', zona: 'Equipetrol', referencia: 'Frente al mercado', latitud: -17.7713, longitud: -63.1838 },
      },
    },
  );
  const pedido = { ...crearPedido, tienda, mayoristaId, metodoPago };
  if (metodoPago === 'QR') {
    await hasta(tienda, pedido, (p) => p.cobro);
    await gql(tienda.token, 'mutation($id:ID!){ pagarQrDePrueba(pedidoId:$id){ estado } }', { id: pedido.id });
  }
  const p = await hasta(tienda, pedido, (x) => x.estado !== 'PENDIENTE');
  pedido.total = p.total.centavos;
  console.log(`  ${pedido.codigo} · ${tienda.nombre} → ${mayoristaId} · ${metodoPago} · ${p.estado}`);
  return pedido;
}

/** La saga es asíncrona: espera a que el pedido llegue a donde corresponde. */
async function hasta(tienda, pedido, listo, segundos = 90) {
  for (let i = 0; i < segundos; i++) {
    const { pedido: p } = await gql(tienda.token, 'query($id:ID!){ pedido(id:$id){ estado total { centavos } cobro { estado } } }', { id: pedido.id });
    if (p && listo(p)) return p;
    await esperar(1000);
  }
  throw new Error(`${pedido.codigo} no avanzó a tiempo`);
}

const confirmar = (m, p) => gql(m, 'mutation($id:ID!){ confirmarPedido(id:$id){ estado } }', { id: p.id });
const rechazar = (m, p, motivo) => gql(m, 'mutation($id:ID!,$m:String!){ rechazarPedido(id:$id,motivo:$m){ estado } }', { id: p.id, m: motivo });
async function avanzar(m, p, veces) {
  for (let i = 0; i < veces; i++) await gql(m, 'mutation($id:ID!){ avanzarEntrega(id:$id){ estado } }', { id: p.id });
}
/** confirmar → EN_PREPARACION (1) → DESPACHADO (2) → ENTREGADO (3) */
async function llevarHasta(m, p, pasos) {
  await confirmar(m, p);
  await esperar(1500);
  await avanzar(m, p, pasos);
}

async function pagar(m, p, centavos, forma) {
  // La cuenta por cobrar la abre Cobros al escuchar pedido.confirmado: puede tardar un momento
  for (let i = 0; i < 30; i++) {
    try {
      await gql(m, 'mutation($e:RegistrarPagoEntrada!){ registrarPago(entrada:$e){ estado } }', {
        e: { pagoId: randomUUID(), pedidoId: p.id, centavos, forma, nota: 'Cargado por datos-de-prueba' },
      });
      return;
    } catch (e) {
      if (i === 29) throw e;
      await esperar(1000);
    }
  }
}

async function todo() {
  console.log('Entrando como los usuarios del Panel…');
  const [lospozos, ventas, laramada, admin] = await Promise.all(
    ['lospozos@abasto.bo', 'ventas@abasto.bo', 'laramada@abasto.bo', 'admin@abasto.bo'].map(entrar),
  );
  const donarosa = { token: await entrar('donarosa@abasto.bo'), id: 'dr', nombre: 'Tienda Doña Rosa' };
  const lospozosTienda = { token: lospozos, id: 'lp', nombre: 'Distribuidora Los Pozos (como tienda)' };

  console.log('Tiendas nuevas desde la app (celular + código)…');
  const lucho = await entrarConCelular('77000001', 'Tienda Don Lucho', 'tienda');
  const saltenas = await entrarConCelular('77000002', 'Salteñería La Cochabambina', 'productor', 'salteneria');
  const juana = await entrarConCelular('77000003', 'Pensión Doña Juana', 'productor', 'pension');
  const palmas = await entrarConCelular('77000004', 'Minimarket Las Palmas', 'tienda');
  const panaderia = await entrarConCelular('77000005', 'Panadería San Antonio', 'productor', 'panaderia');
  const rojas = await entrarConCelular('77000006', 'Familia Rojas', 'hogar');

  console.log('Red privada: piden ser clientes, Los Pozos aprueba y da crédito…');
  const pedirSer = (t, m) => gql(t.token, 'mutation($m:ID!){ pedirSerCliente(mayoristaId:$m){ estado } }', { m }).catch(() => undefined);
  for (const t of [lucho, saltenas, juana, palmas]) await pedirSer(t, 'lp');
  await pedirSer(panaderia, 'lr');
  const aprobar = (t, lista) => gql(lospozos, 'mutation($t:ID!,$l:ListaDePrecios!){ aprobarCliente(tiendaId:$t,lista:$l){ estado } }', { t: t.id, l: lista });
  await aprobar(lucho, 'FRECUENTES');
  await aprobar(saltenas, 'NUEVOS');
  await aprobar(juana, 'VIP');
  // Minimarket Las Palmas queda SOLICITADA (para aprobarla en la prueba) y Panadería San Antonio espera a La Ramada
  const credito = (t, bs, dias) =>
    gql(lospozos, 'mutation($e:AsignarCreditoEntrada!){ asignarCredito(entrada:$e){ limite { centavos } } }', {
      e: { tiendaId: t.id, limiteCentavos: bs * 100, plazoDias: dias },
    });
  await credito(lucho, 5000, 15);
  await credito(saltenas, 1500, 15);
  await credito(juana, 3000, 30);

  console.log('Pedidos a Distribuidora Los Pozos…');
  const a = await pedir(lucho, 'lp', 'CREDITO', 3);
  await llevarHasta(lospozos, a, 3);
  await pagar(lospozos, a, Math.round(a.total / 2), 'EFECTIVO'); // pagó la mitad
  const b = await pedir(lucho, 'lp', 'QR');
  await llevarHasta(lospozos, b, 2); // en camino
  const c = await pedir(saltenas, 'lp', 'CREDITO');
  await llevarHasta(lospozos, c, 1); // en preparación
  const d = await pedir(juana, 'lp', 'CREDITO', 3);
  await llevarHasta(lospozos, d, 3);
  await pagar(lospozos, d, d.total, 'TRANSFERENCIA'); // pagada: recupera el cupo
  const e = await pedir(juana, 'lp', 'CONTRA_ENTREGA');
  await llevarHasta(lospozos, e, 3);
  await pagar(lospozos, e, e.total, 'EFECTIVO');
  const f = await pedir(saltenas, 'lp', 'QR');
  await rechazar(lospozos, f, 'Nos quedamos sin stock de ese producto'); // la saga devuelve el QR
  const g = await pedir(lucho, 'lp', 'CONTRA_ENTREGA');
  await llevarHasta(lospozos, g, 3);
  const h = await pedir(donarosa, 'lp', 'CONTRA_ENTREGA');
  await confirmar(lospozos, h); // confirmado, falta prepararlo

  console.log('Pedidos a Abasto (vendedor de la casa)…');
  const i = await pedir(rojas, 'abasto', 'QR', 3);
  await llevarHasta(ventas, i, 3);
  const j = await pedir(panaderia, 'abasto', 'CONTRA_ENTREGA', 3);
  await llevarHasta(ventas, j, 2);
  const k = await pedir(palmas, 'abasto', 'CONTRA_ENTREGA');
  await llevarHasta(ventas, k, 1);
  const l = await pedir(saltenas, 'abasto', 'CONTRA_ENTREGA');
  await rechazar(ventas, l, 'No hacemos entregas en esa zona');
  const m = await pedir(rojas, 'abasto', 'CONTRA_ENTREGA');
  await llevarHasta(ventas, m, 3);

  console.log('Pedidos a Importadora La Ramada (Los Pozos le compra como tienda)…');
  const n = await pedir(lospozosTienda, 'lr', 'QR');
  await llevarHasta(laramada, n, 3);
  const o = await pedir(lospozosTienda, 'lr', 'CONTRA_ENTREGA');
  await confirmar(laramada, o);

  console.log('Reclamos (CU-16)…');
  const reclamo = (t, p, motivo, detalle) =>
    gql(t.token, 'mutation($e:AbrirReclamoEntrada!){ abrirReclamo(entrada:$e){ id } }', { e: { pedidoId: p.id, motivo, detalle } });
  await reclamo(lucho, g, 'INCOMPLETO', 'Llegó una caja menos'); // queda ABIERTO para resolverlo en el Superadmin
  const { abrirReclamo: r2 } = await reclamo(rojas, i, 'DANADO', 'Una bolsa de arroz llegó rota');
  await gql(admin, 'mutation($e:ResolverReclamoEntrada!){ resolverReclamo(entrada:$e){ estado } }', {
    e: { reclamoId: r2.id, aprobado: true, devueltoCentavos: 2000, forma: 'QR', respuesta: 'Te devolvimos Bs 20 por la bolsa rota.' },
  });

  console.log('Un mayorista nuevo esperando que Abasto lo verifique (CU-01)…');
  await gql(null, 'mutation($e:RegistrarMayoristaEntrada!){ registrarMayorista(entrada:$e){ estadoVerificacion } }', {
    e: {
      empresa: 'Distribuidora El Sol',
      nit: '4012345017',
      ciudad: 'Santa Cruz',
      representante: 'Carla Méndez',
      telefono: '77000009',
      correo: 'elsol@abasto.bo',
      clave: CLAVE,
    },
  }).catch((e) => console.log(`  (ya estaba: ${e.message})`));

  console.log('Pedidos por WhatsApp (n8n → Conecta → Pedidos, CU-11)…');
  const idWhatsapp = `wamid.datos.${Date.now()}`;
  for (const id of [idWhatsapp, idWhatsapp, `${idWhatsapp}.2`]) {
    const r = await fetch(`${N8N}/webhook/pedido-whatsapp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mensajeId: id, telefono: '+59170000000', texto: '2 unidades AB-101, 1 unidad AB-102' }),
    });
    const j = await r.json().catch(() => ({}));
    console.log(`  mensaje ${id.slice(-6)} → ${j.estado}${j.respuesta?.codigo ? ` (${j.respuesta.codigo})` : ''}`);
  }

  await pendientes();
}

/** Pedidos «por confirmar»: el mayorista tiene 2 horas; después la saga los rechaza sola. */
async function pendientes() {
  console.log('Pedidos por confirmar (vencen a las 2 h)…');
  const lucho = await entrarConCelular('77000001', 'Tienda Don Lucho', 'tienda');
  const rojas = await entrarConCelular('77000006', 'Familia Rojas', 'hogar');
  const lospozosTienda = { token: await entrar('lospozos@abasto.bo'), id: 'lp', nombre: 'Distribuidora Los Pozos (como tienda)' };
  await pedir(lucho, 'lp', 'CREDITO');
  await pedir(lucho, 'lp', 'QR');
  await pedir(rojas, 'abasto', 'CONTRA_ENTREGA');
  await pedir(lospozosTienda, 'lr', 'CONTRA_ENTREGA');
}

const inicio = Date.now();
await (process.argv[2] === 'pendientes' ? pendientes() : todo());
console.log(`\nListo en ${Math.round((Date.now() - inicio) / 1000)} s`);
