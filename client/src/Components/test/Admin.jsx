import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FaSearch,
  FaShoppingCart,
  FaHeart,
  FaStar,
  FaChevronLeft,
  FaChevronRight,
  FaFilter,
  FaTags,
} from "react-icons/fa";

/**
 * Single-file ecommerce homepage / landing page.
 * - Top hero slider
 * - Campaign (badge) filter
 * - Search
 * - Category cards
 * - Product grid
 * - "See more" expandable details
 * - Pagination
 *
 * TailwindCSS required.
 */

const HERO_SLIDES = [
  {
    id: "s1",
    title: "New Year Mega Sale",
    subtitle: "Up to 60% off on fashion, electronics & more",
    cta: "Shop Deals",
    bg: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=2200&q=80",
    tag: "SALE",
  },
  {
    id: "s2",
    title: "Fresh Drops for 2026",
    subtitle: "New arrivals curated for your daily essentials",
    cta: "Explore New",
    bg: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=2200&q=80",
    tag: "NEW",
  },
  {
    id: "s3",
    title: "Fast Delivery, Easy Returns",
    subtitle: "Order in minutes — track every step, return with ease",
    cta: "Start Shopping",
    bg: "https://images.unsplash.com/photo-1515165562835-c3b8c9f93474?auto=format&fit=crop&w=2200&q=80",
    tag: "FAST",
  },
];

const CAMPAIGNS = [
  { key: "all", label: "All" },
  { key: "sale", label: "On Sale" },
  { key: "new", label: "New" },
  { key: "hot", label: "Trending" },
  { key: "freeShip", label: "Free Shipping" },
];

const CATEGORIES = [
  {
    key: "fashion",
    label: "Fashion",
    emoji: "🧥",
    blurb: "Streetwear & essentials",
  },
  {
    key: "electronics",
    label: "Electronics",
    emoji: "🎧",
    blurb: "Audio, gadgets, more",
  },
  {
    key: "home",
    label: "Home",
    emoji: "🏠",
    blurb: "Decor & daily living",
  },
  {
    key: "beauty",
    label: "Beauty",
    emoji: "💄",
    blurb: "Skincare & self-care",
  },
  {
    key: "sports",
    label: "Sports",
    emoji: "🏃",
    blurb: "Gear & performance",
  },
  {
    key: "grocery",
    label: "Grocery",
    emoji: "🥑",
    blurb: "Fresh & pantry",
  },
];

