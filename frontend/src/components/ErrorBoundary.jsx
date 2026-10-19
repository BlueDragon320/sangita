import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '60px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '400px',
            color: 'var(--text)'
          }}
          data-testid="error-boundary-fallback"
        >
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
            Unable to display lyrics view
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-sub)', maxWidth: '440px', marginBottom: '16px', lineHeight: 1.5 }}>
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <button
            className="btn-modal-primary"
            onClick={this.handleReset}
            style={{ padding: '8px 18px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
          >
            {this.props.resetLabel || 'Back to Playlist'}
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
