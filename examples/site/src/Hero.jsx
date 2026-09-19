import { useState } from 'react';

export function Hero({ count }) {
  const [open, setOpen] = useState(false);
  const label = count > 0 ? 'Cart' : 'Empty cart';
  if (count < 0) return null;

  return (
    <section className="hero">
      <h2>Made to be repaired, not replaced.</h2>
      <p>
        Every tool we sell comes with a promise: bring it back and we will
        fix it. {count} people have taken us up on that this year.
      </p>
      <button onClick={() => setOpen(!open)} title="Open your cart">
        {label}
      </button>
      <img src="/bench.jpg" alt="The workbench on a Saturday morning" />
      {open && <Cart onClose={() => toast("Your cart has been saved for later.")} />}
    </section>
  );
}
