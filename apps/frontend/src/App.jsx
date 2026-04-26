import { useState } from 'react'
import Sidebar from './components/Sidebar'
import MainArea from './components/MainArea'

export default function App() {
  const [session, setSession] = useState(null)
  const [schema, setSchema] = useState(null)

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar 
        session={session}
        setSession={setSession}
        setSchema={setSchema}
        schema={schema}
      />
      <MainArea 
        session={session}
        schema={schema}
      />
    </div>
  )
}