// Mock products (replace with API data later)
const PRODUCTS = [
  {
    id: "p1",
    title: "Wireless Noise-Canceling Headphones",
    price: 89.99,
    compareAt: 129.99,
    rating: 4.6,
    reviews: 1824,
    category: "electronics",
    campaign: ["sale", "hot", "freeShip"],
    image:
      "https://images.unsplash.com/photo-1518441902117-f0aebd98d314?auto=format&fit=crop&w=1200&q=80",
    desc:
      "Punchy sound, adaptive noise canceling, and a lightweight fit for all-day comfort. Includes quick-charge support and multi-device pairing.",
  },
  {
    id: "p2",
    title: "Minimal Sneakers",
    price: 49.0,
    compareAt: 0,
    rating: 4.4,
    reviews: 932,
    category: "fashion",
    campaign: ["new", "freeShip"],
    image:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80",
    desc:
      "Clean, comfortable, and built for everyday wear. Breathable upper with a durable sole for long walks and quick errands.",
  },
  {
    id: "p3",
    title: "Ceramic Mug Set (6 pcs)",
    price: 22.5,
    compareAt: 28.0,
    rating: 4.7,
    reviews: 411,
    category: "home",
    campaign: ["sale"],
    image:
      "https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&w=1200&q=80",
    desc:
      "A timeless mug set with a smooth glaze. Microwave-safe, dishwasher-safe, and perfect for coffee, tea, or hot chocolate.",
  },
  {
    id: "p4",
    title: "Hydrating Face Serum",
    price: 19.99,
    compareAt: 0,
    rating: 4.5,
    reviews: 267,
    category: "beauty",
    campaign: ["new"],
    image:
      "https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?auto=format&fit=crop&w=1200&q=80",
    desc:
      "A lightweight serum formulated to hydrate and brighten. Designed for daily use with a smooth, non-sticky finish.",
  },
  {
    id: "p5",
    title: "Running Shoes Pro",
    price: 74.95,
    compareAt: 99.95,
    rating: 4.3,
    reviews: 705,
    category: "sports",
    campaign: ["sale", "hot"],
    image:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80",
    desc:
      "Responsive cushioning and a breathable mesh upper. Ideal for daily runs, training sessions, and long walks.",
  },
  {
    id: "p6",
    title: "Modern Table Lamp",
    price: 34.0,
    compareAt: 0,
    rating: 4.2,
    reviews: 188,
    category: "home",
    campaign: ["freeShip"],
    image:
      "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=1200&q=80",
    desc:
      "Warm ambient light with a minimalist silhouette. Great for bedrooms, reading corners, and cozy desks.",
  },
  {
    id: "p7",
    title: "Premium Hoodie",
    price: 39.99,
    compareAt: 55.0,
    rating: 4.8,
    reviews: 1209,
    category: "fashion",
    campaign: ["sale", "hot"],
    image:
      "https://images.unsplash.com/photo-1520975682071-a57d5f7f5e08?auto=format&fit=crop&w=1200&q=80",
    desc:
      "Soft fleece interior, structured hood, and a relaxed fit. Built for comfort with clean seams and durable stitching.",
  },
  {
    id: "p8",
    title: "Smart Fitness Band",
    price: 29.99,
    compareAt: 39.99,
    rating: 4.1,
    reviews: 1433,
    category: "electronics",
    campaign: ["sale", "freeShip"],
    image:
      "https://images.unsplash.com/photo-1557825835-70d97c4aa567?auto=format&fit=crop&w=1200&q=80",
    desc:
      "Track steps, sleep, and workouts with week-long battery life. Water-resistant and easy to sync to your phone.",
  },
  {
    id: "p9",
    title: "Everyday Sunscreen SPF 50",
    price: 15.0,
    compareAt: 0,
    rating: 4.6,
    reviews: 514,
    category: "beauty",
    campaign: ["hot", "freeShip"],
    image:
      "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=1200&q=80",
    desc:
      "Lightweight protection with no white cast. Wear under makeup or on its own for daily UV defense.",
  },
  {
    id: "p10",
    title: "Organic Mixed Nuts (1kg)",
    price: 17.25,
    compareAt: 0,
    rating: 4.7,
    reviews: 322,
    category: "grocery",
    campaign: ["new", "freeShip"],
    image:
      "https://images.unsplash.com/photo-1546554137-f86b9593a222?auto=format&fit=crop&w=1200&q=80",
    desc:
      "A balanced mix of almonds, cashews, walnuts, and more. Great for snacking, topping bowls, or baking.",
  },
  {
    id: "p11",
    title: "Bluetooth Speaker Mini",
    price: 24.99,
    compareAt: 0,
    rating: 4.0,
    reviews: 990,
    category: "electronics",
    campaign: ["hot"],
    image:
      "https://images.unsplash.com/photo-1558537348-c0f8e733989d?auto=format&fit=crop&w=1200&q=80",
    desc:
      "Pocket-size speaker with surprisingly big sound. Easy pairing, solid bass, and a sturdy travel-friendly body.",
  },
  {
    id: "p12",
    title: "Kitchen Knife Set",
    price: 52.0,
    compareAt: 74.0,
    rating: 4.5,
    reviews: 278,
    category: "home",
    campaign: ["sale"],
    image:
      "https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&w=1200&q=80",
    desc:
      "Sharp, balanced, and easy to maintain. Includes essential blades for slicing, dicing, and prep work.",
  },
];

function money(n) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function Stars({ rating }) {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.5;
  const stars = Array.from({ length: 5 }).map((_, i) => {
    const isFull = i < full;
    const isHalf = i === full && hasHalf;
    return (
      <span key={i} className="inline-flex items-center">
        <FaStar
          className={classNames(
            "text-[12px]",
            isFull || isHalf ? "text-amber-500" : "text-slate-300"
          )}
        />
      </span>
    );
  });
  return <span className="inline-flex gap-1">{stars}</span>;
}

function Pill({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/70 px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm backdrop-blur">
      {children}
    </span>
  );
}

function IconButton({ onClick, ariaLabel, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-[1px] hover:shadow md:h-11 md:w-11"
    >
      {children}
    </button>
  );
}

