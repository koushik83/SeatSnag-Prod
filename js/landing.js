function selectPlan(planType) {
  // This would integrate with Stripe Checkout
  alert(`Selected ${planType} plan! This would redirect to Stripe Checkout.`);
  
  // Example Stripe integration:
  // stripe.redirectToCheckout({
  //   lineItems: [{
  //     price: getPriceId(planType),
  //     quantity: 1,
  //   }],
  //   mode: 'subscription',
  //   successUrl: 'https://seatsnag.com/success',
  //   cancelUrl: 'https://seatsnag.com/pricing',
  // });
}

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

// Navbar scroll effect
window.addEventListener('scroll', () => {
  const navbar = document.querySelector('.navbar');
  if (window.scrollY > 100) {
    navbar.style.background = 'rgba(255, 255, 255, 0.98)';
    navbar.style.borderBottom = '1px solid rgba(102, 126, 234, 0.2)';
  } else {
    navbar.style.background = 'rgba(255, 255, 255, 0.95)';
    navbar.style.borderBottom = '1px solid rgba(102, 126, 234, 0.1)';
  }
});