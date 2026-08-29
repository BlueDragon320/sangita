import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import DevicePanel from '../components/DevicePanel.jsx'

describe('DevicePanel Component', () => {
  const mockDevices = [
    { deviceId: 'dev-1', deviceName: 'Chrome on Desktop · Linux', deviceType: 'desktop' },
    { deviceId: 'dev-2', deviceName: 'Safari on iPhone', deviceType: 'mobile' },
    { deviceId: 'dev-3', deviceName: 'Chrome on Tablet', deviceType: 'tablet' },
  ]

  it('renders correctly with device list and header', () => {
    render(
      <DevicePanel
        devices={mockDevices}
        myDeviceId="dev-1"
        activeDeviceId="dev-2"
        onTransfer={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('Connect to a device')).toBeInTheDocument()
    expect(screen.getByText('Chrome on Desktop · Linux')).toBeInTheDocument()
    expect(screen.getByText('Safari on iPhone')).toBeInTheDocument()
    expect(screen.getByText('Chrome on Tablet')).toBeInTheDocument()
  })

  it('shows "THIS DEVICE" badge on the current user device without breaking layout', () => {
    render(
      <DevicePanel
        devices={mockDevices}
        myDeviceId="dev-1"
        activeDeviceId="dev-2"
        onTransfer={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('THIS DEVICE')).toBeInTheDocument()
  })

  it('shows "Active · Playing here" for the active device and "SWITCH HERE" for others', () => {
    render(
      <DevicePanel
        devices={mockDevices}
        myDeviceId="dev-1"
        activeDeviceId="dev-2"
        onTransfer={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('Active · Playing here')).toBeInTheDocument()
    const switchButtons = screen.getAllByText('SWITCH HERE')
    // dev-1 and dev-3 are not active, so 2 switch buttons
    expect(switchButtons).toHaveLength(2)
  })

  it('triggers onTransfer and onClose when SWITCH HERE is clicked', () => {
    const handleTransfer = vi.fn()
    const handleClose = vi.fn()

    render(
      <DevicePanel
        devices={mockDevices}
        myDeviceId="dev-1"
        activeDeviceId="dev-2"
        onTransfer={handleTransfer}
        onClose={handleClose}
      />
    )

    const switchBtn = screen.getByTestId('transfer-btn-dev-1')
    fireEvent.click(switchBtn)

    expect(handleTransfer).toHaveBeenCalledWith('dev-1')
    expect(handleClose).toHaveBeenCalled()
  })

  it('calls onClose when clicking close button or backdrop', () => {
    const handleClose = vi.fn()

    render(
      <DevicePanel
        devices={mockDevices}
        myDeviceId="dev-1"
        activeDeviceId="dev-2"
        onTransfer={vi.fn()}
        onClose={handleClose}
      />
    )

    const closeBtn = screen.getByTestId('device-close-btn')
    fireEvent.click(closeBtn)
    expect(handleClose).toHaveBeenCalledTimes(1)

    const backdrop = screen.getByTestId('device-backdrop')
    fireEvent.click(backdrop)
    expect(handleClose).toHaveBeenCalledTimes(2)
  })
})