function Pagination({ page, pageCount, onPage }) {
  const pages = useMemo(() => {
    // Simple windowed pagination
    const windowSize = 5;
    const start = Math.max(1, page - Math.floor(windowSize / 2));
    const end = Math.min(pageCount, start + windowSize - 1);
    const start2 = Math.max(1, end - windowSize + 1);
    return Array.from({ length: end - start2 + 1 }, (_, i) => start2 + i);
  }, [page, pageCount]);

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <div className="text-sm text-slate-600">
        Page <span className="font-semibold text-slate-900">{page}</span> of{" "}
        <span className="font-semibold text-slate-900">{pageCount}</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPage(Math.max(1, page - 1))}
          disabled={page === 1}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-[1px] hover:shadow disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FaChevronLeft />
          Prev
        </button>

        <div className="hidden items-center gap-2 sm:flex">
          {pages.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPage(p)}
              className={classNames(
                "h-10 w-10 rounded-xl border text-sm font-semibold shadow-sm transition hover:-translate-y-[1px] hover:shadow",
                p === page
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-800"
              )}
            >
              {p}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onPage(Math.min(pageCount, page + 1))}
          disabled={page === pageCount}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-[1px] hover:shadow disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
          <FaChevronRight />
        </button>
      </div>
    </div>
  );
}

function ProductCard({ p, expanded, onToggle, onAddToCart }) {
  const discountPct =
    p.compareAt && p.compareAt > p.price
      ? Math.round(((p.compareAt - p.price) / p.compareAt) * 100)
      : 0;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-[2px] hover:shadow">
      <div className="relative">
        <img
          src={p.image}
          alt={p.title}
          className="h-44 w-full object-cover sm:h-48"
          loading="lazy"
        />

        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {p.campaign.includes("new") && <Pill>New</Pill>}
          {p.campaign.includes("sale") && <Pill>Sale</Pill>}
          {p.campaign.includes("freeShip") && <Pill>Free Ship</Pill>}
          {!!discountPct && <Pill>-{discountPct}%</Pill>}
        </div>

        <button
          type="button"
          className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white/90 shadow-sm backdrop-blur transition hover:scale-[1.02]"
          aria-label="Save"
        >
          <FaHeart className="text-slate-700" />
        </button>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-sm font-semibold text-slate-900">
              {p.title}
            </h3>
            <div className="mt-2 flex items-center gap-2">
              <Stars rating={p.rating} />
              <span className="text-xs text-slate-600">
                {p.rating.toFixed(1)} ({p.reviews.toLocaleString()})
              </span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-base font-extrabold text-slate-900">
              {money(p.price)}
            </div>
            {p.compareAt && p.compareAt > p.price ? (
              <div className="text-xs font-semibold text-slate-500 line-through">
                {money(p.compareAt)}
              </div>
            ) : (
              <div className="text-xs font-semibold text-slate-500">&nbsp;</div>
            )}
          </div>
        </div>

        <div
          className={classNames(
            "mt-3 text-sm leading-relaxed text-slate-600",
            expanded ? "" : "line-clamp-2"
          )}
        >
          {p.desc}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-[1px] hover:shadow"
          >
            {expanded ? "See less" : "See more"}
          </button>

          <button
            type="button"
            onClick={onAddToCart}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:shadow"
          >
            <FaShoppingCart />
            Add
          </button>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white/90 to-transparent opacity-0 transition group-hover:opacity-100" />
    </div>
  );
}

