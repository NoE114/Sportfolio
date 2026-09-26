import { MovementProvider } from './hooks/useMovementClock'
import { Grain } from './components/ui/Grain'
import { Nav } from './components/ui/Nav'
import { Caliber00 } from './components/sections/Caliber00'
import { Caliber01 } from './components/sections/Caliber01'
import { Caliber02 } from './components/movement/Caliber02'
import { Caliber03 } from './components/projects/Caliber03'
import { Caliber04 } from './components/contact/Caliber04'
import { Footer } from './components/sections/Footer'
import './components/ui/instrument.css'

export function App() {
  return (
    <MovementProvider>
      <a className="skip-link" href="#caliber-00">
        Skip to content
      </a>
      <Grain />
      <Nav />
      <main>
        <Caliber00 />
        <Caliber01 />
        <Caliber02 />
        <Caliber03 />
        <Caliber04 />
      </main>
      <Footer />
    </MovementProvider>
  )
}
