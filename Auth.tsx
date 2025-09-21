import { useState } from 'react'
import { supabase } from './lib/supabase'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
      const { error } = await supabase.auth.signUp({ email, password })
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
    <div style={{ 
      maxWidth: '400px', 
      margin: '50px auto', 
      padding: '30px',
      backgroundColor: '#fff',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
    }}>
      <h2 style={{ textAlign: 'center', marginBottom: '30px', color: '#333' }}>
        Stats Arena - Connexion
      </h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          disabled={loading}
          style={{ 
            padding: '12px', 
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px'
          }}
        />
        
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={e => setPassword(e.target.value)}
          disabled={loading}
          style={{ 
            padding: '12px', 
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px'
          }}
        />
        
        <button 
          onClick={handleLogin}
          disabled={loading || !email || !password}
          style={{ 
            padding: '12px', 
            cursor: loading ? 'not-allowed' : 'pointer',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
        
        <button 
          onClick={handleSignup}
          disabled={loading || !email || !password}
          style={{ 
            padding: '12px', 
            cursor: loading ? 'not-allowed' : 'pointer',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Création...' : 'Créer un compte'}
        </button>
        
        <div style={{ textAlign: 'center', margin: '10px 0', color: '#666' }}>
          ou
        </div>
        
        <button 
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{ 
            padding: '12px', 
            cursor: loading ? 'not-allowed' : 'pointer',
            backgroundColor: '#4285f4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            opacity: loading ? 0.6 : 1
          }}
        >
          <span>🔍</span>
          {loading ? 'Connexion Google...' : 'Se connecter avec Google'}
        </button>
        
        {error && (
          <div style={{ 
            padding: '10px', 
            backgroundColor: '#f8d7da', 
            color: '#721c24',
            border: '1px solid #f5c6cb',
            borderRadius: '4px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
