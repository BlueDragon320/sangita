import React, { useState, useEffect, useCallback, useMemo } from 'react'

function formatMinutes(mins) {
  if (!mins || mins <= 0) return '0m'
  if (mins < 60) {
    return `${Math.round(mins)}m`
  }
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default function ListeningGraph({ token }) {
  const [range, setRange] = useState('24h') // '24h' | '7d' | 'custom'
  const [data, setData] = useState([])
  const [totalSeconds, setTotalSeconds] = useState(0)
  const [loading, setLoading] = useState(false)
  const [hoveredPoint, setHoveredPoint] = useState(null)
  
  // Custom Date Range
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 14)
    return d.toISOString().split('T')[0]
  })
  const [customEnd, setCustomEnd] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  const fetchHistory = useCallback(async (selectedRange, start, end) => {
    if (!token) return
    setLoading(true)
    try {
      const storedTz = localStorage.getItem('sangita_timezone') || 'Asia/Kolkata'
      let effectiveTz = storedTz
      if (storedTz === 'auto' && typeof Intl !== 'undefined') {
        effectiveTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
      }
      let url = `/api/user/listening-history?range=${encodeURIComponent(selectedRange)}&tz=${encodeURIComponent(effectiveTz)}`
      if (selectedRange === 'custom' && start && end) {
        url += `&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
      }
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const json = await res.json()
        setData(json.data || [])
        setTotalSeconds(json.total_seconds || 0)
      }
    } catch (err) {
      console.error('[ListeningGraph] Failed to fetch history:', err)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchHistory(range, customStart, customEnd)
  }, [range, fetchHistory]) // eslint-disable-line

  const handleApplyCustom = (e) => {
    e.preventDefault()
    fetchHistory('custom', customStart, customEnd)
  }

  // Calculate coordinates for SVG
  const graphDimensions = useMemo(() => {
    const width = 800
    const height = 220
    const padding = { top: 25, right: 30, bottom: 40, left: 50 }
    const plotWidth = width - padding.left - padding.right
    const plotHeight = height - padding.top - padding.bottom

    if (!data || data.length === 0) {
      return { width, height, padding, plotWidth, plotHeight, points: [], maxMinutes: 60, pathD: '', areaD: '', yTicks: [] }
    }

    const maxVal = Math.max(...data.map(d => d.minutes || 0), 10)
    // Round max up nicely to a multiple of 5 or 15 or 60
    let maxMinutes = 15
    if (maxVal <= 15) maxMinutes = 15
    else if (maxVal <= 30) maxMinutes = 30
    else if (maxVal <= 60) maxMinutes = 60
    else if (maxVal <= 120) maxMinutes = 120
    else maxMinutes = Math.ceil(maxVal / 60) * 60

    const yTicks = [
      0,
      Math.round(maxMinutes * 0.33),
      Math.round(maxMinutes * 0.66),
      maxMinutes
    ]

    const points = data.map((d, index) => {
      const x = padding.left + (index / Math.max(data.length - 1, 1)) * plotWidth
      const yRatio = (d.minutes || 0) / maxMinutes
      const y = padding.top + plotHeight - yRatio * plotHeight
      return { ...d, x, y, index }
    })

    // Construct smooth or linear SVG Path
    let pathD = ''
    if (points.length > 0) {
      pathD = `M ${points[0].x} ${points[0].y}`
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1]
        const curr = points[i]
        const cX = (prev.x + curr.x) / 2
        pathD += ` C ${cX} ${prev.y}, ${cX} ${curr.y}, ${curr.x} ${curr.y}`
      }
    }

    const baselineY = padding.top + plotHeight
    const areaD = points.length > 0
      ? `${pathD} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`
      : ''

    return {
      width,
      height,
      padding,
      plotWidth,
      plotHeight,
      points,
      maxMinutes,
      pathD,
      areaD,
      yTicks
    }
  }, [data])

  // Total listening display
  const totalMins = Math.round(totalSeconds / 60)
  const totalDisplay = formatMinutes(totalMins)

  return (
    <div className="listening-graph-card" data-testid="listening-graph-card">
      {/* Card Header & Range Switcher */}
      <div className="graph-header">
        <div className="graph-title-group">
          <div className="graph-title-row">
            <h3 className="graph-title">Listening Activity</h3>
            <span className="graph-badge">{totalDisplay} total</span>
          </div>
          <p className="graph-subtitle">
            {range === '24h' && 'Hourly listening trend over the last 24 hours'}
            {range === '7d' && 'Daily listening time across the last 7 days'}
            {range === 'custom' && `Custom activity from ${customStart} to ${customEnd}`}
          </p>
        </div>

        {/* 3 Range Buttons */}
        <div className="graph-controls">
          <div className="graph-btn-group">
            <button
              className={`btn-graph-filter ${range === '24h' ? 'active' : ''}`}
              onClick={() => setRange('24h')}
              data-testid="graph-btn-24h"
            >
              24 Hours
            </button>
            <button
              className={`btn-graph-filter ${range === '7d' ? 'active' : ''}`}
              onClick={() => setRange('7d')}
              data-testid="graph-btn-7d"
            >
              7 Days
            </button>
            <button
              className={`btn-graph-filter ${range === 'custom' ? 'active' : ''}`}
              onClick={() => setRange('custom')}
              data-testid="graph-btn-custom"
            >
              Custom
            </button>
          </div>
        </div>
      </div>

      {/* Custom Date Selector Drawer */}
      {range === 'custom' && (
        <form className="graph-custom-range-form" onSubmit={handleApplyCustom} data-testid="graph-custom-form">
          <div className="custom-range-inputs">
            <div className="custom-input-group">
              <label>From</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="graph-date-input"
              />
            </div>
            <div className="custom-input-group">
              <label>To</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="graph-date-input"
              />
            </div>
            <button type="submit" className="btn-graph-apply">
              Apply
            </button>
          </div>
        </form>
      )}

      {/* Chart Canvas / SVG */}
      <div className="graph-svg-wrapper">
        {loading ? (
          <div className="graph-loading-overlay">
            <div className="spinner-sm" />
            <span>Loading listening data…</span>
          </div>
        ) : null}

        <svg
          viewBox={`0 0 ${graphDimensions.width} ${graphDimensions.height}`}
          className="graph-svg"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="graphGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--emerald, #10B981)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--emerald, #10B981)" stopOpacity="0.0" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="var(--emerald, #10B981)" floodOpacity="0.4"/>
            </filter>
          </defs>

          {/* Horizontal Gridlines & Y-Axis Labels */}
          {graphDimensions.yTicks.map((val, i) => {
            const y = graphDimensions.padding.top + graphDimensions.plotHeight - (val / graphDimensions.maxMinutes) * graphDimensions.plotHeight
            return (
              <g key={i} className="grid-line-group">
                <line
                  x1={graphDimensions.padding.left}
                  y1={y}
                  x2={graphDimensions.width - graphDimensions.padding.right}
                  y2={y}
                  stroke="var(--border, rgba(255,255,255,0.08))"
                  strokeDasharray={val === 0 ? 'none' : '3 3'}
                  strokeWidth="1"
                />
                <text
                  x={graphDimensions.padding.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="graph-y-label"
                >
                  {formatMinutes(val)}
                </text>
              </g>
            )
          })}

          {/* Area Fill */}
          {graphDimensions.areaD && (
            <path
              d={graphDimensions.areaD}
              fill="url(#graphGradient)"
            />
          )}

          {/* Line Stroke */}
          {graphDimensions.pathD && (
            <path
              d={graphDimensions.pathD}
              fill="none"
              stroke="var(--emerald, #10B981)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Interactive Hover Vertical Line */}
          {hoveredPoint && (
            <line
              x1={hoveredPoint.x}
              y1={graphDimensions.padding.top}
              x2={hoveredPoint.x}
              y2={graphDimensions.padding.top + graphDimensions.plotHeight}
              stroke="var(--text-sub, #A0AEC0)"
              strokeDasharray="2 2"
              strokeWidth="1.5"
            />
          )}

          {/* Data Points */}
          {graphDimensions.points.map((p, idx) => {
            const isHovered = hoveredPoint?.index === idx
            const isVisibleTick =
              range === '24h' ? idx % 3 === 0 || idx === graphDimensions.points.length - 1 :
              range === '7d' ? true :
              idx % Math.ceil(graphDimensions.points.length / 7) === 0 || idx === graphDimensions.points.length - 1

            return (
              <g key={idx} className="graph-point-group">
                {/* Invisible large hover hit target */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="14"
                  fill="transparent"
                  className="graph-hit-target"
                  onMouseEnter={() => setHoveredPoint(p)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />

                {/* Visible Data Dot */}
                {(p.minutes > 0 || isHovered) && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isHovered ? 6 : 3.5}
                    fill={isHovered ? "#FFFFFF" : "var(--emerald, #10B981)"}
                    stroke="var(--bg, #0F172A)"
                    strokeWidth="2"
                    className="graph-point-dot"
                  />
                )}

                {/* X-Axis Label */}
                {isVisibleTick && (
                  <text
                    x={p.x}
                    y={graphDimensions.height - 12}
                    textAnchor="middle"
                    className="graph-x-label"
                  >
                    {p.label}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {/* Hover Tooltip Card */}
        {hoveredPoint && (
          <div
            className="graph-tooltip"
            style={{
              left: `${(hoveredPoint.x / graphDimensions.width) * 100}%`,
              top: `${Math.max(hoveredPoint.y - 15, 20)}px`,
            }}
          >
            <div className="tooltip-title">{hoveredPoint.full_label || hoveredPoint.label}</div>
            <div className="tooltip-stat">
              <span className="tooltip-value">{formatMinutes(hoveredPoint.minutes)}</span>
              <span className="tooltip-plays">({hoveredPoint.plays || 0} {hoveredPoint.plays === 1 ? 'song' : 'songs'})</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
