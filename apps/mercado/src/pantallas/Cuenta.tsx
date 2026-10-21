import { APPS, type Usuario } from '@abasto/sesion';
import { sesion } from '../servicios';

export function Cuenta({ usuario }: { usuario: Usuario }) {
  return (
    <section className="pantalla">
      <h1 className="titulo-pantalla">Cuenta</h1>
      <div className="carta">
        <strong>{usuario.orgNombre || usuario.orgId}</strong>
        <span className="gris">{usuario.correo}</span>
      </div>

      {usuario.roles.includes('mayorista') && (
        <div className="carta">
          <strong>También vendes en Abasto</strong>
          <p className="gris">Entra al Panel Mayorista con esta misma sesión.</p>
          <a className="boton-secundario enlace" href={APPS.panel}>
            Ir al Panel Mayorista
          </a>
        </div>
      )}

      <div className="carta">
        <strong>Conecta tu tienda online</strong>
        <p className="gris">Llaves de API y webhooks para tu WooCommerce u otro e-commerce. Se construye en la fase F3.</p>
      </div>

      <button className="boton-secundario ancho" onClick={() => void sesion.cerrar()}>
        Cerrar sesión
      </button>
    </section>
  );
}
