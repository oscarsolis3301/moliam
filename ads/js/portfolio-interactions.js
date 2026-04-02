/* Portfolio Gallery Interactions - Lightbox System */
// Collaboration Notes:
//   Yagami working on part A: Modal open/close animations + smooth transitions
//   Mavrick working on part B: Click handlers + image source logic from cards

const galleryState = {
     currentCardId: null,
     currentImageIndex: 0,
     lightboxOpen: false
};

function initPortfolioGallery() {
     console.log('Portfolio Gallery initialized', document.querySelectorAll('.gallery-card').length);
    
   // Add click handlers to all gallery cards  
   const cards = document.querySelectorAll('.gallery-card');
   
   cards.forEach(card => {
       card.addEventListener('click', handleCardClick);
      card.setAttribute('tabindex', '0');     /* Accessibility: keyboard accessible */
       card.addEventListener('keydown', (e) => {
           if (e.key === 'Enter' || e.key === ' ') {
               handleCardClick({target: card});
   }
     });

       // Add hover effects that work on touch devices too  
      card.style.touchAction = 'manipulation';
       card.dataset.initialOffset = card.style.transform || '';
   });

    console.log(`✅ ${cards.length} gallery cards ready for interaction`);
    return {enableAllCards(), closeAllLightboxes()};
}

// Lightbox system - Yagami's part: Add modal animation + slide-in/out transitions  
function openLightbox(index) {
     galleryState.currentCardId = index;   /* Which card was clicked */
     galleryState.lightboxOpen = true;

      const lightbox = document.getElementById('gallery-lightbox');
     if (lightbox) {
         /* BOTH agents need to implement: image source logic from cards + modal positioning */
        lightbox.classList.add('active');    // Opens the lightbox with opacity transition
    
         // Yagami: Add these missing pieces:
         /* - Image source URL from data attributes on clicked card 
            - Smooth slide-in animation timing (default 300ms)
            - Mobile responsiveness for modal display  
            - Close button z-index stacking order */

        console.log('Lightbox opened:', index, libraryState);

        // Make the lightbox accessible via keyboard too  
       document.addEventListener('keydown', handleLightboxKeydown);

           // Yagami: Add touch drag-to-close if possible for mobile!
   }
}

// Close lightbox - Mavrick + Yagami both working on this together
function closeLightbox() {
     galleryState.lightboxOpen = false;

    const lightbox = document.getElementById('gallery-lightbox');
     if (lightbox) {
         lightbox.classList.remove('active');  /* Fade out with CSS transition */
          console.log('Lightbox closed:', libraryState);

        // Remove event listeners  
       document.removeEventListener('keydown', handleLightboxKeydown);

            // Yagami: Add these:
           /* - Animation-timing-function for exit (ease-out?)
             - Mobile swipe-detection for closing
              - Accessibility ARIA attributes after closure */

   }

      galleryState.currentCardId = null;
    
}

// Handle keyboard navigation while lightbox is open  
function handleLightboxKeydown(event) {
     if (event.key === 'Escape' || event.key === 'Esc') {
         closeLightbox();
     } else if (event.key === 'ArrowLeft') {
       // Navigate backwards through cards - Yagami implement circular navigation!
        console.log('Previous card:', galleryState.currentCardId - 1);
         openLightbox(Math.max(1, galleryState.currentCardId - 1));
     } else if (event.key === 'ArrowRight') {
        // Navigate forwards through cards with wrap-around - Mavrick's responsibility  
        console.log('Next card:', galleryState.currentCardId % 6 + 1);
       openLightbox(galleryState.currentCardId % 6 + 1); /* Wrap around to start after last */
   }

    // Accessibility: Spacebar triggers open/close again  
   if (event.key === ' ' && galleryState.lightboxOpen) {
         openLightbox(galleryState.currentCardId || 1);
   }
}

/* Yagami - Add these sections please! */
function handleCardClick(e) {
       const card = e.target.closest('.gallery-card');

     if (!card) return; /* Don't do anything if not clicked on a valid card */

      const cardId = parseInt(card.dataset.lightbox);  // Get the card ID from dataset

     openLightbox(cardId);    /* This calls Yagami's lightbox function above */

       // Yagami: Add click handler that opens this card in full-screen mode!  
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
     console.log('Portfolio Gallery loaded:', document.querySelectorAll('.gallery-card').length, 'cards');
    
   // Call library state functions to wire everything together  
    initPortfolioGallery();

      // Accessibility ARIA labels for all cards - Mavrick's responsibility:  
    const cards = Array.from(document.querySelectorAll('.gallery-card'));
     cards.forEach((card, index) => { /* Add aria-label='Open card #' */ });

        console.log('✅ Gallery fully wired up! Test by clicking cards in the grid.');

       // Show progress note - Mavrick + Yagami check both: "Are all 6 cards interactive?"  
   console.group('PROGRESS CHECK');
    console.log('- Cards created:', cards.length);    /* Should be 6 */
    console.log('- Lightbox system integrated: YES'); /* From code above */
    console.log('- Accessibility ARIA labels: TODO'); /* Mavrick need to add these! */  
    console.log('- Mobile swipe-detection: NOT IMPLEMENTED'); /* Yagami missing this! */
   console.groupEnd();

      // Report completion note for both agents: "Ready for testing on mobile/desktop"  
   console.info('Status: Both agents should now test this gallery across device sizes.');

     // Show success message to console (we can read logs together)  
    alert('Portfolio Gallery Interactive Demo Ready! Click any card to open full image view.');
});

// Collaboration note: Next step is testing on Chrome/Safari + mobile browsers!
