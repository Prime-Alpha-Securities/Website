import React from 'react';
import PdfViewer from '../components/PdfViewer';

export default function CV() {
  const pdfUrl = '/images/others/Johan\'s_CV.pdf'; // Ensure this path is correct and accessible

  return (
    <div className="cv">
      <h1 draggable='true'>JOHAN'S CV</h1>
      <PdfViewer pdfUrl={pdfUrl} />
    </div>
  );
}
