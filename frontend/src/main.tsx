import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { initInteractiveMovable } from './utils/interactiveHover';

// Initialize professional 3D tilt & movable hover physics across all pages and sections
initInteractiveMovable();

// Note: StrictMode is intentionally omitted in development to prevent
// double-invocation of useEffect (which causes duplicate API calls to the backend).
createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

