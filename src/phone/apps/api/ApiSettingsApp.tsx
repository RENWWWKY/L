import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { ApiSettingsHomePage } from './pages/ApiSettingsHomePage'
import { ApiPresetEditPage } from './pages/ApiPresetEditPage'

function EditWrapper() {
  const { id } = useParams()
  // 使用同一个编辑页：/new 与 /edit/:id
  return <ApiPresetEditPage key={id ?? 'new'} />
}

export function ApiSettingsApp({ onBack }: { onBack: () => void }) {
  return (
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<ApiSettingsHomePage onBack={onBack} />} />
        <Route path="/new" element={<ApiPresetEditPage />} />
        <Route path="/edit/:id" element={<EditWrapper />} />
      </Routes>
    </MemoryRouter>
  )
}

export default ApiSettingsApp

