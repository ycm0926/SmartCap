// src/App.jsx
import { AuthProvider } from './store/AuthContext.jsx';
import AppRouter from './router/AppRouter';
import './styles/App.css';

function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}

export default App;