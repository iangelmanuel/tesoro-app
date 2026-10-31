import Link from "next/link"
import { SITE, legalHref } from "@/config/site"
import type { LegalContent } from "@/features/legal/components/legal-document"

const EMAIL = SITE.contact.email

export const TERMS: LegalContent = {
  description: `Condiciones de uso de la instancia oficial de ${SITE.info.name}: qué ofrece el servicio, qué esperamos de ti y los límites de nuestra responsabilidad.`,
  sections: [
    {
      id: "aceptacion",
      title: "Aceptación",
      content: (
        <>
          <p>
            Estos términos regulan el uso de la instancia oficial de{" "}
            {SITE.info.name} ({SITE.site.url}), ofrecida por{" "}
            <strong>{SITE.author.name}</strong>, persona natural domiciliada en
            Colombia.
          </p>
          <p>
            Al crear tu cuenta, con email o con Google o GitHub, aceptas estos
            términos y la{" "}
            <Link href={legalHref("privacy")}>Política de Privacidad</Link>. Si
            no estás de acuerdo, no crees una cuenta.
          </p>
        </>
      )
    },
    {
      id: "servicio",
      title: "Descripción del servicio",
      content: (
        <>
          <p>
            {SITE.info.name} es una herramienta para organizar tus finanzas
            personales y las de tu negocio: registras ingresos, gastos, deudas y
            metas, y la aplicación los presenta en gráficas, reportes, un score
            de salud financiera y recomendaciones.
          </p>
          <p>
            <strong>
              {SITE.info.name} no es asesoría financiera, contable, tributaria
              ni legal.
            </strong>{" "}
            El score y las recomendaciones son orientativos, se calculan con
            reglas fijas y dependen de que tus registros estén completos y
            correctos. Antes de tomar decisiones importantes, consulta a un
            profesional.
          </p>
        </>
      )
    },
    {
      id: "cuenta",
      title: "Tu cuenta",
      content: (
        <ul>
          <li>Debes ser mayor de 18 años para crear una cuenta.</li>
          <li>Los datos que nos des al registrarte deben ser veraces.</li>
          <li>
            Eres responsable de guardar tu contraseña y de lo que se haga desde
            tu cuenta. Si crees que alguien entró sin permiso, cambia tu
            contraseña y escríbenos.
          </li>
          <li>Cada cuenta es personal y no se puede ceder.</li>
        </ul>
      )
    },
    {
      id: "uso-aceptable",
      title: "Uso aceptable",
      content: (
        <>
          <p>No está permitido:</p>
          <ul>
            <li>usar el servicio para fines ilegales o fraudulentos;</li>
            <li>
              intentar acceder a cuentas o datos de otras personas, o a partes
              del sistema a las que no tienes acceso;
            </li>
            <li>
              abusar de la infraestructura: automatizar peticiones masivas,
              sobrecargar el servicio o interferir con su funcionamiento;
            </li>
            <li>
              usar el servicio para almacenar contenido que no sea información
              financiera tuya o de tu negocio.
            </li>
          </ul>
          <p>
            Si encuentras una vulnerabilidad, repórtala de forma privada según
            la{" "}
            <a
              href={SITE.repository.security}
              target="_blank"
              rel="noopener noreferrer"
            >
              política de seguridad
            </a>{" "}
            del proyecto, sin explotarla.
          </p>
        </>
      )
    },
    {
      id: "contenido",
      title: "Tu contenido",
      content: (
        <>
          <p>
            Los registros que introduces son tuyos. Nos das solo una licencia
            limitada, no exclusiva y gratuita para guardarlos, procesarlos y
            mostrártelos con el único fin de prestarte el servicio.
          </p>
          <p>
            Esa licencia termina cuando borras los registros o tu cuenta, con
            los plazos descritos en la Política de Privacidad.
          </p>
        </>
      )
    },
    {
      id: "gratuidad",
      title: "Gratuidad y disponibilidad",
      content: (
        <>
          <p>
            {SITE.info.name} es gratuito. Se ofrece tal como está, sin un
            acuerdo de nivel de servicio: puede tener interrupciones, errores o
            pérdidas de disponibilidad.
          </p>
          <p>
            Podemos cambiar, limitar o suspender funciones, o el servicio
            completo. Si decidimos cerrarlo, avisaremos con antelación razonable
            para que puedas guardar tu información.
          </p>
        </>
      )
    },
    {
      id: "codigo-abierto",
      title: "Código abierto",
      content: (
        <p>
          El código de {SITE.info.name} está publicado bajo licencia{" "}
          {SITE.info.license} en su{" "}
          <a
            href={SITE.repository.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            repositorio
          </a>
          . Estos términos rigen solo la instancia oficial. Las copias o forks
          que despliegue otra persona se rigen por sus propias condiciones, y no
          respondemos por ellas.
        </p>
      )
    },
    {
      id: "responsabilidad",
      title: "Sin garantías y limitación de responsabilidad",
      content: (
        <>
          <p>
            En la medida que lo permita la ley colombiana, el servicio se ofrece
            sin garantías de ningún tipo, expresas o implícitas, incluidas las
            de exactitud de los cálculos o de adecuación a un fin concreto.
          </p>
          <p>
            En la misma medida, no somos responsables por decisiones que tomes
            con base en la información de la aplicación, ni por daños
            indirectos, pérdida de datos o lucro cesante derivados del uso o de
            la imposibilidad de usar el servicio.
          </p>
          <p>
            Nada de esto limita los derechos que la ley te reconoce y que no se
            pueden renunciar.
          </p>
        </>
      )
    },
    {
      id: "terminacion",
      title: "Terminación y borrado de cuenta",
      content: (
        <>
          <p>
            Puedes dejar de usar {SITE.info.name} y borrar tu cuenta cuando
            quieras desde la sección Cuenta del dashboard. La cuenta queda
            programada para borrarse en {SITE.accountDeletionGraceDays} días,
            plazo en el que puedes restaurarla; después se borra con todos sus
            datos.
          </p>
          <p>
            Podemos suspender o cerrar una cuenta que incumpla estos términos,
            en especial las reglas de uso aceptable, avisándote por email cuando
            sea posible.
          </p>
        </>
      )
    },
    {
      id: "ley-aplicable",
      title: "Ley aplicable",
      content: (
        <p>
          Estos términos se rigen por las leyes de la República de Colombia.
          Cualquier controversia se intentará resolver primero de forma directa
          escribiéndonos; si no es posible, se someterá a los jueces competentes
          de Colombia.
        </p>
      )
    },
    {
      id: "cambios-y-contacto",
      title: "Cambios y contacto",
      content: (
        <>
          <p>
            Podemos actualizar estos términos. La fecha de &quot;Última
            actualización&quot; indica la versión vigente. Si el cambio es
            importante, lo avisaremos en la aplicación o por email antes de que
            entre en vigor. Seguir usando el servicio después de ese aviso
            implica que aceptas los nuevos términos.
          </p>
          <p>
            Para cualquier pregunta escribe a{" "}
            <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
          </p>
        </>
      )
    }
  ]
}
