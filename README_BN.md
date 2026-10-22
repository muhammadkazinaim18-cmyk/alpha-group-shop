# ALPHA GROUP — বাংলা ই-কমার্স স্টার্টার

Node.js + Express + SQLite ভিত্তিক চালানো যায় এমন স্টার্টার: বাংলা storefront, পণ্য অনুসন্ধান/ক্যাটাগরি, কার্ট, সার্ভার-সাইড অর্ডার, স্টক যাচাই ও কমানো, bcrypt পাসওয়ার্ড হ্যাশ, সীমিত লগইন প্রচেষ্টা, HttpOnly session cookie, অ্যাডমিন ড্যাশবোর্ড, পণ্য যোগ/নিষ্ক্রিয় এবং অর্ডার স্ট্যাটাস ব্যবস্থাপনা।

## লোকালি চালানো
1. Node.js 20+ ইনস্টল করুন।
2. এই ZIP আনজিপ করুন এবং টার্মিনালে ফোল্ডারে যান।
3. `npm install`
4. `.env.example` কপি করে `.env` নামে রাখুন।
5. `.env`-এ `ADMIN_EMAIL`, `ADMIN_PASSWORD` এবং ৩২+ অক্ষরের অনন্য `SESSION_SECRET` বদলান। গোপন তথ্য কারও সঙ্গে শেয়ার করবেন না।
6. `npm start`
7. `http://localhost:3000` খুলুন। অ্যাডমিনে `.env`-এর ইমেইল/পাসওয়ার্ড ব্যবহার করুন।

ডেটাবেস প্রথম চালুতে `data/alpha-group.sqlite` তৈরি হবে। টাকার পরিমাণ integer পয়সায় সংরক্ষণ করা হয়। নমুনা পণ্য প্রথমবার স্বয়ংক্রিয়ভাবে যোগ হয়।

## পেমেন্ট বাস্তবায়ন
ক্যাশ অন ডেলিভারি অর্ডার তৈরি করা যায়। অনলাইন পেমেন্ট পদ্ধতিটি এখন placeholder; এটি টাকা কাটে না এবং `payment_status` pending থাকে। bKash/Nagad/কার্ড বা SSLCOMMERZ চালু করতে মার্চেন্ট অ্যাকাউন্ট/অনুমোদন, তাদের বর্তমান অফিসিয়াল API, সার্ভার-সাইড payment-session creation, callback/IPN signature verification, amount/order matching, idempotency ও sandbox testing যোগ করতে হবে। ব্রাউজারের redirect দেখে paid করবেন না। কার্ড নম্বর বা CVV নিজে সংরক্ষণ করবেন না। কোনো gateway credential frontend-এ রাখবেন না।

## ডোমেইন/হোস্টিং চালুর ধাপ
- Node.js সমর্থিত হোস্টিং/সার্ভার নিন এবং ডোমেইন কিনে DNS সংযুক্ত করুন।
- HTTPS/TLS চালু করুন; production-এ `NODE_ENV=production` সেট করুন।
- `.env`-এর সব secret অনন্য করুন; admin password শক্তিশালী করুন।
- SQLite-র নিয়মিত encrypted backup নিন; একাধিক সার্ভার/বেশি ট্রাফিক হলে PostgreSQL বিবেচনা করুন।
- CSRF protection, কঠোর CSP, admin MFA, audit log, পাসওয়ার্ড reset, monitoring এবং dependency/security audit যোগ করুন।
- ডেলিভারি চার্জ, ফেরত/রিফান্ড নীতি, গোপনীয়তা নীতি, ব্যবসার ঠিকানা ও যোগাযোগের আসল তথ্য বসান।
- অর্ডার বাতিল করলে স্টক ফেরত দেওয়ার নিয়ম এবং payment refund flow বাস্তবায়ন করুন।

## API
`GET /api/products`, `POST /api/orders`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/admin/summary`, `GET /api/admin/orders`, `POST/PATCH/DELETE /api/admin/products`, `PATCH /api/admin/orders/:id`.

এটি starter code—লাইভ ব্যবসার আগে নিরাপত্তা পরীক্ষা, ব্যাকআপ, আইনগত নীতিমালা ও পেমেন্ট গেটওয়ে ইন্টিগ্রেশন সম্পূর্ণ করতে হবে।
