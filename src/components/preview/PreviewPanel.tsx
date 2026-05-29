import { useState } from 'react'
import PreviewToolbar from './PreviewToolbar'
import PreviewFrame from './PreviewFrame'
import styles from './PreviewPanel.module.css'

export type Device = 'phone' | 'tablet' | 'pc'

export default function PreviewPanel() {
  const [device, setDevice] = useState<Device>('pc')

  return (
    <div className={styles.panel}>
      <PreviewToolbar device={device} onDeviceChange={setDevice} />
      <PreviewFrame device={device} />
    </div>
  )
}
