import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// Fonts bundled with the site (no call to Google Fonts)
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/figtree';
import '@fontsource-variable/figtree/wght-italic.css';
import '@fontsource-variable/newsreader';
import '@fontsource-variable/newsreader/wght-italic.css';
import '@fontsource/jetbrains-mono/400.css';
import './styles/global.css';
import { applyAppearance } from './hooks/appearance';

// Apply the saved theme before the first paint (no flash)
applyAppearance();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);
