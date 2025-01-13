import { useState, useEffect } from 'react'

interface HealthStatus {
  status: string;
  database: string;
}

function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/health')
        const data = await response.json()
        setHealth(data)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to check health status')
        setHealth(null)
      }
    }

    checkHealth()
    // Poll every 30 seconds
    const interval = setInterval(checkHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg p-4">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Cygnus Project</h1>
            
            {error ? (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                Error: {error}
              </div>
            ) : health ? (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                <p>Status: {health.status}</p>
                <p>Database: {health.database}</p>
              </div>
            ) : (
              <div className="animate-pulse flex space-x-4">
                <div className="flex-1 space-y-4 py-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
