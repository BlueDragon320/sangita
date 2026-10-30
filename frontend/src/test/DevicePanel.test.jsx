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

  it('renders correctly with dialog semantics and header', () => {
    render(
      <DevicePanel
        devices={mockDevices}
        myDeviceId="dev-1"
        activeDeviceId="dev-2"
        onTransfer={vi.fn()}
        onClose={vi.fn()}
      />
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'device-panel-title')
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

  it('formats device status copy accurately for all device state combinations', () => {
    // When dev-2 is active and myDeviceId is dev-1:
    // dev-1 (isMe && !isActive): "This device · Inactive"
    // dev-2 (!isMe && isActive): "Active · Playing on Safari on iPhone"
    // dev-3 (!isMe && !isActive): "Connected"
    const { rerender } = render(
      <DevicePanel
        devices={mockDevices}
        myDeviceId="dev-1"
        activeDeviceId="dev-2"
        onTransfer={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('Active · Playing on Safari on iPhone')).toBeInTheDocument()
    expect(screen.getByText('This device · Inactive')).toBeInTheDocument()
    expect(screen.getByText('Connected')).toBeInTheDocument()

    // When dev-1 is active and myDeviceId is dev-1 (isMe && isActive):
    // dev-1: "Active · Playing on this device"
    rerender(
      <DevicePanel
        devices={mockDevices}
        myDeviceId="dev-1"
        activeDeviceId="dev-1"
        onTransfer={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('Active · Playing on this device')).toBeInTheDocument()
  })

  it('triggers onTransfer and shows transfer state without immediately dismissing on transfer click', () => {
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
    expect(handleClose).not.toHaveBeenCalled()
    expect(screen.getByText('Transferring...')).toBeInTheDocument()
  })

  it('calls onClose when Escape key is pressed', () => {
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

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(handleClose).toHaveBeenCalledTimes(1)
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

  it('provides screen reader announcements via live region and supports retry on failed transfer', () => {
    const handleRetry = vi.fn()
    const { rerender } = render(
      <DevicePanel
        devices={mockDevices}
        myDeviceId="dev-1"
        activeDeviceId="dev-2"
        onTransfer={vi.fn()}
        onClose={vi.fn()}
        transferStatus="idle"
      />
    )

    const switchBtn = screen.getByTestId('transfer-btn-dev-1')
    fireEvent.click(switchBtn)

    expect(screen.getByText('Transferring playback to Chrome on Desktop · Linux...')).toBeInTheDocument()

    // When transfer fails
    rerender(
      <DevicePanel
        devices={mockDevices}
        myDeviceId="dev-1"
        activeDeviceId="dev-2"
        onTransfer={vi.fn()}
        onClose={vi.fn()}
        transferStatus="failed"
        retryTransfer={handleRetry}
      />
    )

    expect(screen.getByText('Transfer failed. Please try again.')).toBeInTheDocument()
    const retryBtn = screen.getByText('Retry')
    fireEvent.click(retryBtn)
    expect(handleRetry).toHaveBeenCalled()
  })
})
