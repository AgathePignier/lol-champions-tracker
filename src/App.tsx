import { useSessionContext, useSupabaseClient } from '@supabase/auth-helpers-react'
import { useEffect, useState, useRef } from 'react'
import Auth from '../Auth'
import './App.css'

// Types
interface Champion {
  id: string;
  name: string;
  status: 'blanc' | 'jaune' | 'orange' | 'vert';
  image: string; // Le champ s'appelle "image" dans ta DB
}

interface Season {
  id: string
  user_id: string
  name: string
  start_date: string
  end_date?: string
  is_active: boolean
  created_at: string
}

function App() {
  const { session, isLoading } = useSessionContext()
  const supabase = useSupabaseClient()
  const championsScrollRef = useRef<HTMLDivElement>(null)
  
  const [champions, setChampions] = useState<Champion[]>([])
  const [sortBy, setSortBy] = useState<'name' | 'status'>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  
  // États pour les saisons
  const [seasons, setSeasons] = useState<Season[]>([])
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null)
  const [showSeasonModal, setShowSeasonModal] = useState(false)

  // Fonction pour charger les saisons
  const loadSeasons = async () => {
    if (!session?.user?.id) return

    try {
      const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('❌ Erreur chargement saisons:', error)
        return
      }

      setSeasons(data || [])
      
      // Trouver la saison active
      const activeSeason = data?.find((s: Season) => s.is_active)
      setCurrentSeason(activeSeason || null)

    } catch (err) {
      console.error('❌ Erreur réseau:', err)
    }
  }

  // Fonction pour créer une nouvelle saison
  const createNewSeason = async (seasonName: string) => {
    if (!session?.user?.id) return

    try {
      // 1. Fermer la saison actuelle
      if (currentSeason) {
        await supabase
          .from('seasons')
          .update({ 
            is_active: false, 
            end_date: new Date().toISOString() 
          })
          .eq('id', currentSeason.id)
      }

      // 2. Créer la nouvelle saison
      const { data, error } = await supabase
        .from('seasons')
        .insert({
          user_id: session.user.id,
          name: seasonName,
          is_active: true
        })
        .select()
        .single()

      if (error) {
        console.error('❌ Erreur création saison:', error)
        return
      }

      console.log('✅ Nouvelle saison créée:', data)
      
      // 3. Recharger les données
      await loadSeasons()
      await loadChampionData()

    } catch (err) {
      console.error('❌ Erreur réseau:', err)
    }
  }

  // Fonction pour charger les champions ET statuts depuis Supabase
  const loadChampionData = async () => {
    if (!session?.user?.id || !currentSeason) return

    setLoading(true)
    console.log('🔄 Chargement des champions pour la saison:', currentSeason.name)

    try {
      // 1. Charger tous les champions depuis la table champions
      const { data: championsData, error: championsError } = await supabase
        .from('champions')
        .select('*')

      if (championsError) {
        console.error('❌ Erreur chargement champions:', championsError)
        return
      }

      console.log('✅ Champions chargés:', championsData)

      // 2. Charger les statuts pour cet utilisateur ET cette saison
      const { data: statusData, error: statusError } = await supabase
        .from('champion_status')
        .select('champion_id, status')
        .eq('user_id', session.user.id)
        .eq('season_id', currentSeason.id)

      if (statusError) {
        console.error('❌ Erreur chargement statuts:', statusError)
      }

      // 3. Créer un map des statuts
      const statusMap = new Map<string, string>()
      statusData?.forEach(item => {
        statusMap.set(item.champion_id, item.status)
      })

      // 4. Combiner champions + statuts
      const championsWithStatus: Champion[] = championsData?.map(champion => ({
        id: champion.id,
        name: champion.name,
        image: champion.image, // Récupérer l'URL de l'image depuis la DB
        status: (statusMap.get(champion.id) as Champion['status']) || 'blanc'
      })) || []

      setChampions(championsWithStatus)
      console.log('✅ Champions avec statuts chargés:', championsWithStatus.length)

    } catch (err) {
      console.error('❌ Erreur réseau:', err)
    } finally {
      setLoading(false)
    }
  }

  // Charger les saisons au démarrage
  useEffect(() => {
    if (session?.user?.id) {
      loadSeasons()
    }
  }, [session?.user?.id])

  // Charger les champions quand la saison change
  useEffect(() => {
    if (currentSeason) {
      loadChampionData()
    }
  }, [currentSeason])

  const handleStatusChange = async (championId: string) => {
    if (!currentSeason) return

    const champion = champions.find(c => c.id === championId)
    if (!champion) return

    const statusOrder = ['blanc', 'jaune', 'orange', 'vert'] as const
    const currentIndex = statusOrder.indexOf(champion.status)
    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length]

    // Mise à jour locale immédiate
    setChampions(prevChampions =>
      prevChampions.map(c => 
        c.id === championId ? { ...c, status: nextStatus } : c
      )
    )

    // Sauvegarde dans Supabase avec season_id
    try {
      const { error } = await supabase
        .from('champion_status')
        .upsert({
          user_id: session?.user?.id,
          champion_id: championId,
          status: nextStatus,
          season_id: currentSeason.id
        })

      if (error) {
        console.error('❌ Erreur Supabase:', error)
      } else {
        console.log(`✅ Statut sauvegardé: ${champion.name} → ${nextStatus}`)
      }
    } catch (err) {
      console.error('❌ Erreur réseau:', err)
    }
  }

  // Filtrage et tri
  const filteredChampions = champions.filter(champion =>
    champion.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const sortedChampions = [...filteredChampions].sort((a, b) => {
    let comparison = 0;
    
    if (sortBy === 'name') {
      comparison = a.name.localeCompare(b.name)
    } else {
      comparison = a.status.localeCompare(b.status)
    }
    
    // Inverser si direction descendante
    return sortDirection === 'desc' ? -comparison : comparison
  })

  // Calculs des statistiques
  const statusCounts = champions.reduce((counts, champion) => {
    counts[champion.status] = (counts[champion.status] || 0) + 1
    return counts
  }, {} as Record<string, number>)

  const maxPoints = champions.length * 3
  const totalPoints =
    (statusCounts.vert || 0) * 3 +
    (statusCounts.orange || 0) * 2 +
    (statusCounts.jaune || 0) * 1
  const percentage = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0

  // À la fin du composant, avant le return final
  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '1.2em'
      }}>
        Chargement de l'authentification...
      </div>
    )
  }

  if (!session) {
    return <Auth />
  }

  return (
    <div className="app">
      {/* Header utilisateur en haut à droite */}
      <div className="user-header">
        <div className="user-info">
          <span className="user-email">{session?.user?.email}</span>
          <button 
            className="logout-btn"
            onClick={() => supabase.auth.signOut()}
          >
            Déconnexion
          </button>
        </div>
      </div>

      <div className="container">
        {/* Header avec titre et saisons */}
        <div className="header">
          <h1>🏆 Stats Arena</h1>
          
          {/* Contrôles des saisons - bloc unifié */}
          <div className="season-selector">
            <span className="season-label">Saison:</span>
            <select 
              className="season-dropdown"
              value={currentSeason?.id || ''} 
              onChange={(e) => {
                const season = seasons.find(s => s.id === e.target.value)
                setCurrentSeason(season || null)
              }}
            >
              <option value="">Sélectionner une saison</option>
              {seasons.map(season => (
                <option key={season.id} value={season.id}>
                  {season.name} {season.is_active ? '(Active)' : ''}
                </option>
              ))}
            </select>
            
            <button 
              onClick={() => setShowSeasonModal(true)}
              className="new-season-btn"
            >
              Nouvelle Saison
            </button>
          </div>
        </div>

        {/* Layout 3 colonnes - ANCIEN DESIGN */}
        <div className="layout">
          {/* Colonne gauche - Panneau de tri */}
          <div className="left-panel">
            <h2>Tri</h2>
            <div className="controls">
              <button
                className={sortBy === 'name' ? 'active' : ''}
                onClick={() => {
                  if (sortBy === 'name') {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                  } else {
                    setSortBy('name')
                    setSortDirection('asc')
                  }
                  // Forcer le scroll en haut en désactivant temporairement le snap
                  if (championsScrollRef.current) {
                    const container = championsScrollRef.current
                    container.style.scrollSnapType = 'none'
                    container.scrollTop = 0
                    setTimeout(() => {
                      container.style.scrollSnapType = 'y mandatory'
                    }, 100)
                  }
                }}
              >
                Par nom {sortBy === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
              </button>
              <button
                className={sortBy === 'status' ? 'active' : ''}
                onClick={() => {
                  if (sortBy === 'status') {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                  } else {
                    setSortBy('status')
                    setSortDirection('asc')
                  }
                  // Forcer le scroll en haut en désactivant temporairement le snap
                  if (championsScrollRef.current) {
                    const container = championsScrollRef.current
                    container.style.scrollSnapType = 'none'
                    container.scrollTop = 0
                    setTimeout(() => {
                      container.style.scrollSnapType = 'y mandatory'
                    }, 100)
                  }
                }}
              >
                Par statut {sortBy === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
              </button>
            </div>
          </div>

          {/* Colonne centrale - Liste des champions */}
          <div className="champions-section">
            {/* Titre fixe */}
            <h2 className="champions-title">
              Champions {searchQuery && `(${sortedChampions.length} résultat${sortedChampions.length > 1 ? 's' : ''})`}
            </h2>
            
            {/* Barre de recherche */}
            <div className="search-container">
              <input
                type="text"
                placeholder="🔍 Rechercher un champion..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              {searchQuery && (
                <button
                  className="clear-search"
                  onClick={() => setSearchQuery('')}
                >
                  ×
                </button>
              )}
            </div>

            {/* Liste des champions avec scroll */}
            <div className="champions-scroll-container" ref={championsScrollRef}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>Chargement...</div>
              ) : (
                <div className="champions-list">
                  {sortedChampions.map(champion => (
                    <div
                      key={champion.id}
                      className={`champion-card ${champion.status}`}
                      onClick={() => handleStatusChange(champion.id)}
                    >
                      <img 
                        src={champion.image}
                        alt={champion.name}
                        className="champion-image"
                        onError={(e) => {
                          // Fallback si l'image ne charge pas
                          const target = e.target as HTMLImageElement;
                          target.src = `https://ddragon.leagueoflegends.com/cdn/13.24.1/img/champion/Aatrox.png`;
                        }}
                      />
                      <div className="champion-info">
                        <h3>{champion.name}</h3>
                        <div className="status">
                          {champion.status === 'vert' && '🟢 Top 1'}
                          {champion.status === 'orange' && '🟠 Top 2-4'}
                          {champion.status === 'jaune' && '🟡 Top 5-8'}
                          {champion.status === 'blanc' && '⚪ Non joué'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Colonne droite - Panneau de statistiques */}
          <div className="status-panel">
            <h2>Statistiques</h2>
            
            <div className="status-counts">
              <div className="status-item vert">
                <span className="status-label">🟢 Top 1</span>
                <span className="status-count">{statusCounts.vert || 0}</span>
              </div>
              <div className="status-item orange">
                <span className="status-label">🟠 Top 2-4</span>
                <span className="status-count">{statusCounts.orange || 0}</span>
              </div>
              <div className="status-item jaune">
                <span className="status-label">🟡 Top 5-8</span>
                <span className="status-count">{statusCounts.jaune || 0}</span>
              </div>
              <div className="status-item blanc">
                <span className="status-label">⚪ Non joué</span>
                <span className="status-count">{statusCounts.blanc || 0}</span>
              </div>
            </div>

            <div className="total-points">
              <strong>Points: {totalPoints}/{maxPoints}</strong>
            </div>

            <div className="progress-bar-container">
              <div 
                className="progress-bar-fill" 
                style={{ width: `${percentage}%` }}
              ></div>
            </div>
            <div className="progress-text">{percentage}%</div>
          </div>
        </div>

        {/* Modal de création de saison */}
        {showSeasonModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '8px',
              minWidth: '300px',
              textAlign: 'center'
            }}>
              <h3>Créer une nouvelle saison</h3>
              <input
                id="season-name-input"
                type="text"
                placeholder="Nom de la saison"
                style={{
                  width: '100%',
                  padding: '10px',
                  margin: '10px 0',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const input = e.target as HTMLInputElement
                    if (input.value.trim()) {
                      createNewSeason(input.value.trim())
                      setShowSeasonModal(false)
                    }
                  }
                }}
              />
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
                <button
                  onClick={() => {
                    const input = document.getElementById('season-name-input') as HTMLInputElement
                    if (input.value.trim()) {
                      createNewSeason(input.value.trim())
                      setShowSeasonModal(false)
                    }
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#4a90e2',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Créer
                </button>
                <button
                  onClick={() => setShowSeasonModal(false)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
