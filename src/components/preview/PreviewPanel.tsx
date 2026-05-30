import { useState } from 'react'
import PreviewToolbar from './PreviewToolbar'
import PreviewFrame from './PreviewFrame'
import CodePanel from './CodePanel'
import type { CodeView } from './CodePanel'
import styles from './PreviewPanel.module.css'

export type Device = 'phone' | 'tablet' | 'pc'

export default function PreviewPanel() {
  const [device, setDevice] = useState<Device>('pc')
  const [codeView, setCodeView] = useState<CodeView | null>(null)

  return (
    <div className={styles.panel}>
      <PreviewToolbar
        device={device}
        onDeviceChange={setDevice}
        onOpenCode={setCodeView}
        onCloseCode={() => setCodeView(null)}
        codeOpen={codeView !== null}
      />
      {codeView ? (
        <CodePanel
          initialView={codeView}
          onClose={() => setCodeView(null)}
        />
      ) : (
        <PreviewFrame device={device} />
      )}
    </div>
  )
}
