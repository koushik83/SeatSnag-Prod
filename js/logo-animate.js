// SeatSnag Logo Animation Trigger
window.addEventListener('load', () => {
  setTimeout(() => {
    const logos = document.querySelectorAll('#seatSnagLogo, #seatSnagLogoSignup, #seatSnagLogoVerify, #seatSnagLogoPayment, #seatSnagLogoAdmin');
    logos.forEach(logo => {
      if (logo) {
        logo.classList.add('active');
      }
    });
  }, 500);
});
