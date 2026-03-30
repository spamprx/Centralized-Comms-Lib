import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { createTheme } from '@mui/material/styles'
import { AuthProvider } from './context/AuthContext'
import { ReviewProvider } from './context/ReviewContext'
import { EditorProvider } from './context/EditorContext'
import "./styles/index.css";
import { App } from "./layouts";

const theme = createTheme({
  palette: { mode: 'dark' },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <ReviewProvider>
            <EditorProvider>
              <App />
            </EditorProvider>
          </ReviewProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)

// console.log('VITE_API_URL:', import.meta.env.VITE_API_URL);
