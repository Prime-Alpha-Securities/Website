import React, { useState } from 'react';
import { Route, Routes, Link } from 'react-router-dom';
import Home from './Home';
import CV from '../pages/cv';
import Contact from '../pages/contact';
import './Navbar.css'; // Ensure this file exists

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div>
      <div className={`sidebar ${isOpen ? 'open' : ''}`}>
        <button className="close-btn" onClick={toggleSidebar}>×</button>
        <ul>
          <li><Link to="/" onClick={toggleSidebar}>Home</Link></li>
          <li><Link to="/cv" onClick={toggleSidebar}>CV</Link></li>
          <li><Link to="/contact" onClick={toggleSidebar}>Contact</Link></li>
        </ul>
      </div>
      <button className="open-btn" onClick={toggleSidebar}>☰</button>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/cv" element={<CV />} />
        <Route path="/contact" element={<Contact />} />
      </Routes>
    </div>
  );
};

export default Navbar;
