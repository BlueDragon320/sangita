import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import ListeningGraph from '../components/ListeningGraph.jsx'

describe('ListeningGraph Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const mock24hData = {
    range: '24h',
    total_seconds: 3600,
    data: [
      { key: '2026-08-29 06', label: '6 AM', full_label: 'Aug 29, 06:00 AM', seconds: 1200, minutes: 20.0, plays: 4 },
      { key: '2026-08-29 07', label: '7 AM', full_label: 'Aug 29, 07:00 AM', seconds: 2400, minutes: 40.0, plays: 8 }
    ]
  }

  const mock7dData = {
    range: '7d',
    total_seconds: 7200,
    data: [
      { key: '2026-08-28', label: 'Fri', full_label: 'Friday, Aug 28', seconds: 3600, minutes: 60.0, plays: 12 },
      { key: '2026-08-29', label: 'Sat', full_label: 'Saturday, Aug 29', seconds: 3600, minutes: 60.0, plays: 12 }
    ]
  }

  it('renders listening activity card and fetches 24h data by default', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mock24hData
    })

    render(<ListeningGraph token="test-token" />)

    expect(screen.getByText('Listening Activity')).toBeInTheDocument()
    expect(screen.getByTestId('graph-btn-24h')).toHaveClass('active')

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/user/listening-history?range=24h'),
        expect.any(Object)
      )
      expect(screen.getByText('1h total')).toBeInTheDocument()
    })
  })

  it('switches to 7 days view when 7 Days button is clicked', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('range=7d')) {
        return Promise.resolve({ ok: true, json: async () => mock7dData })
      }
      return Promise.resolve({ ok: true, json: async () => mock24hData })
    })

    render(<ListeningGraph token="test-token" />)

    const btn7d = screen.getByTestId('graph-btn-7d')
    fireEvent.click(btn7d)

    await waitFor(() => {
      expect(btn7d).toHaveClass('active')
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/user/listening-history?range=7d'),
        expect.any(Object)
      )
      expect(screen.getByText('2h total')).toBeInTheDocument()
    })
  })

  it('renders custom range date picker and submits custom request', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mock7dData
    })

    render(<ListeningGraph token="test-token" />)

    const btnCustom = screen.getByTestId('graph-btn-custom')
    fireEvent.click(btnCustom)

    expect(screen.getByTestId('graph-custom-form')).toBeInTheDocument()

    const applyBtn = screen.getByText('Apply')
    fireEvent.click(applyBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/user/listening-history?range=custom'),
        expect.any(Object)
      )
    })
  })
})
