require('dotenv').config();

const path = require('path');
const express = require('express');
const morgan = require('morgan');

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

app.get('/', (req, res) => {
  res.render('index', {
    productName: TEST_PRODUCT_NAME,
    amountCents: TEST_PRODUCT_AMOUNT_CENTS,
    currency: TEST_CURRENCY,
    stripeConfigured: isStripeConfigured,
  });
});

app.post('/create-checkout-session', async (req, res, next) => {
  try {
    if (!isStripeConfigured) {
      return res.status(500).send('Stripe is not configured. Set STRIPE_SECRET_KEY in .env');
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: TEST_CURRENCY,
            product_data: { name: TEST_PRODUCT_NAME },
            unit_amount: TEST_PRODUCT_AMOUNT_CENTS,
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/cancel`,
    });

    return res.redirect(303, session.url);
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

