import { type Champion, champions as initialChampions } from './data/champions'
import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const CURRENT_VERSION = '1.1'

  const [champions, setChampions] = useState<Champion[]>(() => {
    const savedVersion = localStorage.getItem('champion_version')
    const savedChampions = localStorage.getItem('champions')

    const shouldUseInitial = !savedChampions || savedVersion !== CURRENT_VERSION

    if (shouldUseInitial) {
      localStorage.setItem('champions', JSON.stringify(initialChampions))
      localStorage.setItem('champion_version', CURRENT_VERSION)
      return initialChampions
    }

    return JSON.parse(savedChampions)
  })
  const [sortBy, setSortBy] = useState<'name' | 'status'>('name')
  const [searchQuery, setSearchQuery] = useState('')

  const handleStatusChange = (championId: string) => {
    setChampions(prevChampions =>
      prevChampions.map(champion => {
        if (champion.id === championId) {
          const statusOrder = ['vert', 'orange', 'jaune', 'blanc'] as const
          const currentIndex = statusOrder.indexOf(champion.status as any)
          const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length]
          return { ...champion, status: nextStatus }
        }
        return champion
      })
    )
  }

  const filteredChampions = champions.filter(champion =>
    champion.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const sortedChampions = [...filteredChampions].sort((a, b) => {
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name)
    }
    return a.status.localeCompare(b.status)
  })

  const statusCounts = champions.reduce((counts, champion) => {
    counts[champion.status] = (counts[champion.status] || 0) + 1
    return counts
  }, {} as Record<string, number>)
  const maxPoints = champions.length * 3
  const totalPoints =
    (statusCounts.vert || 0) * 3 +
    (statusCounts.orange || 0) * 2 +
    (statusCounts.jaune || 0) * 1
  const percentage = Math.round((totalPoints / maxPoints) * 100)

  useEffect(() => {
    localStorage.setItem('champions', JSON.stringify(champions))
  }, [champions])
  return (
    <div className="app">
      <div className="container">
        <div className="layout">
          {/* Colonne gauche : Tri */}
          <div className="left-panel">
            <div className="controls">
              <h2>Tri</h2>
              <button
                className={sortBy === 'name' ? 'active' : ''}
                onClick={() => setSortBy('name')}
              >
                Par nom
              </button>
              <button
                className={sortBy === 'status' ? 'active' : ''}
                onClick={() => setSortBy('status')}
              >
                Par statut
              </button>
            </div>
          </div>

          {/* Colonne centrale : Recherche + Liste */}
          <div className="main-content">
            <div className="header">
              <h1>Stats Arena</h1>
              <div className="search-container">
                <input
                  type="text"
                  placeholder="Rechercher un champion..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
                {searchQuery && (
                  <button
                    className="clear-search"
                    onClick={() => setSearchQuery('')}
                    aria-label="Effacer la recherche"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
            <div className="champions-scroll-container">
              <div className="champions-list">
                {sortedChampions.map((champion) => (
                  <div
                    key={champion.id}
                    className={`champion-card ${champion.status}`}
                    onClick={() => handleStatusChange(champion.id)}
                  >
                    <img
                      src={champion.image}
                      alt={champion.name}
                      className="champion-image"
                    />
                    <div className="champion-info">
                      <h3>{champion.name}</h3>
                      <div className="status">
                        {champion.status === 'blanc'
                          ? ''
                          : champion.status === 'jaune'
                            ? 'Top 5 à 8'
                            : champion.status === 'orange'
                              ? 'Top 2 à 4'
                              : 'Top 1'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Colonne droite : Statistiques */}
          <div className="status-panel">
            <h2>Statistiques</h2>
            <div className="status-counts">
              <div className="status-item vert">
                <span className="status-label">Top 1</span>
                <span className="status-count">{statusCounts.vert || 0}</span>
              </div>
              <div className="status-item orange">
                <span className="status-label">Top 2 à 4</span>
                <span className="status-count">{statusCounts.orange || 0}</span>
              </div>
              <div className="status-item jaune">
                <span className="status-label">Top 5 à 8</span>
                <span className="status-count">{statusCounts.jaune || 0}</span>
              </div>
              <div className="status-item blanc">
                <span className="status-label">Non classé</span>
                <span className="status-count">{statusCounts.blanc || 0}</span>
              </div>
            </div>

            <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #ddd' }} />
            <div className="total-points">
              <strong>Points totaux :</strong> {totalPoints} / {maxPoints}
              <div className="progress-bar-container">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
              <div className="progress-text">{percentage}% complété</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )



}

export default App
