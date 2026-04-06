import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ReviewProvider } from './context/ReviewContext'
import { EditorProvider } from './context/EditorContext'
import "./styles/index.css";
import { App } from "./layouts";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ReviewProvider>
          <EditorProvider>
            <App />
          </EditorProvider>
        </ReviewProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

// console.log('VITE_API_URL:', import.meta.env.VITE_API_URL);
