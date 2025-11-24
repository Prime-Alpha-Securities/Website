import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Navbar from './components/Navbar';
import Cards from './components/Cards'; 
import SecondWebsite from './SecondWebsite/secondWebsite';
import Game from './components/Game';
import './index.css';

function App() {
  return (
    <Router>
      <div>
        <Navbar />
        <Routes>
          <Route 
            path="/" 
            element={
              <div>
                <h1 className='show' draggable='true'>
                  <a>J</a><b>o</b><c>h</c><e>a</e><f>n</f>'s W<i>or</i>ld!<g>!</g>
                  <span className='second' draggable='true'><Link to="/second-website">!</Link></span>
                </h1>
                <p className='hidden'> <Link to="/my-app/src/components/Game.js">.... . .-. .  .. ...  - .... .  --. .- -- .</Link></p>
                <Cards
                  img="/images/js/node.jpg"
                  alt="node.js"
                  name="Node.js"
                  href="../pages/node" 
                />
                <Cards
                  img="/images/aws/aws.jpg"
                  alt="aws cloud provider"
                  name="AWS"
                  href="../pages/aws"
                />
                <Cards
                  img="/images/cloud/devops.jpg"
                  alt="devops"
                  name="DevOps"
                  href="../pages/devops"
                />
                <Cards
                  img="/images/python/python.jpg"
                  alt="python"
                  name="Python"
                  href="../pages/python"
                />
                <Cards
                  img="/images/c++/c++.jpg"
                  alt="c++"
                  name="C++"
                  href="../pages/c++.html"
                />
                <a className="top" href="#head"><h5>BACK TO TOP</h5></a>
              </div>
            } 
          />
          <Route path='/hidden-game' element ={<Game />} />
          <Route path="/second-website" element={<SecondWebsite />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
