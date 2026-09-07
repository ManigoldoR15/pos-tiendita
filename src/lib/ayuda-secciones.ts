// Textos del modo tutorial — datos puros, seguro para importar desde Client Components.
//
// Para agregar una sección nueva basta con escribir su entrada aquí: el
// componente <AyudaSeccion /> la levanta sola por la ruta, no hay que tocar
// la pantalla ni el layout.
//
// Reglas de redacción (el lector es un tendero, no un usuario de software):
//  - Nada de jerga: no "registro", no "módulo", no "transacción".
//  - `queEs` explica para qué sirve la pantalla en la vida real de la tienda.
//  - `puedes` son acciones concretas, no funciones abstractas.
//  - `empiezaPor` es el siguiente paso cuando no sabe por dónde entrarle.

export type Ayuda = {
  titulo: string
  queEs: string
  puedes: string[]
  empiezaPor?: string
}

export const AYUDA_SECCIONES: Record<string, Ayuda> = {
  '/': {
    titulo: 'Inicio: el resumen de tu día',
    queEs:
      'Es la pantalla que ves al entrar. Te dice cómo va el negocio hoy: cuánto has vendido, cuánto has gastado y cuánto te queda de ganancia.',
    puedes: [
      'Ver las ventas de hoy, de la semana o del mes',
      'Ver qué productos se te están acabando',
      'Entrar rápido a cobrar o a la caja',
    ],
    empiezaPor:
      'Si los números están en cero es normal: se llenan solos conforme vayas cobrando en el POS.',
  },

  '/pos': {
    titulo: 'POS: aquí cobras',
    queEs:
      'Es tu caja registradora y la pantalla que más vas a usar. Le picas a los productos que se lleva el cliente y te dice cuánto es y cuánto cambio darle.',
    puedes: [
      'Tocar los productos que se lleva el cliente para irlos sumando',
      'Buscarlos por nombre o pasar el código de barras',
      'Cobrar en efectivo, tarjeta o transferencia, y ver el cambio',
      'Dejarlo fiado si el cliente te va a pagar después',
    ],
    empiezaPor:
      'Aquí solo salen los productos que ya diste de alta. Si esta pantalla se ve vacía, ve primero a Productos.',
  },

  '/productos': {
    titulo: 'Productos: todo lo que vendes',
    queEs:
      'Es la lista de la mercancía de tu tienda. Si un producto no está en esta lista, no lo vas a poder cobrar en el POS.',
    puedes: [
      'Dar de alta un producto nuevo con su precio',
      'Cambiar precios cuando te suba el proveedor',
      'Ver a cuáles ya se les está acabando la existencia',
      'Subir muchos de golpe desde un archivo de Excel',
    ],
    empiezaPor:
      'Da de alta los 20 o 30 productos que más vendes. Con eso ya puedes trabajar; los demás los vas agregando poco a poco.',
  },

  '/productos/importar': {
    titulo: 'Importar: subir muchos productos de un jalón',
    queEs:
      'Si tienes que capturar cientos de productos, aquí los subes todos juntos desde un archivo de Excel en lugar de uno por uno.',
    puedes: [
      'Descargar el archivo de ejemplo para saber cómo llenarlo',
      'Llenarlo en Excel con nombre, precio y existencia',
      'Subirlo y revisar la lista antes de guardarla',
    ],
    empiezaPor:
      'Baja primero el archivo de ejemplo. Respeta los títulos de las columnas y no vas a tener problema.',
  },

  '/ventas': {
    titulo: 'Ventas: el historial de lo que has cobrado',
    queEs:
      'Aquí queda guardado un ticket de cada venta que hiciste, con la fecha, quién la cobró y qué se llevó el cliente.',
    puedes: [
      'Buscar las ventas de un día en particular',
      'Ver el detalle: qué llevaba el cliente y cómo pagó',
      'Reimprimir el ticket',
      'Cancelar una venta mal hecha, la mercancía regresa al inventario',
    ],
    empiezaPor:
      'Úsala cuando un cliente reclame algo o cuando no te cuadre la caja: aquí ves venta por venta qué pasó.',
  },

  '/corte': {
    titulo: 'Caja: abrir y cerrar el día',
    queEs:
      'Sirve para saber si el dinero del cajón cuadra con lo que vendiste. En la mañana anotas con cuánto empiezas; en la noche cuentas el efectivo y el sistema te dice si falta o sobra.',
    puedes: [
      'Abrir la caja con el fondo con el que empiezas el día',
      'Ver cuánto efectivo deberías tener en este momento',
      'Cerrar el día contando el dinero real del cajón',
      'Ver el faltante o el sobrante',
    ],
    empiezaPor:
      'Ábrela cada mañana antes de la primera venta y ciérrala al terminar. Al cerrar, anota el dinero que de verdad contaste: si pones cero, el sistema va a marcar un faltante enorme.',
  },

  '/clientes': {
    titulo: 'Clientes: tus marchantes de siempre',
    queEs:
      'Aquí guardas a los clientes que van seguido. No es obligatorio: la mayoría de las ventas de mostrador se hacen sin registrar a nadie.',
    puedes: [
      'Dar de alta un cliente con su nombre y teléfono',
      'Ver todo lo que te ha comprado',
      'Saber cuánto te debe',
    ],
    empiezaPor:
      'Solo da de alta a los que te compran fiado o a los que van muy seguido. Al resto cóbrales normal, sin cliente.',
  },

  '/fiados': {
    titulo: 'Fiados: quién te debe y cuánto',
    queEs:
      'Es la libreta de los fiados, pero en el sistema. Cada vez que dejas algo fiado en el POS se apunta solo aquí.',
    puedes: [
      'Ver la lista de quién te debe y cuánto',
      'Registrar un abono cuando te vengan a pagar',
      'Ver desde cuándo trae la deuda',
    ],
    empiezaPor:
      'Para que alguien aparezca aquí, al cobrar en el POS escoge al cliente y marca la venta como fiada.',
  },

  '/gastos': {
    titulo: 'Gastos: todo lo que sale',
    queEs:
      'Aquí anotas lo que pagas: la luz, el agua, la renta, la mercancía al proveedor. Sin esto, el sistema cree que todo lo que vendiste es ganancia.',
    puedes: [
      'Anotar un gasto y decir de qué fue',
      'Separar los gastos del negocio de los tuyos personales',
      'Ver en qué se te está yendo el dinero',
    ],
    empiezaPor:
      'Anota aunque sea los gastos grandes: renta, luz y lo que le pagas al proveedor. Con eso la ganancia del Inicio ya te sirve de verdad.',
  },
}

