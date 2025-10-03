import { useSessionContext, useSupabaseClient } from '@supabase/auth-helpers-react'
import { useEffect, useState, useRef } from 'react'
import Auth from '../Auth'
import './App.css'
import type { UserProfile } from './types'

// Types
interface Champion {
  id: string;
  name: string;
  status: 'blanc' | 'jaune' | 'orange' | 'vert';
  image: string; // Le champ s'appelle "image" dans ta DB
  link_url?: string; // URL du lien
  link_text?: string; // Texte du lien
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
  
  // États pour les filtres
  const [statusFilters, setStatusFilters] = useState<Set<Champion['status']>>(new Set(['blanc', 'jaune', 'orange', 'vert']))
  
  // États pour les saisons
  const [seasons, setSeasons] = useState<Season[]>([])
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null)
  const [showSeasonModal, setShowSeasonModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [usernameInput, setUsernameInput] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  // Ajouts: états œil et avatar + petites options prédéfinies
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirmPwd, setShowConfirmPwd] = useState(false)
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null)
  const AVAILABLE_AVATARS = ['/avatars/1.png', '/avatars/2.png', '/avatars/3.png', '/avatars/4.png', '/avatars/5.png']

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
      console.log('🔍 Saisons trouvées:', data?.length)
      console.log('✅ Saison active trouvée:', activeSeason?.name || 'Aucune')
      setCurrentSeason(activeSeason || null)

    } catch (err) {
      console.error('❌ Erreur réseau:', err)
    }
  }

  // Fonction pour vérifier si un nom de saison existe déjà
  const checkSeasonNameExists = (name: string, excludeId?: string): boolean => {
    const trimmedName = name.trim().toLowerCase()
    return seasons.some(season => 
      season.name.toLowerCase() === trimmedName && 
      season.id !== excludeId
    )
  }

  // Fonction pour créer une nouvelle saison
  const createNewSeason = async (seasonName: string) => {
    if (!session?.user?.id) return

    const trimmedName = seasonName.trim()
    if (!trimmedName) {
      alert('⚠️ Le nom de la saison ne peut pas être vide.')
      return
    }

    // Vérifier si le nom existe déjà
    if (checkSeasonNameExists(trimmedName)) {
      alert('⚠️ Une saison avec ce nom existe déjà. Veuillez choisir un autre nom.')
      return
    }

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
          name: trimmedName,
          is_active: true
        })
        .select()
        .single()

      if (error) {
        console.error('❌ Erreur création saison:', error)
        alert('❌ Erreur lors de la création de la saison.')
        return
      }

      console.log('✅ Nouvelle saison créée:', data)
      
      // 3. Recharger les données
      await loadSeasons()
      await loadChampionData()

    } catch (err) {
      console.error('❌ Erreur réseau:', err)
      alert('❌ Erreur de connexion lors de la création de la saison.')
    }
  }

  // Fonction pour supprimer une saison
  const deleteSeason = async () => {
    if (!currentSeason || !session?.user?.id) return

    try {
      console.log('🗑️ Suppression de la saison:', currentSeason.name)

      // 1. Supprimer tous les statuts des champions pour cette saison
      const { error: statusError } = await supabase
        .from('champion_status')
        .delete()
        .eq('season_id', currentSeason.id)
        .eq('user_id', session.user.id)

      if (statusError) {
        console.error('❌ Erreur suppression statuts:', statusError)
        return
      }

      // 2. Supprimer la saison
      const { error: seasonError } = await supabase
        .from('seasons')
        .delete()
        .eq('id', currentSeason.id)
        .eq('user_id', session.user.id)

      if (seasonError) {
        console.error('❌ Erreur suppression saison:', seasonError)
        return
      }

      console.log('✅ Saison supprimée avec succès')

      // 3. Fermer le modal et recharger les données
      setShowDeleteModal(false)
      setCurrentSeason(null)
      await loadSeasons()

      // 4. Si on vient de supprimer la saison active, activer la plus récente
      const { data: remainingSeasons } = await supabase
        .from('seasons')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

      if (remainingSeasons && remainingSeasons.length > 0) {
        // Vérifier s'il y a encore une saison active
        const hasActiveSeason = remainingSeasons.some(s => s.is_active)
        
        if (!hasActiveSeason) {
          // Activer la saison la plus récente
          const mostRecentSeason = remainingSeasons[0]
          await supabase
            .from('seasons')
            .update({ is_active: true })
            .eq('id', mostRecentSeason.id)
          
          console.log('✅ Saison la plus récente activée:', mostRecentSeason.name)
          
          // Recharger les saisons pour refléter le changement
          await loadSeasons()
        }
      }

      setChampions([]) // Vider la liste des champions

    } catch (err) {
      console.error('❌ Erreur réseau:', err)
    }
  }

  // Fonction pour renommer une saison
  const changePassword = async () => {
    const pwd = newPassword.trim()
    const confirm = confirmPassword.trim()

    if (!pwd || !confirm) {
      alert('⚠️ Le mot de passe ne peut pas être vide.')
      return
    }
    if (pwd !== confirm) {
      alert('⚠️ Les mots de passe ne correspondent pas.')
      return
    }
    // Complexité: min 8, majuscule, minuscule, chiffre
    const strongEnough =
      pwd.length >= 8 &&
      /[A-Z]/.test(pwd) &&
      /[a-z]/.test(pwd) &&
      /\d/.test(pwd)

    if (!strongEnough) {
      alert('⚠️ Mot de passe trop faible. Min 8 caractères avec majuscule, minuscule et chiffre.')
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: pwd })
      if (error) {
        console.error('❌ Erreur changement mot de passe:', error)
        alert('❌ Impossible de changer le mot de passe.')
        return
      }
      alert('✅ Mot de passe mis à jour.')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      console.error('❌ Erreur réseau:', err)
      alert('❌ Erreur de connexion.')
    }
  }

  const saveUserHandle = async () => {
    const finalUsername = usernameInput.trim()
    if (!finalUsername) {
      alert('⚠️ Le pseudo ne peut pas être vide.')
      return
    }

    const finalTag = tagInput.trim()
    if (!finalTag) {
      alert('⚠️ Le tag ne peut pas être vide.')
      return
    }
    if (!/^\d{4}$/.test(finalTag)) {
      alert('⚠️ Le tag doit être 4 chiffres (ex: 1234).')
      return
    }

    try {
      // Vérifier si pseudo#tag déjà utilisé par quelqu'un d'autre
      const { data: dup, error: dupErr } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('username', finalUsername)
        .eq('tag', finalTag)
        .limit(1)

      if (dupErr) {
        console.error('❌ Erreur vérif doublon:', dupErr)
      }
      if (dup && dup.length > 0 && dup[0].user_id !== session?.user?.id) {
        alert('⚠️ Ce pseudo#tag est déjà utilisé. Essayez un autre tag.')
        return
      }

      // Upsert par user_id (une fiche par utilisateur)
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', session!.user!.id)
        .limit(1)

      const finalAvatar = selectedAvatar ?? undefined
      const updatePayload: any = { username: finalUsername, tag: finalTag, ...(finalAvatar ? { avatar: finalAvatar } : {}) }

      if (existing && existing.length > 0) {
        const { error } = await supabase
          .from('profiles')
          .update(updatePayload)
          .eq('user_id', session!.user!.id)

        if (error) {
          console.error('❌ Erreur mise à jour profil:', error)
          alert('❌ Erreur lors de la mise à jour du pseudo.')
          return
        }
      } else {
        const insertPayload: any = { user_id: session!.user!.id, username: finalUsername, tag: finalTag, ...(finalAvatar ? { avatar: finalAvatar } : {}) }
        const { error } = await supabase
          .from('profiles')
          .insert(insertPayload)

        if (error) {
          console.error('❌ Erreur création profil:', error)
          alert("❌ Erreur lors de l'enregistrement du pseudo.")
          return
        }
      }

      setUserProfile((prev) =>
        prev
          ? (finalAvatar !== undefined
              ? { ...prev, username: finalUsername, tag: finalTag, avatar: finalAvatar }
              : { ...prev, username: finalUsername, tag: finalTag })
          : prev
      )
      setShowProfileModal(false)
    } catch (err) {
      console.error('❌ Erreur réseau:', err)
      alert('❌ Erreur de connexion.')
    }
  }

  const renameSeason = async (newName: string) => {
    if (!currentSeason || !session?.user?.id) return

    const trimmedName = newName.trim()
    if (!trimmedName) {
      alert('⚠️ Le nom de la saison ne peut pas être vide.')
      return
    }

    // Vérifier si le nom existe déjà (en excluant la saison actuelle)
    if (checkSeasonNameExists(trimmedName, currentSeason.id)) {
      alert('⚠️ Une saison avec ce nom existe déjà. Veuillez choisir un autre nom.')
      return
    }

    try {
      console.log('⚙️ Renommage de la saison:', currentSeason.name, '→', trimmedName)

      const { error } = await supabase
        .from('seasons')
        .update({ name: trimmedName })
        .eq('id', currentSeason.id)
        .eq('user_id', session.user.id)

      if (error) {
        console.error('❌ Erreur renommage saison:', error)
        alert('❌ Erreur lors du renommage de la saison.')
        return
      }

      console.log('✅ Saison renommée avec succès')
      setShowRenameModal(false)

      // Recharger les saisons pour refléter le changement
      await loadSeasons()

    } catch (err) {
      console.error('❌ Erreur réseau:', err)
      alert('❌ Erreur de connexion lors du renommage de la saison.')
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

      // 4. Combiner champions + statuts + liens
      const championsWithStatus: Champion[] = championsData?.map(champion => ({
        id: champion.id,
        name: champion.name,
        image: champion.image,
        status: (statusMap.get(champion.id) as Champion['status']) || 'blanc',
        link_url: champion.link_url,
        link_text: champion.link_text || 'Guide'
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
  const loadUserProfile = async () => {
    if (!session?.user?.id) return
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .limit(1)

    if (error) {
      console.error('❌ Erreur chargement profil:', error)
      return
    }
    const row = data && data[0]
    if (row) setUserProfile(row)
  }

  useEffect(() => {
    if (session?.user?.id) {
      loadSeasons()
      loadUserProfile()
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
    champion.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    statusFilters.has(champion.status)
  )

  const sortedChampions = [...filteredChampions].sort((a, b) => {
    let comparison = 0;
    
    if (sortBy === 'name') {
      comparison = a.name.localeCompare(b.name)
    } else {
      // Tri par statut avec ordre personnalisé : vert, orange, jaune, blanc
      const statusOrder = { 'vert': 0, 'orange': 1, 'jaune': 2, 'blanc': 3 };
      comparison = statusOrder[a.status] - statusOrder[b.status];
      
      // Si les statuts sont identiques, trier par ordre alphabétique
      if (comparison === 0) {
        comparison = a.name.localeCompare(b.name);
      }
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
      {/* Header utilisateur - en haut à droite */}
      <div className="user-header">
        <div className="user-info">
          <div className="user-profile">
              <button 
              className="profile-icon"
              title="Mon compte"
              onClick={() => {
                setUsernameInput(userProfile?.username || '')
                setTagInput(userProfile?.tag || '')
                setSelectedAvatar(userProfile?.avatar || null)
                setShowProfileModal(true)
              }}
            >
              {userProfile?.avatar ? (
                <img src={userProfile.avatar} alt="Profil" />
              ) : (
                '👤'
              )}
            </button>
            </div>
          <button 
            className="logout-btn"
            onClick={() => setShowLogoutModal(true)}
            title="Déconnexion"
          >
            <span className="logout-text">Déconnexion</span>
            <span className="logout-icon">✕</span>
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
              className="season-control-btn new-season-btn"
              title="Nouvelle Saison"
            >
              ➕
            </button>

            {/* Bouton de modification - visible seulement si une saison est sélectionnée */}
            {currentSeason && (
              <button 
                onClick={() => setShowRenameModal(true)}
                className="season-control-btn rename-season-btn"
                title="Renommer la saison"
              >
                ⚙️
              </button>
            )}

            {/* Bouton de suppression - visible seulement si une saison est sélectionnée */}
            {currentSeason && (
              <button 
                onClick={() => setShowDeleteModal(true)}
                className="season-control-btn delete-season-btn"
                title="Supprimer"
              >
                🗑️
              </button>
            )}
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

            {/* Nouveau bloc de filtres */}
            <h2 style={{ marginTop: '30px' }}>Filtres</h2>
            <div className="filters">
              <div className="filter-group">
                <button
                  className={`filter-btn vert ${statusFilters.has('vert') ? 'active' : ''}`}
                  onClick={() => {
                    const newFilters = new Set(statusFilters)
                    if (newFilters.has('vert')) {
                      newFilters.delete('vert')
                    } else {
                      newFilters.add('vert')
                    }
                    setStatusFilters(newFilters)
                  }}
                >
                  🟢 Top 1
                </button>
                <button
                  className={`filter-btn orange ${statusFilters.has('orange') ? 'active' : ''}`}
                  onClick={() => {
                    const newFilters = new Set(statusFilters)
                    if (newFilters.has('orange')) {
                      newFilters.delete('orange')
                    } else {
                      newFilters.add('orange')
                    }
                    setStatusFilters(newFilters)
                  }}
                >
                  🟠 Top 2-4
                </button>
                <button
                  className={`filter-btn jaune ${statusFilters.has('jaune') ? 'active' : ''}`}
                  onClick={() => {
                    const newFilters = new Set(statusFilters)
                    if (newFilters.has('jaune')) {
                      newFilters.delete('jaune')
                    } else {
                      newFilters.add('jaune')
                    }
                    setStatusFilters(newFilters)
                  }}
                >
                  🟡 Top 5-8
                </button>
                <button
                  className={`filter-btn blanc ${statusFilters.has('blanc') ? 'active' : ''}`}
                  onClick={() => {
                    const newFilters = new Set(statusFilters)
                    if (newFilters.has('blanc')) {
                      newFilters.delete('blanc')
                    } else {
                      newFilters.add('blanc')
                    }
                    setStatusFilters(newFilters)
                  }}
                >
                  ⚪ Non joué
                </button>
              </div>
              
              {/* Boutons de raccourci */}
              <div className="filter-shortcuts">
                <button
                  className="filter-shortcut"
                  onClick={() => setStatusFilters(new Set(['blanc', 'jaune', 'orange', 'vert']))}
                >
                  Tout
                </button>
                <button
                  className="filter-shortcut"
                  onClick={() => setStatusFilters(new Set())}
                >
                  Rien
                </button>
              </div>
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
                        <div className="champion-right">
                          {champion.link_url && (
                            <a
                              href={champion.link_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="champion-link-btn"
                              title="--> Build"
                              onClick={(e) => e.stopPropagation()} // Empêche le changement de statut
                            >
                              🔗
                            </a>
                          )}
                          <div className="status">
                            {champion.status === 'vert' && '🟢 Top 1'}
                            {champion.status === 'orange' && '🟠 Top 2-4'}
                            {champion.status === 'jaune' && '🟡 Top 5-8'}
                            {champion.status === 'blanc' && '⚪ Non joué'}
                          </div>
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
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: '#1a1a1a',
              border: '2px solid rgba(255, 215, 0, 0.5)',
              padding: '30px',
              borderRadius: '12px',
              minWidth: '420px',
              textAlign: 'center',
              boxShadow: '0 10px 30px rgba(255, 215, 0, 0.2)',
              backdropFilter: 'blur(10px)'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>✨</div>
              <h3 style={{ 
                color: '#ffd700', 
                marginBottom: '20px',
                fontSize: '24px',
                fontWeight: '600'
              }}>
                Créer une nouvelle saison
              </h3>
              <input
                id="season-name-input"
                type="text"
                placeholder="Nom de la saison (ex: S2024)"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  margin: '10px 0 20px 0',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  fontSize: '16px',
                  outline: 'none',
                  backdropFilter: 'blur(10px)',
                  boxSizing: 'border-box'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const input = e.target as HTMLInputElement
                    if (input.value.trim()) {
                      createNewSeason(input.value.trim())
                      // Ne plus fermer automatiquement ici
                    }
                  }
                }}
              />
              <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '25px' }}>
                <button
                  onClick={() => {
                    const input = document.getElementById('season-name-input') as HTMLInputElement
                    if (input.value.trim()) {
                      createNewSeason(input.value.trim())
                      // Ne plus fermer automatiquement ici
                    }
                  }}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: 'rgba(74, 144, 226, 0.8)',
                    color: 'white',
                    border: '2px solid rgba(74, 144, 226, 0.5)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: '600',
                    transition: 'all 0.3s ease',
                    backdropFilter: 'blur(10px)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(74, 144, 226, 1)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(74, 144, 226, 0.4)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(74, 144, 226, 0.8)'
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  ✅ Créer
                </button>
                <button
                  onClick={() => setShowSeasonModal(false)}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: 'rgba(108, 117, 125, 0.8)',
                    color: 'white',
                    border: '2px solid rgba(108, 117, 125, 0.5)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: '600',
                    transition: 'all 0.3s ease',
                    backdropFilter: 'blur(10px)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(108, 117, 125, 1)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(108, 117, 125, 0.4)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(108, 117, 125, 0.8)'
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  ❌ Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de suppression de saison */}
        {showDeleteModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: '#1a1a1a',
              border: '2px solid #ff4444',
              padding: '30px',
              borderRadius: '12px',
              minWidth: '400px',
              textAlign: 'center',
              boxShadow: '0 10px 30px rgba(255, 68, 68, 0.3)'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
              <h3 style={{ color: '#ff4444', marginBottom: '15px' }}>
                Supprimer la saison
              </h3>
              <p style={{ color: '#ffffff', marginBottom: '10px' }}>
                Êtes-vous sûr de vouloir supprimer la saison :
              </p>
              <p style={{ 
                color: '#ffd700', 
                fontWeight: 'bold', 
                fontSize: '18px',
                marginBottom: '20px' 
              }}>
                "{currentSeason?.name}"
              </p>
              <p style={{ 
                color: '#ff8888', 
                fontSize: '14px', 
                marginBottom: '25px',
                fontStyle: 'italic' 
              }}>
                ⚠️ Cette action est irréversible ! Tous les statuts des champions seront perdus.
              </p>
              
              <div style={{ 
                display: 'flex', 
                gap: '15px', 
                justifyContent: 'center' 
              }}>
                <button
                  onClick={deleteSeason}
                  style={{
                    padding: '12px 25px',
                    backgroundColor: '#ff4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseOver={(e) => {
                    (e.target as HTMLButtonElement).style.backgroundColor = '#ff6666';
                    (e.target as HTMLButtonElement).style.transform = 'scale(1.05)';
                  }}
                  onMouseOut={(e) => {
                    (e.target as HTMLButtonElement).style.backgroundColor = '#ff4444';
                    (e.target as HTMLButtonElement).style.transform = 'scale(1)';
                  }}
                >
                  🗑️ Supprimer définitivement
                </button>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  style={{
                    padding: '12px 25px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseOver={(e) => {
                    (e.target as HTMLButtonElement).style.backgroundColor = '#8a9ba8';
                    (e.target as HTMLButtonElement).style.transform = 'scale(1.05)';
                  }}
                  onMouseOut={(e) => {
                    (e.target as HTMLButtonElement).style.backgroundColor = '#6c757d';
                    (e.target as HTMLButtonElement).style.transform = 'scale(1)';
                  }}
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de renommage de saison */}
        {showRenameModal && (
          <div 
            className="modal-backdrop"
            onClick={() => setShowRenameModal(false)}
          >
            <div 
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'linear-gradient(135deg, rgba(30, 30, 30, 0.95), rgba(20, 20, 20, 0.98))',
                border: '2px solid rgba(200, 155, 60, 0.3)',
                borderRadius: '12px',
                padding: '30px',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
                zIndex: 1000,
                minWidth: '400px',
                color: '#ffffff'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                <span style={{ fontSize: '1.5em', marginRight: '10px' }}>⚙️</span>
                <h3 style={{ margin: 0, color: '#ffffff' }}>Renommer la saison</h3>
              </div>
              
              <input
                type="text"
                defaultValue={currentSeason?.name || ''}
                placeholder="Nom de la saison"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    renameSeason((e.target as HTMLInputElement).value)
                  }
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  marginBottom: '20px',
                  border: '2px solid rgba(200, 155, 60, 0.3)',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  fontSize: '16px',
                  backdropFilter: 'blur(10px)',
                  boxSizing: 'border-box'
                }}
              />
              
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  onClick={(e) => {
                    const input = e.currentTarget.parentElement?.parentElement?.querySelector('input') as HTMLInputElement
                    if (input) {
                      renameSeason(input.value)
                      // Ne plus fermer automatiquement ici
                    }
                  }}
                  style={{
                    padding: '12px',
                    border: '2px solid rgba(255, 165, 0, 0.5)',
                    borderRadius: '8px',
                    background: 'rgba(255, 165, 0, 0.2)',
                    color: '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    backdropFilter: 'blur(10px)',
                    width: '44px',
                    height: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.2em'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 165, 0, 0.3)'
                    e.currentTarget.style.borderColor = 'rgba(255, 165, 0, 0.7)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 165, 0, 0.2)'
                    e.currentTarget.style.borderColor = 'rgba(255, 165, 0, 0.5)'
                  }}
                >
                  ⚙️
                </button>
                <button
                  onClick={() => setShowRenameModal(false)}
                  style={{
                    padding: '10px 20px',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    backdropFilter: 'blur(10px)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
                  }}
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Modal de déconnexion */}
        {showLogoutModal && (
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(5px)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 2000
            }}
          >
            <div 
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(20px)',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '16px',
                padding: '30px',
                maxWidth: '400px',
                width: '90%',
                textAlign: 'center',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                color: '#ffffff'
              }}
            >
              <h3 style={{ 
                margin: '0 0 15px 0', 
                fontSize: '1.3em', 
                color: '#ffd700' 
              }}>
                Confirmation de déconnexion
              </h3>
              <p style={{ 
                margin: '0 0 25px 0', 
                fontSize: '1.1em', 
                lineHeight: '1.4' 
              }}>
                Êtes-vous sûr de vouloir vous déconnecter ?
              </p>
              <div style={{ 
                display: 'flex', 
                gap: '15px', 
                justifyContent: 'center' 
              }}>
                <button
                  onClick={() => {
                    supabase.auth.signOut()
                    // Ne plus fermer automatiquement ici
                  }}
                  style={{
                    padding: '12px 20px',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.95em',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    minWidth: '120px',
                    background: 'linear-gradient(135deg, #dc3545, #c82333)',
                    color: 'white',
                    boxShadow: '0 2px 8px rgba(220, 53, 69, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #c82333, #a71e2a)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 53, 69, 0.5)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #dc3545, #c82333)'
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(220, 53, 69, 0.3)'
                  }}
                >
                  Oui, me déconnecter
                </button>
                <button
                  onClick={() => setShowLogoutModal(false)}
                  style={{
                    padding: '12px 20px',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '8px',
                    fontSize: '0.95em',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    minWidth: '120px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)'
                  }}
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de profil */}
        {showProfileModal && (
          <div className="modal-backdrop" onClick={() => setShowProfileModal(false)}>
            <div className="account-modal" onClick={(e) => e.stopPropagation()}>
              <div className="account-header">
                <div className="account-avatar">
                  {(selectedAvatar || userProfile?.avatar) ? (
                    <img src={(selectedAvatar || userProfile?.avatar) as string} alt="Aperçu avatar" />
                  ) : (
                    <div className="avatar-placeholder">👤</div>
                  )}
                </div>
                <div className="account-title">
                  <h3>Mon compte</h3>
                  <p>Gérez votre profil et votre sécurité</p>
                </div>
              </div>

              <div className="account-info-grid">
                <div className="info-row">
                  <span className="info-icon">✉️</span>
                  <div className="info-content">{session?.user?.email}</div>
                </div>
                <div className="info-row">
                  <span className="info-icon">🏷️</span>
                  <div className="info-content">
                    {userProfile ? `${userProfile.username}#${userProfile.tag}` : 'Pseudo non défini'}
                  </div>
                </div>
              </div>

              <div className="account-section">
                <h4>Identité publique</h4>
                <div className="handle-row">
                  <input
                    type="text"
                    placeholder="Pseudo"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    className="input"
                  />
                  <input
                    type="text"
                    placeholder="Tag (4 chiffres)"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    className="input tag-input"
                  />
                </div>
                <div className="avatar-grid">
                  {AVAILABLE_AVATARS.map((url) => (
                    <button
                      key={url}
                      className={`avatar-item ${selectedAvatar === url ? 'selected' : ''}`}
                      onClick={() => setSelectedAvatar(url)}
                      title="Choisir cet avatar"
                    >
                      <img src={url} alt="Avatar" />
                    </button>
                  ))}
                </div>
                <div className="section-actions">
                  <button className="primary-btn" onClick={saveUserHandle}>💾 Enregistrer</button>
                </div>
              </div>

              <div className="account-section">
                <h4>Sécurité</h4>
                <div className="password-row">
                  <div className="password-input-wrapper">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      placeholder="Nouveau mot de passe"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="input"
                    />
                    <button
                      className="eye-button"
                      aria-label="Afficher le mot de passe"
                      onMouseDown={() => setShowPwd(true)}
                      onMouseUp={() => setShowPwd(false)}
                      onMouseLeave={() => setShowPwd(false)}
                      onTouchStart={() => setShowPwd(true)}
                      onTouchEnd={() => setShowPwd(false)}
                    >
                      {showPwd ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/>
                          <circle cx="12" cy="12" r="3"/>
                          <path d="M3 3l18 18"/>
                        </svg>
                      )}
                    </button>
                  </div>
                  <div className="password-input-wrapper">
                    <input
                      type={showConfirmPwd ? 'text' : 'password'}
                      placeholder="Confirmer le mot de passe"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input"
                    />
                    <button
                      className="eye-button"
                      aria-label="Afficher le mot de passe"
                      onMouseDown={() => setShowConfirmPwd(true)}
                      onMouseUp={() => setShowConfirmPwd(false)}
                      onMouseLeave={() => setShowConfirmPwd(false)}
                      onTouchStart={() => setShowConfirmPwd(true)}
                      onTouchEnd={() => setShowConfirmPwd(false)}
                    >
                      {showConfirmPwd ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/>
                          <circle cx="12" cy="12" r="3"/>
                          <path d="M3 3l18 18"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div className="section-actions">
                  <button className="primary-btn" onClick={changePassword}>🔒 Mettre à jour</button>
                </div>
              </div>

              <div className="modal-footer">
                <button className="secondary-btn" onClick={() => setShowProfileModal(false)}>Fermer</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
