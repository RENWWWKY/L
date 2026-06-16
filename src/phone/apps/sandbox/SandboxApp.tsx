import { SandboxHub } from './SandboxHub'

export function SandboxApp({ onBack }: { onBack: () => void }) {
  return <SandboxHub onBack={onBack} />
}
