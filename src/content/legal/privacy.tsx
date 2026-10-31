import Link from "next/link"
import { SITE, legalHref } from "@/config/site"
import type { LegalContent } from "@/features/legal/components/legal-document"

const EMAIL = SITE.contact.email

function ContactEmail() {
  return <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
}

export const PRIVACY: LegalContent = {
  description: `Cómo ${SITE.info.name} recoge, usa, protege y borra tus datos personales y financieros, y cómo ejercer tus derechos bajo la Ley 1581 de 2012.`,
  sections: [
    {
      id: "responsable",
      title: "Responsable del tratamiento",
      content: (
        <>
          <p>
            El responsable del tratamiento de tus datos en la instancia oficial
            de {SITE.info.name} ({SITE.site.url}) es{" "}
            <strong>{SITE.author.name}</strong>, persona natural domiciliada en
            Colombia.
          </p>
          <p>
            Para cualquier asunto relacionado con tus datos personales puedes
            escribir a <ContactEmail />.
          </p>
          <p>
            Esta política se rige por la Ley 1581 de 2012, el Decreto 1377 de
            2013 y las demás normas colombianas de protección de datos
            personales.
          </p>
        </>
      )
    },
    {
      id: "datos-que-recogemos",
      title: "Datos que se recogen",
      content: (
        <>
          <p>
            {SITE.info.name} no se conecta a tu banco. Solo trata los datos que
            tú introduces o que nos entrega el proveedor con el que inicias
            sesión:
          </p>
          <ul>
            <li>
              <strong>Datos de cuenta y perfil:</strong> email, nombre, foto de
              perfil (avatar) y, si la usas, tu contraseña, que se guarda
              cifrada y nunca vemos en texto plano.
            </li>
            <li>
              <strong>Datos de proveedores de inicio de sesión:</strong> si
              entras con Google o GitHub, recibimos tu email, tu nombre y tu
              foto de perfil en ese servicio. No recibimos tu contraseña de esos
              servicios.
            </li>
            <li>
              <strong>Registros financieros:</strong> los movimientos, cuentas,
              categorías, presupuestos, gastos fijos, metas de ahorro, deudas y
              tarjetas, empresas y sus operaciones que registras, incluidas las
              filas que importas desde archivos Excel o CSV. El archivo se lee
              en tu navegador y no se guarda; solo se guardan las filas que
              confirmas.
            </li>
            <li>
              <strong>Preferencias:</strong> la moneda en la que ves los montos
              y el tema claro u oscuro de la interfaz.
            </li>
          </ul>
          <p>
            No pedimos datos sensibles como origen étnico, salud, orientación
            sexual o datos biométricos. Te pedimos no incluirlos en las notas o
            descripciones de tus registros.
          </p>
        </>
      )
    },
    {
      id: "finalidad",
      title: "Para qué se usan",
      content: (
        <>
          <p>Tus datos se usan solo para:</p>
          <ul>
            <li>crear y mantener tu cuenta y permitirte iniciar sesión;</li>
            <li>
              prestar el servicio: guardar tus registros y calcular dentro de tu
              cuenta las gráficas, reportes, el score de salud financiera y las
              recomendaciones;
            </li>
            <li>
              enviarte emails de autenticación, como la confirmación de tu
              cuenta, el cambio de email o la recuperación de contraseña;
            </li>
            <li>atender las solicitudes que nos envíes.</li>
          </ul>
          <p>
            <strong>
              Tus datos financieros no se venden, no se comparten con fines
              publicitarios y no se usan para entrenar modelos de inteligencia
              artificial.
            </strong>{" "}
            El score y las recomendaciones se calculan con reglas fijas sobre
            tus propios registros.
          </p>
          <p>No enviamos emails de publicidad ni boletines.</p>
        </>
      )
    },
    {
      id: "encargados",
      title: "Encargados y transferencia internacional",
      content: (
        <>
          <p>
            Para funcionar, {SITE.info.name} se apoya en proveedores que tratan
            tus datos por cuenta nuestra y solo para prestar el servicio:
          </p>
          <ul>
            <li>
              <strong>Supabase:</strong> base de datos, autenticación y
              almacenamiento de archivos (avatares).
            </li>
            <li>
              <strong>Proveedor de hosting de la aplicación:</strong> sirve las
              páginas y ejecuta el código del servidor.
            </li>
          </ul>
          <p>
            Sus servidores pueden estar fuera de Colombia, por lo que tus datos
            se transfieren a otros países. Al aceptar esta política autorizas
            esa transferencia, que se hace con proveedores que ofrecen medidas
            de seguridad adecuadas.
          </p>
          <p>
            Si inicias sesión con Google o GitHub, el tratamiento que esos
            servicios hagan de tus datos se rige por sus propias políticas.
          </p>
        </>
      )
    },
    {
      id: "cookies",
      title: "Cookies y almacenamiento local",
      content: (
        <>
          <p>{SITE.info.name} solo usa lo estrictamente necesario:</p>
          <ul>
            <li>
              <strong>Cookies de sesión de Supabase</strong>, para mantenerte
              autenticado.
            </li>
            <li>
              <strong>Preferencias de interfaz</strong>: el tema claro u oscuro
              en el almacenamiento local de tu navegador y el estado del menú
              lateral del dashboard en una cookie.
            </li>
          </ul>
          <p>
            No usamos analítica, píxeles de seguimiento ni cookies de terceros.
          </p>
        </>
      )
    },
    {
      id: "seguridad",
      title: "Seguridad",
      content: (
        <>
          <p>Algunas de las medidas que protegen tus datos:</p>
          <ul>
            <li>
              Cada tabla con datos de usuario tiene seguridad a nivel de fila:
              la base de datos solo te deja leer y modificar tus propios
              registros y los de tus espacios.
            </li>
            <li>Toda la comunicación viaja cifrada por HTTPS.</li>
            <li>
              Las claves con privilegios de administración nunca llegan a tu
              navegador.
            </li>
            <li>
              El código es abierto, así que cualquiera puede revisar cómo se
              tratan los datos en el{" "}
              <a
                href={SITE.repository.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                repositorio
              </a>
              .
            </li>
          </ul>
          <p>
            Tu foto de perfil se guarda en un almacenamiento público: cualquiera
            que conozca su dirección exacta puede verla.
          </p>
          <p>
            Ningún sistema es infalible. Si detectas una vulnerabilidad,
            repórtala de forma privada según la{" "}
            <a
              href={SITE.repository.security}
              target="_blank"
              rel="noopener noreferrer"
            >
              política de seguridad
            </a>{" "}
            del proyecto.
          </p>
        </>
      )
    },
    {
      id: "conservacion-y-borrado",
      title: "Conservación y borrado",
      content: (
        <>
          <p>
            Conservamos tus datos mientras tengas una cuenta. Puedes borrarla
            cuando quieras desde la sección Cuenta del dashboard:
          </p>
          <ul>
            <li>
              Al pedir el borrado, tu foto de perfil se elimina de inmediato y
              tu cuenta queda programada para borrarse en{" "}
              {SITE.accountDeletionGraceDays} días. Durante ese plazo puedes
              iniciar sesión y restaurarla.
            </li>
            <li>
              Pasado el plazo, un proceso automático borra la cuenta y todos sus
              datos, incluidos los registros financieros de todos tus espacios.
            </li>
            <li>
              Si borras una empresa, queda programada para borrarse en{" "}
              {SITE.workspaceDeletionGraceDays} días, con la misma posibilidad
              de restaurarla, y luego se purga con todos sus datos.
            </li>
          </ul>
          <p>
            Las copias de seguridad del proveedor de base de datos pueden
            conservar datos borrados durante un tiempo limitado hasta que se
            renuevan.
          </p>
        </>
      )
    },
    {
      id: "derechos",
      title: "Tus derechos",
      content: (
        <>
          <p>Como titular de tus datos tienes derecho a:</p>
          <ul>
            <li>conocer los datos que tenemos sobre ti;</li>
            <li>actualizarlos y rectificarlos;</li>
            <li>pedir que se supriman;</li>
            <li>revocar la autorización que diste para tratarlos;</li>
            <li>
              pedir prueba de esa autorización y ser informado del uso que se
              les da.
            </li>
          </ul>
          <p>
            Muchos de estos derechos los puedes ejercer tú mismo desde la
            aplicación: editar tu perfil, corregir o borrar registros y borrar
            tu cuenta. Para lo demás, escribe a <ContactEmail /> desde el email
            de tu cuenta, indicando tu solicitud.
          </p>
          <p>
            Respondemos las <strong>consultas</strong> en un máximo de 10 días
            hábiles y los <strong>reclamos</strong> en un máximo de 15 días
            hábiles, prorrogables en los casos que prevé la Ley 1581 de 2012.
          </p>
          <p>
            Si consideras que no atendimos tu solicitud, puedes presentar una
            queja ante la Superintendencia de Industria y Comercio (SIC).
          </p>
        </>
      )
    },
    {
      id: "menores",
      title: "Menores de edad",
      content: (
        <p>
          {SITE.info.name} es solo para mayores de 18 años. No permitimos el
          registro de menores de edad. Si sabemos que una cuenta pertenece a un
          menor, la borraremos.
        </p>
      )
    },
    {
      id: "instancias-propias",
      title: "Instancias propias",
      content: (
        <p>
          El código de {SITE.info.name} es abierto bajo licencia{" "}
          {SITE.info.license}. Esta política aplica solo a la instancia oficial.
          Quien despliegue su propia copia es el responsable de los datos que se
          traten en ella y debe ofrecer su propia política de privacidad.
        </p>
      )
    },
    {
      id: "cambios",
      title: "Cambios a esta política",
      content: (
        <>
          <p>
            Podemos actualizar esta política cuando cambie el servicio o la ley.
            La fecha de &quot;Última actualización&quot; indica la versión
            vigente. Si el cambio es importante, lo avisaremos en la aplicación
            o por email antes de que entre en vigor.
          </p>
          <p>
            Consulta también los{" "}
            <Link href={legalHref("terms")}>Términos y Condiciones</Link>.
          </p>
        </>
      )
    }
  ]
}
