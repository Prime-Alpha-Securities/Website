import React from 'react';
import { Link, Route, Routes } from 'react-router-dom';

function Cards(props) {
    const { href, img, alt, name, Component } = props;

    return (
        <div className="container">
            <div className='card'>
                <Link to={href}><img src={img} alt={alt} className='card--img' /></Link>
                <h1 className='card--name'>{name}</h1>
            </div>
            
            {/* This should be placed in a component that handles routing, not directly inside the Cards component */}
            <Routes>
                <Route path={href} element={<Component />} />
            </Routes>
        </div>
    );
}

export default Cards;

