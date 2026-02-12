import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<any>(null)
  const token = ref<string | null>(localStorage.getItem('authToken') || null)
  const isAuthenticated = computed(() => !!user.value && !!token.value)

  const login = async (credentials: { username: string; password: string }) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      })

      if (!response.ok) {
        throw new Error('Login failed')
      }

      const data = await response.json()
      user.value = data.user
      token.value = data.token
      localStorage.setItem('authToken', data.token)
      return data
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  }

  const logout = async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.value}`,
        },
      })
      user.value = null
      token.value = null
      localStorage.removeItem('authToken')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const checkAuth = async () => {
    if (!token.value) {
      user.value = null
      return
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token.value}`,
        },
      })
      if (response.ok) {
        try {
          const data = await response.json()
          user.value = data
        } catch (jsonError) {
          console.error('Invalid JSON response:', jsonError)
          user.value = null
          token.value = null
          localStorage.removeItem('authToken')
        }
      } else {
        user.value = null
        token.value = null
        localStorage.removeItem('authToken')
      }
    } catch (error) {
      console.error('Check auth error:', error)
      user.value = null
      token.value = null
      localStorage.removeItem('authToken')
    }
  }

  // Helper function to get auth headers for API calls
  const getAuthHeaders = () => {
    return token.value ? { 'Authorization': `Bearer ${token.value}` } : {}
  }

  const setUser = (userData: any) => {
    user.value = userData;
  };

  return {
    user,
    token,
    isAuthenticated,
    login,
    logout,
    checkAuth,
    getAuthHeaders,
    setUser,
  }
})
