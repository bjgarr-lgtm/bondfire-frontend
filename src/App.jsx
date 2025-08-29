import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Reset from './pages/Reset.jsx';
import MFA from './pages/MFA.jsx';
import Header from './components/Header.jsx';

export default function App(){
  return (
    <div className="app">
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/reset" element={<Reset />} />
        <Route path="/mfa" element={<MFA />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