// Lo que ve un empleado es otra pantalla (sin números del dueño), así que
// algunas secciones necesitan su propio texto. Solo se sobrescribe lo que cambia.
export const AYUDA_EMPLEADO: Record<string, Partial<Ayuda>> = {
  '/': {
    titulo: 'Inicio: tu pantalla del día',
    queEs:
      'Aquí ves lo que necesitas para tu turno: cómo va la venta del día y los avisos que dejó el jefe.',
    puedes: [
      'Entrar a cobrar en el POS',
      'Ver los avisos del jefe',
      'Marcar tu entrada y tu salida del turno',
    ],
    empiezaPor: 'Lo que más vas a usar es el botón de POS: ahí se cobra.',
  },
}

// Rutas ordenadas de más específica a más general, para que /productos/importar
// gane sobre /productos.
const RUTAS = Object.keys(AYUDA_SECCIONES).sort((a, b) => b.length - a.length)

export function getAyuda(pathname: string, rol?: string | null): Ayuda | null {
  const ruta = RUTAS.find((r) =>
    r === '/' ? pathname === '/' : pathname === r || pathname.startsWith(r + '/'),
  )
  if (!ruta) return null

  const base = AYUDA_SECCIONES[ruta]
  const esEmpleado = !!rol && rol !== 'dueno'
  return esEmpleado ? { ...base, ...AYUDA_EMPLEADO[ruta] } : base
}

// Clave de la ruta que identifica la ayuda mostrada (para recordar cuáles cerró).
export function getRutaAyuda(pathname: string): string | null {
  return (
    RUTAS.find((r) =>
      r === '/' ? pathname === '/' : pathname === r || pathname.startsWith(r + '/'),
    ) ?? null
  )
}
