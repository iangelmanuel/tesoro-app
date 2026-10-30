interface ChartDataTableProps {
  caption: string
  headers: string[]
  /** Celdas ya formateadas, en el mismo orden que `headers` */
  rows: string[][]
}

// Tabla solo para lectores de pantalla con los mismos datos de la gráfica
export function ChartDataTable({
  caption,
  headers,
  rows
}: ChartDataTableProps) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {headers.map((header) => (
            <th
              key={header}
              scope="col"
            >
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row[0]}>
            {row.map((cell, index) =>
              index === 0 ? (
                <th
                  key={index}
                  scope="row"
                >
                  {cell}
                </th>
              ) : (
                <td key={index}>{cell}</td>
              )
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
