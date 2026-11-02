import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { Server } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { CanalDeTiendas } from '../../aplicacion/canal-de-tiendas.js';
import { verificarToken } from '../../infraestructura/seguridad/autenticacion.guard.js';
import { atenderConexion } from './conexion.js';

export const RUTA_TIEMPO_REAL = '/v1/tiempo-real';
/** Cada cuánto se comprueba que el teléfono sigue ahí (ping/pong del protocolo WebSocket) */
const LATIDO_MS = 25_000;

/**
 * El WebSocket de la app de clientes, en el mismo puerto que la API de Conecta (8084). Reemplaza al sondeo:
 * la app ya no pregunta cada pocos segundos, Conecta le avisa cuando cambia un pedido suyo.
 */
@Injectable()
export class ServidorDeTiempoReal implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger(ServidorDeTiempoReal.name);
  private servidor?: WebSocketServer;
  private latido?: ReturnType<typeof setInterval>;

  constructor(
    @Inject(HttpAdapterHost) private readonly http: HttpAdapterHost,
    @Inject(CanalDeTiendas) private readonly canal: CanalDeTiendas,
  ) {}

  onApplicationBootstrap() {
    const servidorHttp = this.http.httpAdapter.getHttpServer() as Server;
    this.servidor = new WebSocketServer({ server: servidorHttp, path: RUTA_TIEMPO_REAL, maxPayload: 16 * 1024 });
    const vivos = new WeakMap<WebSocket, boolean>();
    this.servidor.on('connection', (socket) => {
      vivos.set(socket, true);
      socket.on('pong', () => vivos.set(socket, true));
      atenderConexion(socket, { verificar: verificarToken, canal: this.canal });
    });
    this.latido = setInterval(() => {
      for (const socket of this.servidor?.clients ?? []) {
        if (!vivos.get(socket)) {
          socket.terminate();
          continue;
        }
        vivos.set(socket, false);
        socket.ping();
      }
    }, LATIDO_MS);
    this.log.log(`Tiempo real en ws://…${RUTA_TIEMPO_REAL}`);
  }

  onModuleDestroy() {
    clearInterval(this.latido);
    for (const socket of this.servidor?.clients ?? []) socket.terminate();
    this.servidor?.close();
  }
}
