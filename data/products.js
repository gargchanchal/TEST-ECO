/**
 * Simple in-memory product catalog for demo purposes.
 * In production, replace with a database.
 */

const products = [
  {
    id: 'p001',
    name: 'Aurora Headphones',
    description: 'Wireless over-ear headphones with immersive sound and 30h battery life.',
    priceCents: 12999,
    currency: 'usd',
    image: '/images/aurora.jpg',
  },
  {
    id: 'p002',
    name: 'Lumen Smart Lamp',
    description: 'Compact smart lamp with dynamic color scenes and touch dimming.',
    priceCents: 5999,
    currency: 'usd',
    image: '/images/lumen.jpg',
  },
  {
    id: 'p003',
    name: 'Nimbus Keyboard',
    description: 'Low-profile mechanical keyboard with hot-swappable switches.',
    priceCents: 8999,
    currency: 'usd',
    image: '/images/nimbus.jpg',
  },
  {
    id: 'p004',
    name: 'Zephyr Mouse',
    description: 'Ergonomic wireless mouse with adjustable DPI and silent clicks.',
    priceCents: 3999,
    currency: 'usd',
    image: '/images/zephyr.jpg',
  },
];

function findProductById(productId) {
  return products.find((p) => p.id === productId) || null;
}

module.exports = {
  products,
  findProductById,
};