export default function EcommerceHomePage() {
  // Slider
  const [slideIdx, setSlideIdx] = useState(0);
  const sliderTimer = useRef(null);

  // Filters
  const [campaign, setCampaign] = useState("all");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");

  // UI states
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [cartCount, setCartCount] = useState(0);

  // Pagination
  const PAGE_SIZE = 8;
  const [page, setPage] = useState(1);

  // Slider autoplay
  useEffect(() => {
    if (sliderTimer.current) clearInterval(sliderTimer.current);
    sliderTimer.current = setInterval(() => {
      setSlideIdx((i) => (i + 1) % HERO_SLIDES.length);
    }, 4500);

    return () => {
      if (sliderTimer.current) clearInterval(sliderTimer.current);
    };
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
    setPage(1);
  }, [campaign, category, query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PRODUCTS.filter((p) => {
      const okCampaign = campaign === "all" ? true : p.campaign.includes(campaign);
      const okCategory = category === "all" ? true : p.category === category;
      const okQuery =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.desc.toLowerCase().includes(q);
      return okCampaign && okCategory && okQuery;
    });
  }, [campaign, category, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeSlide = HERO_SLIDES[slideIdx];

  function prevSlide() {
    setSlideIdx((i) => (i - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
  }
  function nextSlide() {
    setSlideIdx((i) => (i + 1) % HERO_SLIDES.length);
  }

  function toggleExpanded(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addToCart() {
    setCartCount((c) => c + 1);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/75 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-white shadow-sm">
              <FaTags />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-extrabold tracking-tight sm:text-base">
                LuluMart
              </div>
              <div className="text-xs text-slate-500">Shop smarter, faster</div>
            </div>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <a
              href="#categories"
              className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Categories
            </a>
            <a
              href="#deals"
              className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Deals
            </a>
            <a
              href="#products"
              className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Products
            </a>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative hidden sm:block">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products..."
                className="h-11 w-[280px] rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
              />
            </div>

            <div className="relative">
              <div className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-slate-900 px-1 text-[11px] font-extrabold text-white">
                {cartCount}
              </div>
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-[1px] hover:shadow"
                aria-label="Cart"
              >
                <FaShoppingCart />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile search */}
        <div className="mx-auto max-w-7xl px-4 pb-3 sm:hidden">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products..."
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
            />
          </div>
        </div>
      </header>

      {/* Hero slider */}
      <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div
            className="relative h-[280px] sm:h-[340px]"
            style={{
              backgroundImage: `url(${activeSlide.bg})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/70 via-slate-950/35 to-transparent" />

            <div className="relative z-10 flex h-full flex-col justify-end p-5 sm:p-8">
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-extrabold tracking-wide text-white backdrop-blur">
                  {activeSlide.tag}
                </span>
                <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur">
                  Limited time
                </span>
              </div>

              <h1 className="max-w-2xl text-2xl font-black tracking-tight text-white sm:text-4xl">
                {activeSlide.title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-medium text-white/90 sm:text-base">
                {activeSlide.subtitle}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="rounded-2xl bg-white px-4 py-2.5 text-sm font-extrabold text-slate-900 shadow-sm transition hover:-translate-y-[1px] hover:shadow"
                >
                  {activeSlide.cta}
                </button>
                <button
                  type="button"
                  className="rounded-2xl border border-white/35 bg-white/10 px-4 py-2.5 text-sm font-bold text-white shadow-sm backdrop-blur transition hover:-translate-y-[1px] hover:bg-white/15 hover:shadow"
                >
                  View Categories
                </button>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {HERO_SLIDES.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSlideIdx(i)}
                      aria-label={`Go to slide ${i + 1}`}
                      className={classNames(
                        "h-2.5 rounded-full transition",
                        i === slideIdx
                          ? "w-8 bg-white"
                          : "w-2.5 bg-white/45 hover:bg-white/70"
                      )}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <IconButton onClick={prevSlide} ariaLabel="Previous slide">
                    <FaChevronLeft />
                  </IconButton>
                  <IconButton onClick={nextSlide} ariaLabel="Next slide">
                    <FaChevronRight />
                  </IconButton>
                </div>
              </div>
            </div>
          </div>

          {/* Quick trust badges */}
          <div className="grid gap-3 border-t border-slate-200 bg-white p-4 sm:grid-cols-3 sm:p-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-extrabold">Fast shipping</div>
              <div className="mt-1 text-sm text-slate-600">
                Track orders end-to-end
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-extrabold">Secure checkout</div>
              <div className="mt-1 text-sm text-slate-600">
                Protected payments
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-extrabold">Easy returns</div>
              <div className="mt-1 text-sm text-slate-600">
                Simple return policy
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section id="categories" className="mx-auto max-w-7xl px-4 pt-10 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-black tracking-tight sm:text-2xl">
              Shop by category
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-600">
              Quick picks tailored for your needs
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
              <FaFilter />
              Active:
            </span>
            <Pill>
              {category === "all"
                ? "All categories"
                : CATEGORIES.find((c) => c.key === category)?.label}
            </Pill>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={classNames(
              "group overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-[2px] hover:shadow",
              category === "all" ? "border-slate-900" : "border-slate-200"
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-extrabold">All</div>
                <div className="mt-1 text-sm text-slate-600">
                  Browse everything
                </div>
              </div>
              <div className="text-2xl">✨</div>
            </div>
          </button>

          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              className={classNames(
                "group overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-[2px] hover:shadow",
                category === c.key ? "border-slate-900" : "border-slate-200"
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-extrabold">{c.label}</div>
                  <div className="mt-1 text-sm text-slate-600">{c.blurb}</div>
                </div>
                <div className="text-2xl">{c.emoji}</div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-500">
                <span className="h-2 w-2 rounded-full bg-slate-300 group-hover:bg-slate-400" />
                Explore deals
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Campaign filter + products */}
      <section id="products" className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-black tracking-tight sm:text-2xl">
              Featured products
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-600">
              Filter by campaigns, search, and browse with pagination
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-wrap gap-2">
              {CAMPAIGNS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setCampaign(c.key)}
                  className={classNames(
                    "rounded-2xl border px-3 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-[1px] hover:shadow",
                    campaign === c.key
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-800"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="relative sm:hidden">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products..."
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
              />
            </div>
          </div>
        </div>

        {/* Results bar */}
        <div className="mt-5 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-slate-700">
            Showing <span className="font-extrabold text-slate-900">{paged.length}</span> of{" "}
            <span className="font-extrabold text-slate-900">{filtered.length}</span> results
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Pill>
              Campaign: {campaign === "all" ? "All" : CAMPAIGNS.find((x) => x.key === campaign)?.label}
            </Pill>
            <Pill>
              Category: {category === "all" ? "All" : CATEGORIES.find((x) => x.key === category)?.label}
            </Pill>
            {query.trim() ? <Pill>Search: “{query.trim()}”</Pill> : null}
          </div>
        </div>

        {/* Deals anchor */}
        <div id="deals" className="sr-only" />

        {/* Product grid */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {paged.map((p) => (
            <ProductCard
              key={p.id}
              p={p}
              expanded={expandedIds.has(p.id)}
              onToggle={() => toggleExpanded(p.id)}
              onAddToCart={addToCart}
            />
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <div className="text-lg font-black">No results found</div>
            <div className="mt-2 text-sm font-medium text-slate-600">
              Try removing filters or searching different keywords.
            </div>
            <button
              type="button"
              onClick={() => {
                setCampaign("all");
                setCategory("all");
                setQuery("");
              }}
              className="mt-5 inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:-translate-y-[1px] hover:shadow"
            >
              Reset filters
            </button>
          </div>
        ) : null}

        {/* Pagination */}
        {filtered.length > PAGE_SIZE ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <Pagination page={page} pageCount={pageCount} onPage={setPage} />
          </div>
        ) : null}

        {/* Newsletter */}
        <div className="mt-10 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-6 p-6 md:grid-cols-2 md:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-extrabold text-slate-700">
                <FaTags /> Weekly deals
              </div>
              <h3 className="mt-3 text-xl font-black tracking-tight">
                Get updates on new arrivals & exclusive offers
              </h3>
              <p className="mt-2 text-sm font-medium text-slate-600">
                Subscribe to receive curated picks. No spam — unsubscribe anytime.
              </p>
            </div>

            <form
              onSubmit={(e) => e.preventDefault()}
              className="flex flex-col gap-3 sm:flex-row"
            >
              <input
                type="email"
                placeholder="your@email.com"
                className="h-12 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
              />
              <button
                type="submit"
                className="h-12 rounded-2xl bg-slate-900 px-5 text-sm font-extrabold text-white shadow-sm transition hover:-translate-y-[1px] hover:shadow"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-white shadow-sm">
                <FaTags />
              </div>
              <div>
                <div className="text-sm font-extrabold">LuluMart</div>
                <div className="text-xs text-slate-500">
                  Modern ecommerce landing UI
                </div>
              </div>
            </div>
            <p className="mt-4 max-w-md text-sm font-medium text-slate-600">
              This is a UI template. Replace PRODUCTS with API data and connect actions (cart, checkout, auth) as needed.
            </p>
          </div>

          <div>
            <div className="text-sm font-extrabold">Company</div>
            <ul className="mt-3 space-y-2 text-sm font-medium text-slate-600">
              <li>
                <a className="hover:text-slate-900" href="#">
                  About
                </a>
              </li>
              <li>
                <a className="hover:text-slate-900" href="#">
                  Careers
                </a>
              </li>
              <li>
                <a className="hover:text-slate-900" href="#">
                  Press
                </a>
              </li>
            </ul>
          </div>

          <div>
            <div className="text-sm font-extrabold">Support</div>
            <ul className="mt-3 space-y-2 text-sm font-medium text-slate-600">
              <li>
                <a className="hover:text-slate-900" href="#">
                  Help Center
                </a>
              </li>
              <li>
                <a className="hover:text-slate-900" href="#">
                  Returns
                </a>
              </li>
              <li>
                <a className="hover:text-slate-900" href="#">
                  Shipping
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-200">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs font-medium text-slate-500 sm:flex-row sm:px-6">
            <div>© {new Date().getFullYear()} LuluMart. All rights reserved.</div>
            <div className="flex items-center gap-3">
              <a className="hover:text-slate-900" href="#">
                Privacy
              </a>
              <a className="hover:text-slate-900" href="#">
                Terms
              </a>
              <a className="hover:text-slate-900" href="#">
                Cookies
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
