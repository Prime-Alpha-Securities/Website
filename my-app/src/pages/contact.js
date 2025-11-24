// src/pages/Contact.js
import React, { useState } from "react";
import emailjs from 'emailjs-com';


export default function Contact() {
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    message: ''
  });

  const handleChange = (e) => {
    setFormState({
      ...formState,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    emailjs.send(
      process.env.service_id,    // Replace with your service ID
      process.env.template_id,   // Replace with your template ID
      formState,
      process.env.user_id        // Replace with your user ID
    )
    .then((response) => {
      alert('Message sent successfully!', response.status, response.text);
      setFormState({ name: '', email: '', message: '' }); // Reset form after successful submission
    }, (err) => {
      alert('Failed to send the message, please try again.', err);
    });
  };

  return (
    <div>
      <main>
        <h1>Contact Me</h1>
        <form onSubmit={handleSubmit}>
          <label htmlFor="name">Name:</label>
          <input 
            type="text" 
            id="name" 
            name="name" 
            value={formState.name} 
            onChange={handleChange} 
            required 
          /><br />
          <label htmlFor="email">Email:</label>
          <input 
            type="email" 
            id="email" 
            name="email" 
            value={formState.email} 
            onChange={handleChange} 
            required 
          /><br />
          <label htmlFor="message">Message:</label><br />
          <textarea 
            id="message" 
            name="message" 
            rows="4" 
            value={formState.message} 
            onChange={handleChange} 
            required 
          ></textarea><br />
          <input type="submit" value="Submit" />
        </form>
      </main>
    </div>
  );
}
