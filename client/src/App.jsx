import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import CallPage from './pages/CallPage';
import Admin from './pages/Admin';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/call/:id" element={<CallPage />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  );
}
