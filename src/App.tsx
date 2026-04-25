import { GlobalGestureEffects } from './components/GlobalGestureEffects'
import { CustomizationProvider } from './phone/CustomizationContext'
import { PhoneApp } from './phone/PhoneApp'

function App() {
  return (
    <CustomizationProvider>
      <PhoneApp />
      <GlobalGestureEffects />
    </CustomizationProvider>
  )
}

export default App
