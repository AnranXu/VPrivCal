import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { DataProvider } from './context/DataContext';
import { StudyProvider } from './context/StudyContext';
import './styles.css';
import { canonicalizeEntryUrl } from './utils/mode';

canonicalizeEntryUrl();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DataProvider>
      <StudyProvider>
        <App />
      </StudyProvider>
    </DataProvider>
  </StrictMode>,
);
