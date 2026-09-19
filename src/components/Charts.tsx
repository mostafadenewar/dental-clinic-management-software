import './charts.css'

export interface DonutSegment {
  value: number
  color: string
  label?: string
}

interface DonutChartProps {
  size?: number
  thickness?: number
  segments: DonutSegment[]
  centerTitle: string
  centerSub: string
}

export function DonutChart({ size = 128, thickness = 16, segments, centerTitle, centerSub }: DonutChartProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <div className="chart-donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${centerTitle}: ${centerSub}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#eef2f7"
          strokeWidth={thickness}
        />
        {total > 0 &&
          segments
            .filter((s) => s.value > 0)
            .map((s, i) => {
              const dash = (s.value / total) * circumference
              const circle = (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={thickness}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                >
                  <title>{`${s.label ?? ''}: ${Math.round((s.value / total) * 100)}%`}</title>
                </circle>
              )
              offset += dash
              return circle
            })}
      </svg>
      <div className="chart-donut-center">
        <strong>{centerTitle}</strong>
        <span>{centerSub}</span>
      </div>
    </div>
  )
}

export interface TrendPoint {
  label: string
  value: number
  secondary?: number
}

interface TrendChartProps {
  data: TrendPoint[]
  height?: number
  barColor?: string
  lineColor?: string
  formatValue?: (v: number) => string
  ariaLabel?: string
}

export function TrendChart({
  data,
  height = 180,
  barColor = '#2563eb',
  lineColor = '#10b981',
  formatValue = (v) => `${v}`,
  ariaLabel = 'Trend chart',
}: TrendChartProps) {
  const width = 640
  const padL = 44
  const padR = 12
  const padT = 12
  const padB = 26
  const innerW = width - padL - padR
  const innerH = height - padT - padB
  const maxValue = Math.max(1, ...data.map((d) => Math.max(d.value, d.secondary ?? 0)))
  const niceMax = Math.ceil(maxValue / 100) * 100 || Math.ceil(maxValue)
  const y = (v: number) => padT + innerH - (v / niceMax) * innerH
  const bw = innerW / data.length
  const barW = Math.min(26, bw * 0.42)

  const gridLines = [0, 0.25, 0.5, 0.75, 1]

  const points = data
    .map((d, i) => (d.secondary === undefined ? null : `${padL + bw * i + bw / 2},${y(d.secondary)}`))
    .filter((p): p is string => p !== null)

  return (
    <div className="chart-trend">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={ariaLabel}
      >
        {gridLines.map((g) => {
          const gy = padT + innerH - g * innerH
          const val = Math.round(g * niceMax)
          return (
            <g key={g}>
              <line x1={padL} x2={width - padR} y1={gy} y2={gy} stroke="#eef2f7" strokeWidth={1} />
              <text x={padL - 6} y={gy + 3} textAnchor="end" className="chart-axis-label">
                {formatValue(val)}
              </text>
            </g>
          )
        })}
        {data.map((d, i) => {
          const cx = padL + bw * i + bw / 2
          const barH = (d.value / niceMax) * innerH
          return (
            <g key={i}>
              <rect
                x={cx - barW / 2}
                y={padT + innerH - barH}
                width={barW}
                height={barH}
                rx={3}
                fill={barColor}
                opacity={0.9}
              >
                <title>{`${d.label}: ${formatValue(d.value)}`}</title>
              </rect>
              <text x={cx} y={height - 8} textAnchor="middle" className="chart-axis-label">
                {d.label}
              </text>
            </g>
          )
        })}
        {points.length > 1 && (
          <>
            <polyline
              points={points.join(' ')}
              fill="none"
              stroke={lineColor}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {points.map((p, i) => {
              const [px, py] = p.split(',').map(Number)
              return (
                <circle key={i} cx={px} cy={py} r={3} fill={lineColor} stroke="#ffffff" strokeWidth={1.5}>
                  <title>{`Collection: ${formatValue(data[i].secondary ?? 0)}`}</title>
                </circle>
              )
            })}
          </>
        )}
      </svg>
    </div>
  )
}

interface MiniBarsProps {
  data: TrendPoint[]
  height?: number
  color?: string
  formatValue?: (v: number) => string
  ariaLabel?: string
}

export function MiniBars({
  data,
  height = 110,
  color = '#2563eb',
  formatValue = (v) => `${v}`,
  ariaLabel = 'Usage chart',
}: MiniBarsProps) {
  const width = 400
  const padL = 30
  const padR = 8
  const padT = 10
  const padB = 22
  const innerW = width - padL - padR
  const innerH = height - padT - padB
  const maxValue = Math.max(1, ...data.map((d) => d.value))
  const niceMax = Math.ceil(maxValue / 10) * 10
  const bw = innerW / data.length
  const barW = Math.min(22, bw * 0.5)

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-label={ariaLabel}
    >
      <line x1={padL} x2={width - padR} y1={padT + innerH} y2={padT + innerH} stroke="#eef2f7" strokeWidth={1} />
      {data.map((d, i) => {
        const cx = padL + bw * i + bw / 2
        const barH = (d.value / niceMax) * innerH
        return (
          <g key={i}>
            <rect
              x={cx - barW / 2}
              y={padT + innerH - barH}
              width={barW}
              height={barH}
              rx={3}
              fill={color}
              opacity={0.85}
            >
              <title>{`${d.label}: ${formatValue(d.value)}`}</title>
            </rect>
            <text x={cx} y={height - 8} textAnchor="middle" className="chart-axis-label">
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}