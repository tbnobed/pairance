import { createRoot } from 'react-dom/client';

import App from './App';

import './index.css';

// Apply the cached theme immediately to avoid a flash of the wrong theme.
if (localStorage.getItem('theme') === 'dark') {
  document.documentElement.classList.add('dark');
}

createRoot(document.getElementById('root')!).render(<App />);
