import { useState } from 'react'
import { supabase } from './lib/supabase'
import './src/Auth.css'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [pseudo, setPseudo] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        console.error('❌ Erreur de connexion:', error)
        setError(error.message)
      } else {
        console.log('✅ Connexion réussie')
      }
    } catch (err) {
      console.error('❌ Erreur réseau:', err)
      setError('Erreur de connexion réseau')
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const desired = (pseudo || (email.split('@')[0] || '')).trim()
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { desired_username: desired } // stocke le pseudo voulu en metadata
        }
      })
      if (error) {
        console.error('❌ Erreur d\'inscription:', error)
        setError(error.message)
      } else {
        console.log('✅ Inscription réussie - Vérifiez votre email')
        setError('Vérifiez votre email pour confirmer votre compte')
      }
    } catch (err) {
      console.error('❌ Erreur réseau:', err)
      setError('Erreur de connexion réseau')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError(null)
    
    try {
      console.log('🔄 Tentative de connexion Google...')
      console.log('URL de redirection:', window.location.origin)
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      })
      
      if (error) {
        console.error('❌ Erreur Google OAuth:', error)
        setError(`Erreur Google: ${error.message}`)
      } else {
        console.log('✅ Redirection Google initiée:', data)
      }
    } catch (err) {
      console.error('❌ Erreur réseau Google:', err)
      setError('Erreur de connexion Google')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">Stats Arena</h1>
          <p className="auth-subtitle">Suivez vos champions League of Legends</p>
        </div>
        
        <div className="auth-form">
          <div className="input-group">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={loading}
              className="auth-input"
            />
          </div>
          {/* Champ Pseudo affiché uniquement en inscription */}
          {isSignUp && (
            <div className="input-group">
              <input
                type="text"
                placeholder="Pseudo"
                value={pseudo}
                onChange={e => setPseudo(e.target.value)}
                disabled={loading}
                className="auth-input"
              />
            </div>
          )}
          <div className="input-group">
            <input
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
              className="auth-input"
            />
          </div>
          
          <button 
            onClick={isSignUp ? handleSignup : handleLogin}
            disabled={loading || !email || !password || (isSignUp && !pseudo)}
            className="auth-btn primary"
          >
            {loading ? (
              <span className="loading-spinner">⏳</span>
            ) : (
              isSignUp ? 'Créer un compte' : 'Se connecter'
            )}
          </button>
          
          <div className="auth-divider">
            <span>ou</span>
          </div>
          
          <button 
            onClick={handleGoogleLogin}
            disabled={loading}
            className="auth-btn google"
          >
            <span className="google-icon">🔍</span>
            {loading ? 'Connexion...' : 'Continuer avec Google'}
          </button>
          
          <button 
            onClick={() => {
              setIsSignUp(!isSignUp)
              setError(null)
            }}
            className="auth-toggle"
            disabled={loading}
          >
            {isSignUp ? 'Déjà un compte ? Se connecter' : 'Pas de compte ? S\'inscrire'}
          </button>
          
          {error && (
            <div className="auth-error">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
