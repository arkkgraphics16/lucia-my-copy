import { useEffect, useState } from 'react'
export function useAuthToken(){
  const [user,setUser]=useState(null)
  const [token,setToken]=useState('')
  useEffect(()=>{ setUser(null); setToken('') },[])
  return { user, token }
}
