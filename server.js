require('dotenv').config();

const path = require('path');
const express = require('express');
const morgan = require('morgan');
const session = require('express-session');
const { products, findProductById } = require('./data/products');

const app = express();

const port = process.env.PORT || 4242;
const isStripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
const stripe = isStripeConfigured ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

// Basic product details for testing
const TEST_PRODUCT_NAME = 'Demo Product';
const TEST_PRODUCT_AMOUNT_CENTS = 1999; // $19.99
const TEST_CURRENCY = 'usd';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));
app.use(morgan('dev'));
app.use(
  session({
    name: 'sid',
    secret: process.env.SESSION_SECRET || 'dev_secret_for_demo_only',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

function getCart(req) {
  if (!req.session.cart) {
    req.session.cart = { items: [], totalCents: 0 };
  }
  return req.session.cart;
}

function recalcCartTotals(cart) {
  cart.totalCents = cart.items.reduce(
    (sum, item) => sum + item.product.priceCents * item.quantity,
    0
  );
}

// Share common locals for templates
app.use((req, res, next) => {
  const cart = getCart(req);
  const cartItemCount = cart.items.reduce((sum, it) => sum + it.quantity, 0);
  res.locals.cartItemCount = cartItemCount;
  res.locals.stripeConfigured = isStripeConfigured;
  next();
});

app.get('/', (req, res) => {
  res.redirect('/products');
});

// Product listing
app.get('/products', (req, res) => {
  res.render('products/index', { products });
});

// Product detail
app.get('/products/:id', (req, res, next) => {
  const product = findProductById(req.params.id);
  if (!product) return res.status(404).render('error', { status: 404, message: 'Product not found' });
  res.render('products/show', { product });
});

// Cart routes
app.get('/cart', (req, res) => {
  const cart = getCart(req);
  recalcCartTotals(cart);
  res.render('cart', { cart });
});

app.post('/cart/add', (req, res) => {
  const { productId } = req.body;
  const quantity = Math.max(1, parseInt(req.body.quantity, 10) || 1);
  const product = findProductById(productId);
  if (!product) return res.status(404).render('error', { status: 404, message: 'Product not found' });

  const cart = getCart(req);
  const existing = cart.items.find((it) => it.product.id === product.id);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.items.push({ product, quantity });
  }
  recalcCartTotals(cart);
  res.redirect('/cart');
});

app.post('/cart/update', (req, res) => {
  const quantities = req.body.quantities || {};
  const removeId = req.body.remove || null;
  const cart = getCart(req);

  if (removeId) {
    cart.items = cart.items.filter((it) => it.product.id !== removeId);
  } else {
    cart.items.forEach((it) => {
      const raw = quantities[it.product.id];
      const nextQty = Math.max(1, parseInt(raw, 10) || it.quantity);
      it.quantity = nextQty;
    });
  }

  recalcCartTotals(cart);
  res.redirect('/cart');
});

// Removed /cart/remove in favor of unified /cart/update

// Checkout from cart
app.post('/checkout', async (req, res, next) => {
  try {
    if (!isStripeConfigured) {
      return res.status(500).send('Stripe is not configured. Set STRIPE_SECRET_KEY in .env');
    }

    const cart = getCart(req);
    if (!cart.items.length) {
      return res.redirect('/cart');
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const line_items = cart.items.map((it) => ({
      price_data: {
        currency: it.product.currency,
        product_data: { name: it.product.name },
        unit_amount: it.product.priceCents,
      },
      quantity: it.quantity,
    }));

    const sessionCheckout = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/cancel`,
    });

    return res.redirect(303, sessionCheckout.url);
  } catch (error) {
    return next(error);
  }
});

app.get('/success', async (req, res, next) => {
  try {
    const { session_id: sessionId } = req.query;
    if (!isStripeConfigured || !sessionId) {
      return res.render('success', { session: null });
    }

    const session = await stripe.checkout.sessions.retrieve(String(sessionId));

    return res.render('success', { session });
  } catch (error) {
    return next(error);
  }
});

app.get('/cancel', (req, res) => {
  res.render('cancel');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Avoid leaking sensitive Stripe errors in production
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  if (process.env.NODE_ENV !== 'test') {
    // Log full error server-side for debugging
    // eslint-disable-next-line no-console
    console.error(err);
  }
  res.status(status).render('error', { status, message });
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${port}`);
  if (!isStripeConfigured) {
    // eslint-disable-next-line no-console
    console.warn('Warning: STRIPE_SECRET_KEY is not set. Set it in .env to enable payments.');
  }
});

