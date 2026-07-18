import { Navigate, Outlet } from 'react-router-dom'

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token')

  if (!token) {
    return <Navigate to="/login" replace />
  }

  // Si envuelve rutas anidadas (Outlet), o un hijo directo, ambos funcionan
  return children ? children : <Outlet />
}

export default PrivateRoute