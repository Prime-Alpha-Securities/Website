import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist/webpack';
import 'pdfjs-dist/web/pdf_viewer.css';

const PdfViewer = ({ pdfUrl }) => {
  const [pdf, setPdf] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const canvasRef = useRef(null);

  useEffect(() => {
    const loadPdf = async () => {
      const loadingTask = pdfjsLib.getDocument(pdfUrl);
      const loadedPdf = await loadingTask.promise;
      setPdf(loadedPdf);
      renderPage(loadedPdf, 1); // Render the first page initially
    };

    loadPdf();
  }, [pdfUrl]);

  const renderPage = async (pdf, pageNum) => {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    page.render(renderContext);
  };

  const goToPreviousPage = () => {
    if (pageNumber > 1) {
      setPageNumber(pageNumber - 1);
      renderPage(pdf, pageNumber - 1);
    }
  };

  const goToNextPage = () => {
    if (pdf && pageNumber < pdf.numPages) {
      setPageNumber(pageNumber + 1);
      renderPage(pdf, pageNumber + 1);
    }
  };

  return (
    <div>
      <div>
        <button onClick={goToPreviousPage} disabled={pageNumber <= 1}>
          Previous
        </button>
        <button onClick={goToNextPage} disabled={pdf && pageNumber >= pdf.numPages}>
          Next
        </button>
      </div>
      <canvas ref={canvasRef}></canvas>
      <p>
        Page {pageNumber} of {pdf ? pdf.numPages : '--'}
      </p>
    </div>
  );
};

export default PdfViewer;
